import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, leadsTable } from "@workspace/db";
import { ACTIVITY_LEVELS, calculateNutrition, matchRation, type Goal } from "@workspace/nutrition";
import { rateLimit } from "../lib/guard";
import { logger } from "../lib/logger";
import { notifyLead } from "../lib/leadNotify";
import { addEvent, appendCustomerNote, SKUS, upsertCustomer } from "../lib/crm";
import { mealsOf } from "../lib/meals";
import { getSiteConfig, PLAN_DAYS, type PlanKey, type RationKey } from "../lib/siteConfig";

/**
 * Website CRM endpoints.
 *  GET  /api/v1/site-config          prices, plans and contacts for the site / app
 *  POST /api/v1/leads                quiz result or order request (name + phone)
 *  POST /api/v1/leads/:id/intent     the same visitor picks a plan afterwards
 */

const router: IRouter = Router();

const INTENTS = new Set(["quiz", "test_drive", "subscription", "manager"]);
const GOALS: Record<string, Goal> = { ozish: "ozish", saqlash: "saqlash", oshirish: "oshirish" };
const RATIONS = new Set<RationKey>(["ozish", "balans", "sport"]);
/** Tashkent districts offered in the order form (ids are stable, labels live on the site). */
export const DISTRICTS = new Set([
  "bektemir", "chilonzor", "mirobod", "mirzo_ulugbek", "olmazor", "sergeli", "shayxontohur",
  "uchtepa", "yakkasaroy", "yangihayot", "yashnobod", "yunusobod", "other",
]);
const districtOf = (v: unknown): string | null => (typeof v === "string" && DISTRICTS.has(v) ? v : null);
const slotOf = (v: unknown): "morning" | "evening" | null => (v === "morning" || v === "evening" ? v : null);

const str = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const s = v.replace(/[\u0000-\u001f\u007f<>]/g, "").trim().slice(0, max);
  return s || null;
};
const num = (v: unknown, min: number, max: number): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};

/** Accepts 9 national digits, or 998 + 9 digits, in any formatting. */
export function normalizePhone(v: unknown): string | null {
  if (typeof v !== "string") return null;
  let d = v.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("998")) d = d.slice(3);
  return /^\d{9}$/.test(d) ? `+998${d}` : null;
}

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

function planOf(v: unknown): PlanKey | null {
  return typeof v === "string" && v in PLAN_DAYS ? (v as PlanKey) : null;
}
/** A calorie option that exists for the ration (or for any ration when none is given). */
function skuOf(v: unknown, ration: RationKey | null): number | null {
  const n = Number(v);
  if (!Number.isInteger(n)) return null;
  const ok = ration ? SKUS[ration].includes(n) : Object.values(SKUS).some((list) => list.includes(n));
  return ok ? n : null;
}
function rationOf(v: unknown): RationKey | null {
  return typeof v === "string" && RATIONS.has(v as RationKey) ? (v as RationKey) : null;
}

router.get("/v1/site-config", (_req, res) => {
  res.setHeader("Cache-Control", "public, max-age=300");
  res.json(getSiteConfig());
});

