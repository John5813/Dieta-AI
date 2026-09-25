import { Router } from "express";
import { barcodeProductsTable, db, type BarcodeProduct } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

const CODE_RE = /^\d{8,14}$/;
const OFF_TIMEOUT_MS = 6000;
const OFF_BASE = (process.env.OPEN_FOOD_FACTS_URL || "https://world.openfoodfacts.org").replace(/\/$/, "");
// Community submissions per IP per hour — enough for a shopping trip, not for spam.
const SUBMIT_LIMIT = 30;
const submitHits = new Map<string, { count: number; resetAt: number }>();

interface ProductOut {
  code: string;
  name: string;
  brand: string | null;
  unit: "g" | "ml";
  per100: { cal: number; protein: number; carbs: number; fat: number; sugar: number | null; sodiumMg: number | null };
  servingGrams: number | null;
  source: string;
}

function toOut(p: BarcodeProduct): ProductOut {
  return {
    code: p.code,
    name: p.name,
    brand: p.brand,
    unit: p.unit === "ml" ? "ml" : "g",
    per100: {
      cal: p.cal100,
      protein: p.protein100,
      carbs: p.carbs100,
      fat: p.fat100,
      sugar: p.sugar100,
      sodiumMg: p.sodiumMg100,
    },
    servingGrams: p.servingGrams,
    source: p.source,
  };
}

function finite(v: unknown): number | null {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) && n >= 0 ? n : null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Fire-and-forget DB write; the db proxy throws synchronously when unconfigured. */
function background(run: () => Promise<unknown>): void {
  try {
    run().catch(() => {});
  } catch {}
}

/** Looks a code up on Open Food Facts; null when unknown or unusable. */
async function fetchOpenFoodFacts(code: string): Promise<Omit<BarcodeProduct, "scanCount" | "createdAt"> | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), OFF_TIMEOUT_MS);
  try {
    const url =
      `${OFF_BASE}/api/v2/product/${code}.json` +
      "?fields=product_name,product_name_uz,product_name_ru,product_name_en,generic_name,brands,nutriments,serving_quantity,quantity";
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "UzDietaAI/1.0 (calorie tracker)" },
    });
    if (!r.ok) return null;
    const data = (await r.json()) as { status?: number; product?: Record<string, unknown> };
    const p = data.product;
    if (data.status !== 1 || !p) return null;
    const n = (p.nutriments ?? {}) as Record<string, unknown>;
    let cal = finite(n["energy-kcal_100g"]);
    if (cal == null) {
      const kj = finite(n["energy_100g"]);
      if (kj != null) cal = kj / 4.184;
    }
    const name = [p.product_name_uz, p.product_name, p.product_name_ru, p.product_name_en, p.generic_name]
      .map((v) => (typeof v === "string" ? v.trim() : ""))
      .find((v) => v.length > 0);
    if (cal == null || !name) return null;
    const salt = finite(n["salt_100g"]);
    const sodium = finite(n["sodium_100g"]);
    const quantity = typeof p.quantity === "string" ? p.quantity.toLowerCase() : "";
    return {
      code,
      name: name.slice(0, 120),
      brand: typeof p.brands === "string" ? p.brands.split(",")[0]!.trim().slice(0, 80) || null : null,
      unit: /\b(ml|l|cl)\b/.test(quantity) ? "ml" : "g",
      cal100: round1(cal),
      protein100: round1(finite(n["proteins_100g"]) ?? 0),
      carbs100: round1(finite(n["carbohydrates_100g"]) ?? 0),
      fat100: round1(finite(n["fat_100g"]) ?? 0),
      sugar100: finite(n["sugars_100g"]) != null ? round1(finite(n["sugars_100g"])!) : null,
      // OFF gives grams; salt is 2.5× sodium.
      sodiumMg100:
        sodium != null ? Math.round(sodium * 1000) : salt != null ? Math.round((salt / 2.5) * 1000) : null,
      servingGrams: finite(p.serving_quantity),
      source: "off",
    };
  } catch (err) {
    logger.warn({ err, code }, "Open Food Facts lookup failed");
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** GET /api/food/barcode/:code — community table first, then Open Food Facts (cached). */
router.get("/food/barcode/:code", async (req, res) => {
  const code = String(req.params.code ?? "");
  if (!CODE_RE.test(code)) {
    res.status(400).json({ error: "Shtrix-kod noto'g'ri" });
    return;
  }
  try {
    const [hit] = await db.select().from(barcodeProductsTable).where(eq(barcodeProductsTable.code, code));
    if (hit) {
      background(() =>
        db
          .update(barcodeProductsTable)
          .set({ scanCount: sql`${barcodeProductsTable.scanCount} + 1` })
          .where(eq(barcodeProductsTable.code, code)),
      );
      res.json({ found: true, product: toOut(hit) });
      return;
    }
  } catch (err) {
    // No database (local dev) — still answer from Open Food Facts.
    logger.warn({ err }, "barcode table unavailable");
  }

  const off = await fetchOpenFoodFacts(code);
  if (!off) {
    res.json({ found: false });
    return;
  }
  background(() => db.insert(barcodeProductsTable).values({ ...off, scanCount: 1 }).onConflictDoNothing());
  res.json({ found: true, product: toOut({ ...off, scanCount: 1, createdAt: new Date() }) });
});

/** POST /api/food/barcode — a user adds a product from its label; first submission wins. */
router.post("/food/barcode", async (req, res) => {
  const ip = req.ip ?? "unknown";
  const now = Date.now();
  const hit = submitHits.get(ip);
  if (hit && hit.resetAt > now && hit.count >= SUBMIT_LIMIT) {
    res.status(429).json({ error: "Juda ko'p so'rov. Birozdan keyin urinib ko'ring." });
    return;
  }
  submitHits.set(ip, hit && hit.resetAt > now ? { ...hit, count: hit.count + 1 } : { count: 1, resetAt: now + 3600_000 });

  const b = (req.body ?? {}) as Record<string, unknown>;
  const per100 = (b.per100 ?? {}) as Record<string, unknown>;
  const code = String(b.code ?? "");
  const name = typeof b.name === "string" ? b.name.trim().slice(0, 120) : "";
  const cal = finite(per100.cal);
  const protein = finite(per100.protein) ?? 0;
  const carbs = finite(per100.carbs) ?? 0;
  const fat = finite(per100.fat) ?? 0;
  // Per 100 g nothing exceeds ~900 kcal (pure fat) or 100 g of a macro.
  if (!CODE_RE.test(code) || !name || cal == null || cal > 900 || protein > 100 || carbs > 100 || fat > 100) {
    res.status(400).json({ error: "Ma'lumotlar noto'g'ri" });
    return;
  }
  const sugar = finite(per100.sugar);
  const sodiumMg = finite(per100.sodiumMg);
  try {
    await db
      .insert(barcodeProductsTable)
      .values({
        code,
        name,
        brand: typeof b.brand === "string" ? b.brand.trim().slice(0, 80) || null : null,
        unit: b.unit === "ml" ? "ml" : "g",
        cal100: round1(cal),
        protein100: round1(protein),
        carbs100: round1(carbs),
        fat100: round1(fat),
        sugar100: sugar != null && sugar <= 100 ? round1(sugar) : null,
        sodiumMg100: sodiumMg != null && sodiumMg <= 40000 ? Math.round(sodiumMg) : null,
        servingGrams: finite(b.servingGrams),
        source: "user",
      })
      .onConflictDoNothing();
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "barcode submit failed");
    res.status(500).json({ error: "Saqlab bo'lmadi" });
  }
});

export default router;