router.post("/v1/leads", rateLimit("lead-create", 12, 60 * 60 * 1000), async (req, res) => {
  const b = (req.body ?? {}) as Record<string, unknown>;
  // Honeypot: real visitors never see or fill this field.
  if (typeof b["website"] === "string" && b["website"].trim()) {
    res.status(201).json({ id: 0, key: "" });
    return;
  }
  const name = str(b["name"], 60);
  const phone = normalizePhone(b["phone"]);
  if (!name || name.length < 2 || !phone) {
    res.status(400).json({ error: "Ism va telefon raqamini to‘g‘ri kiriting", code: "invalid_contact" });
    return;
  }
  const intent = typeof b["intent"] === "string" && INTENTS.has(b["intent"]) ? b["intent"] : "quiz";
  const lang = b["lang"] === "ru" ? "ru" : "uz";

  // Optional quiz answers → recompute calories on the server; never trust a client number.
  const q = (b["quiz"] && typeof b["quiz"] === "object" ? b["quiz"] : null) as Record<string, unknown> | null;
  let quiz: {
    gender: "erkak" | "ayol"; goal: Goal; age: number; height: number; weight: number; activity: number; healthRisk: boolean;
  } | null = null;
  if (q) {
    const gender = q["gender"] === "erkak" || q["gender"] === "ayol" ? q["gender"] : null;
    const goal = typeof q["goal"] === "string" ? GOALS[q["goal"]] ?? null : null;
    const age = num(q["age"], 14, 100);
    const height = num(q["height"], 120, 230);
    const weight = num(q["weight"], 30, 250);
    const activity = num(q["activity"], 1.1, 2);
    if (!gender || !goal || age == null || height == null || weight == null || activity == null) {
      res.status(400).json({ error: "Kalkulyator ma’lumotlari noto‘g‘ri", code: "invalid_quiz" });
      return;
    }
    const act = ACTIVITY_LEVELS.reduce((best, a) => (Math.abs(a - activity) < Math.abs(best - activity) ? a : best), 1.375 as number);
    quiz = { gender, goal, age: Math.round(age), height: Math.round(height), weight, activity: act, healthRisk: q["healthRisk"] === true };
  }
  const result = quiz
    ? calculateNutrition({ gender: quiz.gender, goal: quiz.goal, age: quiz.age, height: quiz.height, weight: quiz.weight, activityLevel: quiz.activity })
    : null;
  const match = result ? matchRation(result.calories) : null;

  const utm = (b["utm"] && typeof b["utm"] === "object" ? b["utm"] : {}) as Record<string, unknown>;
  const key = randomBytes(24).toString("base64url");
  try {
    const [row] = await db
      .insert(leadsTable)
      .values({
        keyHash: sha(key),
        source: "web",
        name,
        phone,
        lang,
        gender: quiz?.gender ?? null,
        goal: quiz?.goal ?? null,
        age: quiz?.age ?? null,
        height: quiz?.height ?? null,
        weight: quiz?.weight ?? null,
        activity: quiz?.activity ?? null,
        healthRisk: quiz ? quiz.healthRisk : null,
        calories: result?.calories ?? null,
        protein: result?.protein ?? null,
        fat: result?.fat ?? null,
        carbs: result?.carbs ?? null,
        ration: match?.ration ?? null,
        sku: match?.sku ?? null,
        intent,
        plan: planOf(b["plan"]),
        planRation: rationOf(b["planRation"]),
        district: districtOf(b["district"]),
        address: str(b["address"], 200),
        deliverySlot: slotOf(b["deliverySlot"]),
        planSku: skuOf(b["planSku"], rationOf(b["planRation"])),
        meals: mealsOf(b["meals"]),
        note: str(b["note"], 500),
        utmSource: str(utm["source"], 120),
        utmMedium: str(utm["medium"], 120),
        utmCampaign: str(utm["campaign"], 200),
        utmContent: str(utm["content"], 200),
        utmTerm: str(utm["term"], 200),
        referrer: str(b["referrer"], 300),
        landingPath: str(b["landingPath"], 300),
      })
      .returning();
    // CRM: one customer per phone; the request goes into their history.
    try {
      const customer = await upsertCustomer(phone, {
        name, lang, district: row!.district, address: row!.address, deliverySlot: row!.deliverySlot,
        utmSource: row!.utmSource, utmCampaign: row!.utmCampaign, source: "web",
      });
      await db.update(leadsTable).set({ customerId: customer.id }).where(eq(leadsTable.id, row!.id));
      row!.customerId = customer.id;
      await addEvent({ customerId: customer.id, leadId: row!.id, type: "lead", body: row!.intent, meta: { plan: row!.plan, ration: row!.planRation ?? row!.ration, sku: row!.planSku, meals: row!.meals, calories: row!.calories } });
      await appendCustomerNote(customer.id, row!.note);
    } catch (err) {
      logger.error({ err, leadId: row!.id }, "lead → customer link failed");
    }
    void notifyLead(row!, "new");
    res.status(201).json({
      id: row!.id,
      key,
      result: result && match ? { ...result, ration: match.ration, sku: match.sku } : null,
    });
  } catch (err) {
    logger.error({ err }, "lead insert failed");
    res.status(500).json({ error: "Server xatoligi. Qaytadan urinib ko‘ring.", code: "server_error" });
  }
});

router.post("/v1/leads/:id/intent", rateLimit("lead-intent", 30, 60 * 60 * 1000), async (req, res) => {
  const id = num(req.params["id"], 1, Number.MAX_SAFE_INTEGER);
  const b = (req.body ?? {}) as Record<string, unknown>;
  const key = typeof b["key"] === "string" ? b["key"] : "";
  const intent = typeof b["intent"] === "string" && INTENTS.has(b["intent"]) ? b["intent"] : null;
  if (!id || !key || !intent) {
    res.status(400).json({ error: "Noto‘g‘ri so‘rov", code: "bad_request" });
    return;
  }
  try {
    const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, id)).limit(1);
    const a = Buffer.from(lead?.keyHash ?? "", "hex");
    const c = Buffer.from(sha(key), "hex");
    if (!lead || a.length !== c.length || !timingSafeEqual(a, c)) {
      res.status(404).json({ error: "Topilmadi", code: "not_found" });
      return;
    }
    const [row] = await db
      .update(leadsTable)
      .set({
        intent,
        plan: planOf(b["plan"]) ?? lead.plan,
        planRation: rationOf(b["planRation"]) ?? lead.planRation,
        district: districtOf(b["district"]) ?? lead.district,
        address: str(b["address"], 200) ?? lead.address,
        deliverySlot: slotOf(b["deliverySlot"]) ?? lead.deliverySlot,
        planSku: skuOf(b["planSku"], rationOf(b["planRation"]) ?? (lead.planRation as RationKey | null)) ?? lead.planSku,
        meals: mealsOf(b["meals"]) ?? lead.meals,
        note: str(b["note"], 500) ?? lead.note,
        updatedAt: new Date(),
      })
      .where(and(eq(leadsTable.id, id), eq(leadsTable.keyHash, lead.keyHash)))
      .returning();
    if (row!.customerId) {
      try {
        await upsertCustomer(row!.phone, { district: row!.district, address: row!.address, deliverySlot: row!.deliverySlot });
        await addEvent({ customerId: row!.customerId, leadId: row!.id, type: "lead", body: intent, meta: { plan: row!.plan, ration: row!.planRation, sku: row!.planSku, meals: row!.meals } });
        await appendCustomerNote(row!.customerId, row!.note);
      } catch (err) {
        logger.error({ err, leadId: row!.id }, "lead intent CRM event failed");
      }
    }
    void notifyLead(row!, "intent");
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "lead intent update failed");
    res.status(500).json({ error: "Server xatoligi", code: "server_error" });
  }
});

export default router;
