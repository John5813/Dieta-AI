import { Router, type IRouter, type Request, type Response } from "express";
import { and, desc, eq, ilike, inArray, isNull, isNotNull, or, sql } from "drizzle-orm";
import {
  db, leadsTable, customersTable, crmEventsTable, ordersTable, deliveryDaysTable, staffTable,
  type Customer,
  DELIVERY_SLOTS, COURIER_TYPES, ORDER_SOURCES, ORDER_STATUSES, PAYMENT_STATUSES,
  type Order, type DeliverySlot, type CourierType,
} from "@workspace/db";
import { rateLimit } from "../lib/guard";
import { buildXlsx, wrapHeight, XS, type XRow } from "../lib/xlsx";
import { DISTRICT_LABEL } from "../lib/leadNotify";
import { logger } from "../lib/logger";
import { normalizePhone, DISTRICTS } from "./leads";
import { PLAN_DAYS, getSiteConfig, type PlanKey, type RationKey } from "../lib/siteConfig";
import {
  SKUS, SLOT_LABEL, addEvent, upsertCustomer, rebuildSchedule, updateFutureDays, orderProgress, displayStatus,
  defaultStartDate, tashkentDate, addDays, isIsoDate, quote, CUTOFF_HOUR, tashkentHour, freezeDays, unfreezeDay, firstEditableDay,
} from "../lib/crm";
import {
  requireStaff, requireOwner, consumeLoginToken, setSessionCookie, clearSessionCookie,
} from "../lib/adminAuth";

/**
 * Admin CRM API (/api/admin/*) for owners and managers, plus the login link
 * handler (/admin/auth). Every customer-facing value is plain JSON; the
 * browser renders it as text.
 */

export const adminApi: IRouter = Router();
export const adminPages: IRouter = Router();

const LEAD_STATUSES = ["new", "contacted", "converted", "lost"] as const;
const RATIONS: RationKey[] = ["ozish", "balans", "sport"];
const PLANS = Object.keys(PLAN_DAYS) as PlanKey[];

const str = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const s = v.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
  return s || null;
};
const oneOf = <T extends readonly string[]>(list: T, v: unknown): T[number] | null =>
  typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T[number]) : null;
const idParam = (req: Request) => {
  const n = Number(req.params["id"]);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
};
const bad = (res: Response, error: string) => res.status(400).json({ error, code: "bad_request" });

/** Uzbek numbers entered by staff: +998 + operator / area code + 7 digits. */
const UZ_CODES = new Set(["20", "33", "50", "55", "61", "62", "65", "66", "67", "69", "70", "71", "72", "73", "74", "75", "76", "77", "78", "79", "88", "90", "91", "93", "94", "95", "97", "98", "99"]);
function staffPhone(v: unknown): string | null {
  const p = normalizePhone(v);
  return p && UZ_CODES.has(p.slice(4, 6)) ? p : null;
}
const PHONE_ERR = "Telefon raqami noto‘g‘ri: +998 va 9 ta raqam (masalan 90 123 45 67)";
const NAME_ERR = "Mijoz ismini kiriting (kamida 2 harf)";
/** Leads / customers that are not archived. */
const notArchivedCustomer = sql`NOT EXISTS (SELECT 1 FROM customers ac WHERE ac.id = ${leadsTable.customerId} AND ac.archived_at IS NOT NULL)`;

// ─── login link from the Telegram bot ────────────────────────────────────────
adminPages.get("/admin/auth", rateLimit("admin-auth", 20, 15 * 60 * 1000), async (req, res) => {
  const staff = await consumeLoginToken(String(req.query["t"] ?? "")).catch((err) => {
    logger.error({ err }, "admin login failed");
    return null;
  });
  if (!staff) {
    res.status(401).type("html").send(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kirish</title><body style="font-family:system-ui;padding:32px;max-width:480px;margin:auto"><h2>Havola eskirgan yoki ishlatilgan</h2><p>Telegram botga <b>/login</b> yozib, yangi havola oling.</p></body>`);
    return;
  }
  setSessionCookie(req, res, staff.id);
  res.redirect(302, "/admin");
});
adminPages.post("/admin/logout", (_req, res) => {
  clearSessionCookie(res);
  res.redirect(303, "/admin");
});

adminApi.use("/admin", requireStaff);

adminApi.get("/admin/me", (req, res) => {
  const s = req.staff!;
  res.json({
    id: s.id, name: s.name, role: s.role,
    options: {
      slots: DELIVERY_SLOTS.map((id) => ({ id, label: SLOT_LABEL[id] })),
      couriers: COURIER_TYPES, sources: ORDER_SOURCES, orderStatuses: ORDER_STATUSES, paymentStatuses: PAYMENT_STATUSES,
      rations: RATIONS.map((id) => ({ id, skus: SKUS[id] })), plans: PLANS.map((id) => ({ id, days: PLAN_DAYS[id] })),
      districts: [...DISTRICTS], leadStatuses: LEAD_STATUSES,
    },
    pricing: { prices: getSiteConfig().prices, discounts: getSiteConfig().discounts },
    today: tashkentDate(), defaultStart: defaultStartDate(), firstEditableDay: firstEditableDay(), cutoffPassed: tashkentHour() >= CUTOFF_HOUR,
  });
});

// ─── 1. Inbox: website / app requests ────────────────────────────────────────
adminApi.get("/admin/inbox", async (req, res) => {
  const status = oneOf(LEAD_STATUSES, req.query["status"]);
  const rows = await db
    .select()
    .from(leadsTable)
    .where(and(status ? eq(leadsTable.status, status) : inArray(leadsTable.status, ["new", "contacted"]), notArchivedCustomer))
    .orderBy(desc(leadsTable.createdAt))
    .limit(200);
  const counts = await db.execute<{ status: string; n: number }>(sql`SELECT status, count(*)::int AS n FROM leads WHERE ${notArchivedCustomer} GROUP BY status`);
  res.json({
    counts: Object.fromEntries(counts.rows.map((r) => [r.status, r.n])),
    items: rows.map((l) => ({
      id: l.id, customerId: l.customerId, name: l.name, phone: l.phone, lang: l.lang, intent: l.intent, status: l.status,
      plan: l.plan, ration: l.planRation ?? l.ration, sku: l.planSku ?? l.sku, note: l.note, calories: l.calories, healthRisk: l.healthRisk,
      district: l.district, address: l.address, deliverySlot: l.deliverySlot, utmSource: l.utmSource, utmCampaign: l.utmCampaign,
      createdAt: l.createdAt,
    })),
  });
});

adminApi.post("/admin/leads/:id/status", async (req, res) => {
  const id = idParam(req);
  const status = oneOf(LEAD_STATUSES, req.body?.status);
  if (!id || !status) { bad(res, "Noto‘g‘ri status"); return; }
  const [lead] = await db.update(leadsTable).set({ status, updatedAt: new Date() }).where(eq(leadsTable.id, id)).returning();
  if (!lead) { res.status(404).json({ error: "Topilmadi" }); return; }
  if (lead.customerId) await addEvent({ customerId: lead.customerId, leadId: lead.id, staffId: req.staff!.id, type: "lead_status", body: status });
  res.json({ ok: true });
});

// ─── 2. Customers and subscriptions ──────────────────────────────────────────
async function orderView(orders: Order[]) {
  const prog = await orderProgress(orders.map((o) => o.id));
  return orders.map((o) => {
    const p = prog.get(o.id);
    return { ...o, progress: p, status: displayStatus(o, p) };
  });
}

const CUSTOMER_FILTERS = ["active", "awaiting", "none", "archived"] as const;

adminApi.get("/admin/customers", async (req, res) => {
  const q = str(req.query["q"], 60);
  const filter = oneOf(CUSTOMER_FILTERS, req.query["status"]);
  const conds = [filter === "archived" ? isNotNull(customersTable.archivedAt) : isNull(customersTable.archivedAt)];
  if (q) {
    const digits = q.replace(/\D/g, "");
    conds.push(digits.length >= 3
      ? or(ilike(customersTable.phone, `%${digits}%`), ilike(customersTable.name, `%${q}%`))!
      : ilike(customersTable.name, `%${q}%`));
  }
  if (filter === "active") conds.push(sql`EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = ${customersTable.id} AND o.crm_status = 'active')`);
  if (filter === "awaiting") conds.push(sql`EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = ${customersTable.id} AND o.crm_status IN ('new','contacted','awaiting_payment'))`);
  if (filter === "none") conds.push(sql`NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = ${customersTable.id} AND o.crm_status <> 'cancelled')`);
  const customers = await db
    .select()
    .from(customersTable)
    .where(and(...conds))
    .orderBy(desc(sql`coalesce(${customersTable.lastContactAt}, ${customersTable.createdAt})`))
    .limit(100);
  const ids = customers.map((c) => c.id);
  const orders = ids.length
    ? await db.select().from(ordersTable).where(inArray(ordersTable.customerId, ids)).orderBy(desc(ordersTable.createdAt))
    : [];
  const views = await orderView(orders);
  res.json({
    items: customers.map((c) => {
      const latest = views.find((o) => o.customerId === c.id && o.crmStatus !== "cancelled") ?? views.find((o) => o.customerId === c.id) ?? null;
      return { id: c.id, name: c.name, phone: c.phone, district: c.district, firstSource: c.firstSource, createdAt: c.createdAt, archivedAt: c.archivedAt, order: latest };
    }),
  });
});

/** Does this phone already belong to a customer? (duplicate check while typing). Registered before /customers/:id. */
adminApi.get("/admin/customers/lookup", async (req, res) => {
  const phone = normalizePhone(req.query["phone"]);
  if (!phone) { res.json({ customer: null }); return; }
  const [c] = await db.select().from(customersTable).where(eq(customersTable.phone, phone)).limit(1);
  if (!c) { res.json({ customer: null }); return; }
  const orders = await db.select().from(ordersTable).where(eq(ordersTable.customerId, c.id)).orderBy(desc(ordersTable.createdAt)).limit(1);
  const [latest] = await orderView(orders);
  res.json({ customer: { id: c.id, name: c.name, phone: c.phone, district: c.district, archived: !!c.archivedAt, order: latest ? { ration: latest.ration, sku: latest.sku, plan: latest.plan, status: latest.status } : null } });
});

adminApi.get("/admin/customers/:id", async (req, res) => {
  const id = idParam(req);
  if (!id) { bad(res, "ID"); return; }
  const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, id)).limit(1);
  if (!customer) { res.status(404).json({ error: "Topilmadi" }); return; }
  const orders = await db.select().from(ordersTable).where(eq(ordersTable.customerId, id)).orderBy(desc(ordersTable.createdAt));
  const leads = await db.select().from(leadsTable).where(eq(leadsTable.customerId, id)).orderBy(desc(leadsTable.createdAt)).limit(20);
  const events = await db
    .select({ e: crmEventsTable, staffName: staffTable.name })
    .from(crmEventsTable)
    .leftJoin(staffTable, eq(staffTable.id, crmEventsTable.staffId))
    .where(eq(crmEventsTable.customerId, id))
    .orderBy(desc(crmEventsTable.createdAt))
    .limit(100);
  res.json({
    customer,
    orders: await orderView(orders),
    leads: leads.map((l) => ({ id: l.id, intent: l.intent, status: l.status, plan: l.plan, ration: l.planRation ?? l.ration, sku: l.sku, calories: l.calories, healthRisk: l.healthRisk, createdAt: l.createdAt })),
    events: events.map(({ e, staffName }) => ({ id: e.id, type: e.type, body: e.body, meta: e.meta, orderId: e.orderId, staffName, createdAt: e.createdAt })),
  });
});

/** New customer (e.g. from a phone call), or the existing one for that phone. */
adminApi.post("/admin/customers", async (req, res) => {
  const b = req.body ?? {};
  const phone = normalizePhone(b.phone);
  if (!phone) { bad(res, "Telefon raqami noto‘g‘ri (+998 XX XXX XX XX)"); return; }
  const customer = await upsertCustomer(phone, {
    name: str(b.name, 60), district: oneOf([...DISTRICTS] as string[], b.district) as string | null,
    address: str(b.address, 200), deliverySlot: oneOf(DELIVERY_SLOTS, b.deliverySlot), source: oneOf(ORDER_SOURCES, b.source) ?? "phone",
  });
  res.status(201).json({ customer });
});

adminApi.patch("/admin/customers/:id", async (req, res) => {
  const id = idParam(req);
  if (!id) { bad(res, "ID"); return; }
  const [cur] = await db.select().from(customersTable).where(eq(customersTable.id, id)).limit(1);
  if (!cur) { res.status(404).json({ error: "Topilmadi" }); return; }
  const b = req.body ?? {};
  const patch: Record<string, unknown> = {};
  if ("name" in b) { const n = str(b.name, 60); if (!n || n.length < 2) { bad(res, NAME_ERR); return; } patch["name"] = n; }
  if ("phone" in b) {
    const p = staffPhone(b.phone);
    if (!p) { bad(res, PHONE_ERR); return; }
    if (p !== cur.phone) {
      const [other] = await db.select({ id: customersTable.id, name: customersTable.name }).from(customersTable).where(eq(customersTable.phone, p)).limit(1);
      if (other) { res.status(409).json({ error: `Bu raqam boshqa mijozda: ${other.name ?? "Ismsiz"} (#${other.id})`, code: "phone_taken", customerId: other.id }); return; }
      patch["phone"] = p;
    }
  }
  if ("district" in b) patch["district"] = oneOf([...DISTRICTS] as string[], b.district);
  if ("address" in b) patch["address"] = str(b.address, 200);
  if ("deliverySlot" in b) patch["deliverySlot"] = oneOf(DELIVERY_SLOTS, b.deliverySlot);
  if ("notes" in b) patch["notes"] = str(b.notes, 2000);
  if (!Object.keys(patch).length) { res.json({ customer: cur }); return; }
  const [row] = await db.update(customersTable).set({ ...patch, updatedAt: new Date() }).where(eq(customersTable.id, id)).returning();
  if (patch["phone"]) await addEvent({ customerId: id, staffId: req.staff!.id, type: "customer_updated", body: `Telefon: ${cur.phone} → ${patch["phone"]}` });
  res.json({ customer: row });
});

/** Archive (hide from lists) or restore. Not allowed while a subscription still has days to deliver. */
adminApi.post("/admin/customers/:id/archive", async (req, res) => {
  const id = idParam(req);
  if (!id) { bad(res, "ID"); return; }
  const archive = req.body?.archived !== false;
  if (archive) {
    const active = await db.select({ id: ordersTable.id }).from(ordersTable).where(and(eq(ordersTable.customerId, id), eq(ordersTable.crmStatus, "active")));
    const prog = await orderProgress(active.map((o) => o.id));
    if ([...prog.values()].some((p) => p.remaining > 0 || p.frozen > 0)) {
      bad(res, "Faol obunasi bor — avval obunani bekor qiling yoki tugashini kuting"); return;
    }
  }
  const [row] = await db.update(customersTable).set({ archivedAt: archive ? new Date() : null, updatedAt: new Date() }).where(eq(customersTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Topilmadi" }); return; }
  await addEvent({ customerId: id, staffId: req.staff!.id, type: "customer_updated", body: archive ? "Arxivga olindi" : "Arxivdan qaytarildi" });
  res.json({ customer: row });
});

/** Permanent delete (owner only): the customer, their orders, delivery days, history, website requests and app links. */
adminApi.delete("/admin/customers/:id", requireOwner, async (req, res) => {
  const id = idParam(req);
  if (!id) { bad(res, "ID"); return; }
  const [c] = await db.select().from(customersTable).where(eq(customersTable.id, id)).limit(1);
  if (!c) { res.status(404).json({ error: "Topilmadi" }); return; }
  if (String(req.body?.confirm ?? "") !== c.phone.slice(-4)) { bad(res, "Tasdiqlash uchun telefonning oxirgi 4 raqamini kiriting"); return; }
  await db.transaction(async (tx) => {
    const orderIds = (await tx.select({ id: ordersTable.id }).from(ordersTable).where(eq(ordersTable.customerId, id))).map((o) => o.id);
    if (orderIds.length) await tx.delete(deliveryDaysTable).where(inArray(deliveryDaysTable.orderId, orderIds));
    await tx.delete(ordersTable).where(eq(ordersTable.customerId, id));
    await tx.delete(crmEventsTable).where(eq(crmEventsTable.customerId, id));
    await tx.delete(leadsTable).where(eq(leadsTable.customerId, id));
    await tx.execute(sql`DELETE FROM app_links WHERE customer_id = ${id}`);
    await tx.delete(customersTable).where(eq(customersTable.id, id));
  });
  logger.info({ customerId: id, staffId: req.staff!.id }, "customer deleted from CRM");
  res.json({ ok: true });
});

/** Manual call log / note. */
adminApi.post("/admin/customers/:id/events", async (req, res) => {
  const id = idParam(req);
  const type = oneOf(["call", "note"] as const, req.body?.type);
  const body = str(req.body?.body, 2000);
  if (!id || !type) { bad(res, "Noto‘g‘ri ma’lumot"); return; }
  const outcome = str(req.body?.outcome, 40);
  if (!body && !outcome) { bad(res, "Izoh yozing"); return; }
  await addEvent({ customerId: id, staffId: req.staff!.id, type, body: [outcome, body].filter(Boolean).join(" — "), meta: outcome ? { outcome } : null });
  const leadId = Number(req.body?.leadId);
  if (type === "call" && Number.isSafeInteger(leadId) && leadId > 0) {
    await db.update(leadsTable).set({ status: "contacted", updatedAt: new Date() }).where(and(eq(leadsTable.id, leadId), eq(leadsTable.status, "new")));
  }
  res.status(201).json({ ok: true });
});

// ─── Orders (subscriptions) ──────────────────────────────────────────────────
/** Human-readable history lines for order changes. */
const FIELD_LABEL: Record<string, string> = {
  crmStatus: "Holat", paymentStatus: "To‘lov", deliverySlot: "Yetkazish vaqti", courierType: "Kuryer", startDate: "Boshlanish",
  plan: "Muddat", ration: "Rasion", sku: "Kaloriya", pricePerDay: "Kunlik narx", paidAmount: "To‘langan", district: "Tuman", address: "Manzil", note: "Izoh", source: "Manba",
  daysTotal: "Kunlar soni", status: "Holat",
};
const VALUE_LABEL: Record<string, string> = {
  new: "Yangi", contacted: "Aloqaga chiqildi", awaiting_payment: "To‘lov kutilmoqda", active: "Faol", finished: "Tugadi", cancelled: "Bekor",
  unpaid: "To‘lanmagan", pending: "Kutilmoqda", paid: "To‘langan", partial: "Qisman", refunded: "Qaytarilgan",
  delivered: "Yetkazildi", failed: "O‘tkazib yuborildi", scheduled: "Rejada",
  morning: "ertalab 08:00–10:00", evening: "kechki 18:00–22:30", internal: "ichki", external: "tashqi (autsors)",
  ozish: "Ozish", balans: "Balans", sport: "Sport", d3: "3 kun", w1: "1 hafta", w2: "2 hafta", w3: "3 hafta", w4: "4 hafta", m1: "1 oy",
  web: "sayt", mobile_app: "ilova", phone: "telefon", telegram: "Telegram", instagram: "Instagram",
};
const valueLabel = (v: unknown) => (v == null || v === "" ? "—" : VALUE_LABEL[String(v)] ?? String(v));

function readOrderInput(b: Record<string, unknown>, partial: boolean) {
  const out: Record<string, unknown> = {};
  const err = (m: string) => ({ error: m, data: out });
  const ration = oneOf(RATIONS, b["ration"]);
  if (ration || !partial) { if (!ration) return err("Rasionni tanlang"); out["ration"] = ration; }
  if ("sku" in b || !partial) {
    const sku = Number(b["sku"]);
    const r = (ration ?? (b["_ration"] as RationKey | undefined));
    if (!r || !SKUS[r].includes(sku)) return err("Kaloriya (SKU) rasionga mos emas");
    out["sku"] = sku;
  }
  // Switching ration without a calorie choice → that ration's first SKU.
  if (partial && ration && !("sku" in b)) out["sku"] = SKUS[ration][0];
  const plan = oneOf(PLANS, b["plan"]);
  if (plan || !partial) { if (!plan) return err("Muddatni tanlang"); out["plan"] = plan; }
  if ("startDate" in b || !partial) {
    if (!isIsoDate(b["startDate"])) return err("Boshlanish sanasi noto‘g‘ri");
    out["startDate"] = b["startDate"];
  }
  for (const [k, list] of [["deliverySlot", DELIVERY_SLOTS], ["courierType", COURIER_TYPES], ["paymentStatus", PAYMENT_STATUSES], ["crmStatus", ORDER_STATUSES], ["source", ORDER_SOURCES]] as const) {
    if (k in b) { const v = oneOf(list, b[k]); if (!v) return err(`${k} noto‘g‘ri`); out[k] = v; }
  }
  if ("district" in b) out["district"] = oneOf([...DISTRICTS] as string[], b["district"]);
  if ("address" in b) out["address"] = str(b["address"], 200);
  if ("note" in b) out["note"] = str(b["note"], 1000);
  if ("pricePerDay" in b && b["pricePerDay"] !== "" && b["pricePerDay"] != null) {
    const p = Number(b["pricePerDay"]);
    if (!Number.isFinite(p) || p < 1000 || p > 10_000_000) return err("Kunlik narx noto‘g‘ri");
    out["pricePerDay"] = Math.round(p);
  }
  if ("daysTotal" in b && b["daysTotal"] !== "" && b["daysTotal"] != null) {
    const d = Number(b["daysTotal"]);
    if (!Number.isInteger(d) || d < 1 || d > 60) return err("Kunlar soni 1–60 oralig‘ida bo‘lsin");
    out["daysTotal"] = d;
  }
  if ("paidAmount" in b && b["paidAmount"] !== "" && b["paidAmount"] != null) {
    const p = Number(b["paidAmount"]);
    if (!Number.isFinite(p) || p < 0 || p > 100_000_000) return err("To‘langan summa noto‘g‘ri");
    out["paidAmount"] = Math.round(p);
  }
  return { error: null, data: out };
}

/** Inserts a validated order (from readOrderInput) for a customer and builds its delivery schedule. */
async function insertOrder(staffId: number, customer: Customer, data: Record<string, unknown>, leadIdRaw?: unknown) {
  const q = quote(data["ration"] as RationKey, data["plan"] as PlanKey, data["pricePerDay"] as number | undefined, data["daysTotal"] as number | undefined);
  const paymentStatus = (data["paymentStatus"] as string) ?? "unpaid";
  // Paid in full or a prepayment (partial) → the subscription is on and goes to the delivery list.
  const crmStatus = (data["crmStatus"] as string) ?? (paymentStatus === "paid" || paymentStatus === "partial" ? "active" : "awaiting_payment");
  const leadId = Number(leadIdRaw);
  const [order] = await db
    .insert(ordersTable)
    .values({
      customerId: customer.id,
      leadId: Number.isSafeInteger(leadId) && leadId > 0 ? leadId : null,
      source: (data["source"] as string) ?? "phone",
      ration: data["ration"] as string, sku: data["sku"] as number, plan: data["plan"] as string,
      daysTotal: q.days, pricePerDay: q.pricePerDay, discountPct: q.discountPct, amount: q.amount,
      paidAmount: (data["paidAmount"] as number) ?? (paymentStatus === "paid" ? q.amount : 0),
      paymentStatus, crmStatus, startDate: data["startDate"] as string,
      deliverySlot: (data["deliverySlot"] as string) ?? customer.deliverySlot ?? "morning",
      courierType: (data["courierType"] as string) ?? "internal",
      district: ("district" in data ? data["district"] : customer.district) as string | null,
      address: ("address" in data ? data["address"] : customer.address) as string | null,
      managerId: staffId, note: (data["note"] as string) ?? null,
    })
    .returning();
  await rebuildSchedule(order!);
  await upsertCustomer(customer.phone, { district: order!.district, address: order!.address, deliverySlot: order!.deliverySlot as DeliverySlot });
  if (order!.leadId) await db.update(leadsTable).set({ status: "converted", updatedAt: new Date() }).where(eq(leadsTable.id, order!.leadId));
  await addEvent({
    customerId: customer.id, orderId: order!.id, staffId, type: "order_created",
    body: `${valueLabel(order!.ration)} ${order!.sku} · ${valueLabel(order!.plan)} · ${order!.startDate} · ${SLOT_LABEL[order!.deliverySlot as DeliverySlot]}`,
    meta: { source: order!.source, amount: order!.amount, paymentStatus, crmStatus },
  });
  return (await orderView([order!]))[0]!;
}

adminApi.post("/admin/orders", rateLimit("admin-orders", 120, 60 * 60 * 1000), async (req, res) => {
  const b = (req.body ?? {}) as Record<string, unknown>;
  const customerId = Number(b["customerId"]);
  if (!Number.isSafeInteger(customerId) || customerId <= 0) { bad(res, "Mijoz tanlanmagan"); return; }
  const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, customerId)).limit(1);
  if (!customer) { res.status(404).json({ error: "Mijoz topilmadi" }); return; }
  if (!b["startDate"]) b["startDate"] = defaultStartDate();
  const { error, data } = readOrderInput(b, false);
  if (error) { bad(res, error); return; }
  res.status(201).json({ order: await insertOrder(req.staff!.id, customer, data, b["leadId"]) });
});

/**
 * "+ Yangi mijoz qo'shish": saves a customer (call / interest) and, optionally,
 * an order in one go. The order is validated before anything is written, and
 * an existing phone updates that customer instead of creating a duplicate.
 */
adminApi.post("/admin/customers/quick", rateLimit("admin-quick", 120, 60 * 60 * 1000), async (req, res) => {
  const b = (req.body ?? {}) as Record<string, unknown>;
  const phone = staffPhone(b["phone"]);
  if (!phone) { bad(res, PHONE_ERR); return; }
  const name = str(b["name"], 60);
  if (!name || name.length < 2) { bad(res, NAME_ERR); return; }
  const source = oneOf(ORDER_SOURCES, b["source"]) ?? "phone";
  const slot = oneOf(DELIVERY_SLOTS, b["deliverySlot"]);
  const district = oneOf([...DISTRICTS] as string[], b["district"]) as string | null;
  const address = str(b["address"], 200);
  const note = str(b["note"], 2000);

  let orderData: Record<string, unknown> | null = null;
  if (b["order"] && typeof b["order"] === "object") {
    const ob: Record<string, unknown> = { ...(b["order"] as Record<string, unknown>), source };
    if (!("deliverySlot" in ob) && slot) ob["deliverySlot"] = slot;
    if (!ob["startDate"]) ob["startDate"] = defaultStartDate();
    if (!("district" in ob)) ob["district"] = district;
    if (!("address" in ob)) ob["address"] = address;
    const { error, data } = readOrderInput(ob, false);
    if (error) { bad(res, error); return; }
    orderData = data;
  }

  const [before] = await db.select({ id: customersTable.id }).from(customersTable).where(eq(customersTable.phone, phone)).limit(1);
  let customer = await upsertCustomer(phone, {
    name, district, address, source,
    deliverySlot: (orderData?.["deliverySlot"] as DeliverySlot | undefined) ?? slot,
  });
  const staffId = req.staff!.id;
  if (!before) await addEvent({ customerId: customer.id, staffId, type: "customer_added", body: `Qo‘lda qo‘shildi · manba: ${valueLabel(source)}` });
  // The note is the customer's permanent reminder (allergies, intercom…) and is also logged in the history.
  if (note) {
    const notes = customer.notes && !customer.notes.includes(note) ? `${customer.notes}\n${note}` : note;
    [customer] = await db.update(customersTable).set({ notes, updatedAt: new Date() }).where(eq(customersTable.id, customer.id)).returning() as [typeof customer];
    await addEvent({ customerId: customer.id, staffId, type: "note", body: note });
  }
  const order = orderData ? await insertOrder(staffId, customer, orderData) : null;
  res.status(before ? 200 : 201).json({ customer, existing: !!before, order });
});

adminApi.patch("/admin/orders/:id", async (req, res) => {
  const id = idParam(req);
  if (!id) { bad(res, "ID"); return; }
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
  if (!order) { res.status(404).json({ error: "Topilmadi" }); return; }
  const b = { ...(req.body ?? {}), _ration: order.ration } as Record<string, unknown>;
  const { error, data } = readOrderInput(b, true);
  if (error) { bad(res, error); return; }
  if (!Object.keys(data).length) { bad(res, "O‘zgarish yo‘q"); return; }

  // Price follows plan / days / ration / price changes. A new plan resets the day count unless days are given.
  if ("plan" in data || "ration" in data || "pricePerDay" in data || "daysTotal" in data) {
    const days = (data["daysTotal"] as number | undefined) ?? ("plan" in data ? undefined : order.daysTotal);
    const q = quote((data["ration"] ?? order.ration) as RationKey, (data["plan"] ?? order.plan) as PlanKey, (data["pricePerDay"] ?? order.pricePerDay) as number, days);
    Object.assign(data, { daysTotal: q.days, pricePerDay: q.pricePerDay, discountPct: q.discountPct, amount: q.amount });
  }
  if (data["paymentStatus"] === "paid" && !("paidAmount" in data)) data["paidAmount"] = (data["amount"] as number) ?? order.amount;
  if ((data["paymentStatus"] === "paid" || data["paymentStatus"] === "partial") && !("crmStatus" in data) && ["new", "contacted", "awaiting_payment"].includes(order.crmStatus)) data["crmStatus"] = "active";
  if ("paidAmount" in data && !("paymentStatus" in data)) {
    const amt = (data["amount"] as number) ?? order.amount, paid = data["paidAmount"] as number;
    data["paymentStatus"] = paid <= 0 ? "unpaid" : paid >= amt ? "paid" : "partial";
  }
  if ("startDate" in data && (data["startDate"] as string) < tashkentDate() && data["startDate"] !== order.startDate) { bad(res, "Boshlanish sanasi o‘tgan kun bo‘lishi mumkin emas"); return; }

  const [next] = await db.update(ordersTable).set({ ...data, updatedAt: new Date() }).where(eq(ordersTable.id, id)).returning();
  if ("startDate" in data && data["startDate"] !== order.startDate) await rebuildSchedule(next!, { reset: true });
  else if (next!.daysTotal !== order.daysTotal) await rebuildSchedule(next!);
  await updateFutureDays(id, {
    ...("deliverySlot" in data ? { deliverySlot: data["deliverySlot"] as DeliverySlot } : {}),
    ...("courierType" in data ? { courierType: data["courierType"] as CourierType } : {}),
    ...("district" in data ? { district: data["district"] as string | null } : {}),
    ...("address" in data ? { address: data["address"] as string | null } : {}),
    ...("sku" in data ? { sku: data["sku"] as number } : {}),
  });
  if (data["crmStatus"] === "cancelled") {
    await db.update(deliveryDaysTable).set({ status: "cancelled", updatedAt: new Date() })
      .where(and(eq(deliveryDaysTable.orderId, id), eq(deliveryDaysTable.status, "scheduled"), sql`${deliveryDaysTable.day} > ${tashkentDate()}`));
  }
  const changed = Object.keys(data).filter((k) => k in FIELD_LABEL);
  await addEvent({ customerId: order.customerId, orderId: id, staffId: req.staff!.id, type: "order_updated", body: changed.map((k) => `${FIELD_LABEL[k]}: ${valueLabel(data[k])}`).join(", ") });
  res.json({ order: (await orderView([next!]))[0] });
});

/** Pause: freeze the order's days from `from` to `to` (inclusive). Each frozen day is appended at the end. */
adminApi.post("/admin/orders/:id/freeze", async (req, res) => {
  const id = idParam(req);
  if (!id) { bad(res, "ID"); return; }
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
  if (!order) { res.status(404).json({ error: "Topilmadi" }); return; }
  const from = req.body?.from, to = req.body?.to ?? req.body?.from;
  if (!isIsoDate(from) || !isIsoDate(to) || to < from) { bad(res, "Sanalarni to‘g‘ri tanlang"); return; }
  const min = firstEditableDay();
  if (from < min) { bad(res, `Soat 18:00 qoidasi: ${min} dan oldingi kunlarni muzlatib bo‘lmaydi`); return; }
  const n = await freezeDays(order, from, to);
  if (!n) { bad(res, "Bu oraliqda muzlatiladigan yetkazish kuni yo‘q"); return; }
  await addEvent({ customerId: order.customerId, orderId: id, staffId: req.staff!.id, type: "order_updated", body: `Muzlatildi: ${from}${to !== from ? " – " + to : ""} (${n} kun, obuna oxiriga qo‘shildi; 30 kun ichida ishlatilmasa kuyadi)` });
  const [next] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
  res.json({ order: (await orderView([next!]))[0], frozen: n });
});

adminApi.post("/admin/orders/:id/unfreeze", async (req, res) => {
  const id = idParam(req);
  const dayId = Number(req.body?.dayId);
  if (!id || !Number.isSafeInteger(dayId)) { bad(res, "ID"); return; }
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
  if (!order) { res.status(404).json({ error: "Topilmadi" }); return; }
  if (!(await unfreezeDay(order, dayId))) { bad(res, "Bu kunni qaytarib bo‘lmaydi (o‘tgan yoki 18:00 dan keyin qulflangan)"); return; }
  await addEvent({ customerId: order.customerId, orderId: id, staffId: req.staff!.id, type: "order_updated", body: "Muzlatish bekor qilindi (1 kun)" });
  const [next] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
  res.json({ order: (await orderView([next!]))[0] });
});

/** Permanent delete of a mistaken / test order (owner only). Use "Bekor" for real cancellations. */
adminApi.delete("/admin/orders/:id", requireOwner, async (req, res) => {
  const id = idParam(req);
  if (!id) { bad(res, "ID"); return; }
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
  if (!order) { res.status(404).json({ error: "Topilmadi" }); return; }
  await db.transaction(async (tx) => {
    await tx.delete(deliveryDaysTable).where(eq(deliveryDaysTable.orderId, id));
    await tx.delete(ordersTable).where(eq(ordersTable.id, id));
  });
  await addEvent({ customerId: order.customerId, staffId: req.staff!.id, type: "order_updated", body: `Buyurtma #${id} o‘chirildi (${valueLabel(order.ration)} ${order.sku} · ${valueLabel(order.plan)})` });
  res.json({ ok: true });
});

// ─── 3. Tomorrow: delivery lists by shift and courier, and renewals ─────────
async function deliveryRows(day: string) {
  const rows = await db
    .select({ d: deliveryDaysTable, o: ordersTable, c: customersTable })
    .from(deliveryDaysTable)
    .innerJoin(ordersTable, eq(ordersTable.id, deliveryDaysTable.orderId))
    .innerJoin(customersTable, eq(customersTable.id, ordersTable.customerId))
    .where(and(
      eq(deliveryDaysTable.day, day), inArray(deliveryDaysTable.status, ["scheduled", "locked", "delivered", "failed"]),
      eq(ordersTable.crmStatus, "active"), isNull(customersTable.archivedAt),
    ))
    .orderBy(deliveryDaysTable.deliverySlot, deliveryDaysTable.courierType, deliveryDaysTable.district);
  return rows.map(({ d, o, c }) => ({
    dayId: d.id, orderId: o.id, customerId: c.id, name: c.name, phone: c.phone, sku: d.sku, ration: o.ration,
    deliverySlot: d.deliverySlot, courierType: d.courierType, district: d.district, address: d.address, status: d.status,
    note: o.note, customerNotes: c.notes,
  }));
}

type DeliveryRow = Awaited<ReturnType<typeof deliveryRows>>[number];
const RATION_NAME: Record<string, string> = { ozish: "Ozish", balans: "Balans", sport: "Sport" };
const WEEKDAY = ["yakshanba", "dushanba", "seshanba", "chorshanba", "payshanba", "juma", "shanba"];
const MONTH = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
/** "2026-11-28" → "28-noyabr 2026, shanba" */
function dayLabel(day: string): string {
  const d = new Date(day + "T00:00:00Z");
  return `${d.getUTCDate()}-${MONTH[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${WEEKDAY[d.getUTCDay()]}`;
}
const dayParam = (req: Request) => (isIsoDate(req.query["day"]) ? (req.query["day"] as string) : addDays(tashkentDate(), 1));
const xlsxHeaders = (res: Response, file: string) => {
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${file}"`);
  res.setHeader("Cache-Control", "no-store");
};

/** Kitchen sheet: portions per ration + calories split by shift, and every allergy / note (no phones, no addresses). */
function kitchenSummary(rows: DeliveryRow[]) {
  const byKey = new Map<string, { ration: string; sku: number; morning: number; evening: number; total: number }>();
  for (const r of rows) {
    if (r.status === "failed") continue;
    const k = `${r.ration}:${r.sku}`;
    const e = byKey.get(k) ?? { ration: r.ration, sku: r.sku, morning: 0, evening: 0, total: 0 };
    if (r.deliverySlot === "evening") e.evening++; else e.morning++;
    e.total++;
    byKey.set(k, e);
  }
  const order = ["ozish", "balans", "sport"];
  const kitchen = [...byKey.values()].sort((a, b) => order.indexOf(a.ration) - order.indexOf(b.ration) || a.sku - b.sku);
  const notes = rows.filter((r) => r.status !== "failed" && (r.customerNotes || r.note)).map((r) => ({
    name: r.name, ration: r.ration, sku: r.sku, deliverySlot: r.deliverySlot, text: [r.customerNotes, r.note].filter(Boolean).join(" · "),
  }));
  return { kitchen, notes };
}

adminApi.get("/admin/delivery", async (req, res) => {
  const day = dayParam(req);
  const rows = await deliveryRows(day);
  res.json({ day, today: tashkentDate(), rows, ...kitchenSummary(rows) });
});

/** Courier list as a ready-to-print Excel table (all lists, or one shift / courier type). */
adminApi.get("/admin/delivery.xlsx", async (req, res) => {
  const day = dayParam(req);
  const slot = oneOf(DELIVERY_SLOTS, req.query["slot"]);
  const courier = oneOf(COURIER_TYPES, req.query["courier"]);
  const rows = (await deliveryRows(day)).filter((r) => (!slot || r.deliverySlot === slot) && (!courier || r.courierType === courier));
  const head = ["№", "Smena", "Kuryer", "Mijoz", "Telefon", "Tuman", "Manzil", "Rasion", "Kkal", "Izoh / allergiya", "✓"];
  const what = [slot ? (slot === "evening" ? "Kechki 18:00–22:30" : "Ertalab 08:00–10:00") : "", courier ? (courier === "external" ? "Tashqi kuryer" : "Ichki kuryer") : ""].filter(Boolean).join(" · ");
  const sheetRows: XRow[] = [
    { cells: [`Yetkazish ro‘yxati — ${dayLabel(day)}${what ? " · " + what : ""} (${rows.length} ta)`], style: XS.title, height: 24 },
    { cells: head, style: XS.head, height: 20 },
    ...rows.map((r, i) => ({
      style: XS.text,
      cells: [
        { v: i + 1, s: XS.num },
        r.deliverySlot === "evening" ? "Kechki 18:00–22:30" : "Ertalab 08:00–10:00",
        r.courierType === "external" ? "Tashqi" : "Ichki",
        r.name ?? "",
        r.phone.replace(/^\+998(\d{2})(\d{3})(\d{2})(\d{2})$/, "+998 $1 $2 $3 $4"),
        r.district ? DISTRICT_LABEL[r.district] ?? r.district : "",
        r.address ?? "",
        RATION_NAME[r.ration] ?? r.ration,
        { v: r.sku, s: XS.num },
        [r.customerNotes, r.note].filter(Boolean).join(" · "),
        { v: r.status === "delivered" ? "✓" : r.status === "failed" ? "✗" : "", s: XS.num },
      ],
    })),
  ];
  if (!rows.length) sheetRows.push({ cells: ["Bu kunga yetkazish yo‘q"], style: XS.muted });
  xlsxHeaders(res, `yetkazish-${day}${slot ? "-" + slot : ""}${courier ? "-" + courier : ""}.xlsx`);
  res.send(buildXlsx([{
    name: "Yetkazish", cols: [5, 19, 9, 20, 18, 16, 38, 10, 7, 38, 5], rows: sheetRows, merges: ["A1:K1"],
    freezeRows: 2, autoFilter: rows.length ? `A2:K${rows.length + 2}` : undefined, landscape: true,
  }]));
});

/** Kitchen-only Excel: portions by ration / kcal and shift, plus allergies — no phones, no addresses. */
adminApi.get("/admin/kitchen.xlsx", async (req, res) => {
  const day = dayParam(req);
  const { kitchen, notes } = kitchenSummary(await deliveryRows(day));
  const tot = kitchen.reduce((a, k) => ({ m: a.m + k.morning, e: a.e + k.evening, t: a.t + k.total }), { m: 0, e: 0, t: 0 });
  const rows: XRow[] = [
    { cells: [`Oshxona varaqasi — ${dayLabel(day)}`], style: XS.title, height: 24 },
    { cells: [`kaloria.uz · jami ${tot.t} ta kunlik quti`], style: XS.muted },
    { cells: [] },
    { cells: ["Rasion", "Kkal", "Ertalab 08:00–10:00", "Kechki 18:00–22:30", "Jami"], style: XS.head, height: 20 },
    ...kitchen.map((k) => ({ style: XS.text, cells: [RATION_NAME[k.ration] ?? k.ration, { v: k.sku, s: XS.num }, { v: k.morning, s: XS.num }, { v: k.evening, s: XS.num }, { v: k.total, s: XS.num }] })),
    { cells: [{ v: "Jami", s: XS.totalLabel }, { v: "", s: XS.totalLabel }, { v: tot.m, s: XS.totalNum }, { v: tot.e, s: XS.totalNum }, { v: tot.t, s: XS.totalNum }] },
  ];
  if (!kitchen.length) rows.push({ cells: ["Bu kunga faol yetkazish yo‘q"], style: XS.muted });
  const merges = ["A1:E1", "A2:E2"];
  rows.push({ cells: [] }, { cells: ["⚠ Allergiya va izohlar"], style: XS.section, height: 20 });
  merges.push(`A${rows.length}:E${rows.length}`);
  if (!notes.length) {
    rows.push({ cells: ["Izoh yo‘q"], style: XS.muted });
  } else {
    rows.push({ cells: ["Mijoz", "Rasion · kkal", "Smena", "Izoh / allergiya", ""], style: XS.head, height: 20 });
    merges.push(`D${rows.length}:E${rows.length}`);
    for (const n of notes) {
      rows.push({
        height: Math.max(wrapHeight(n.text, 32), wrapHeight(n.name ?? "", 22)),
        cells: [{ v: n.name ?? "", s: XS.note }, { v: `${RATION_NAME[n.ration] ?? n.ration} ${n.sku}`, s: XS.note }, { v: n.deliverySlot === "evening" ? "Kechki" : "Ertalab", s: XS.note }, { v: n.text, s: XS.note }, { v: "", s: XS.note }],
      });
      merges.push(`D${rows.length}:E${rows.length}`);
    }
  }
  xlsxHeaders(res, `oshxona-${day}.xlsx`);
  res.send(buildXlsx([{ name: "Oshxona", cols: [22, 16, 20, 20, 12], rows, merges }]));
});

adminApi.get("/admin/delivery.csv", async (req, res) => {
  const day = dayParam(req);
  const slot = oneOf(DELIVERY_SLOTS, req.query["slot"]);
  const courier = oneOf(COURIER_TYPES, req.query["courier"]);
  const rows = (await deliveryRows(day)).filter((r) => (!slot || r.deliverySlot === slot) && (!courier || r.courierType === courier));
  // Spreadsheet-safe CSV: quote everything, neutralise formula prefixes.
  const cell = (v: unknown) => {
    let s = v == null ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const head = ["Sana", "Smena", "Kuryer", "Ism", "Telefon (+998)", "Tuman", "Manzil", "Kaloriya", "Rasion", "Izoh / allergiya"];
  // "97 777 88 99": stays text in Excel (a leading "+" would be read as a formula).
  const localPhone = (p: string) => p.replace(/^\+998(\d{2})(\d{3})(\d{2})(\d{2})$/, "$1 $2 $3 $4");
  const lines = rows.map((r) => [day, SLOT_LABEL[r.deliverySlot as DeliverySlot], r.courierType === "external" ? "Tashqi" : "Ichki", r.name, localPhone(r.phone), r.district, r.address, r.sku, r.ration, [r.customerNotes, r.note].filter(Boolean).join(" · ")].map(cell).join(","));
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="yetkazish-${day}${slot ? "-" + slot : ""}${courier ? "-" + courier : ""}.csv"`);
  res.send("﻿" + [head.map(cell).join(","), ...lines].join("\r\n"));
});

/** Per-day courier / shift override (e.g. this one evening goes to the external company). */
adminApi.patch("/admin/delivery-days/:id", async (req, res) => {
  const id = idParam(req);
  if (!id) { bad(res, "ID"); return; }
  const patch: Record<string, unknown> = {};
  if ("courierType" in (req.body ?? {})) { const v = oneOf(COURIER_TYPES, req.body.courierType); if (!v) { bad(res, "Kuryer turi noto‘g‘ri"); return; } patch["courierType"] = v; }
  if ("deliverySlot" in (req.body ?? {})) { const v = oneOf(DELIVERY_SLOTS, req.body.deliverySlot); if (!v) { bad(res, "Smena noto‘g‘ri"); return; } patch["deliverySlot"] = v; }
  if ("status" in (req.body ?? {})) {
    const v = oneOf(["delivered", "failed", "scheduled"] as const, req.body.status);
    if (!v) { bad(res, "Holat noto‘g‘ri"); return; }
    const [cur] = await db.select().from(deliveryDaysTable).where(eq(deliveryDaysTable.id, id)).limit(1);
    if (!cur) { res.status(404).json({ error: "Topilmadi" }); return; }
    if (cur.day > tashkentDate()) { bad(res, "Kelajakdagi kunni belgilab bo‘lmaydi — yetkazish kuni kelganda belgilang"); return; }
    if (!["scheduled", "locked", "delivered", "failed"].includes(cur.status)) { bad(res, "Bu kun muzlatilgan yoki bekor qilingan"); return; }
    patch["status"] = v;
  }
  if (!Object.keys(patch).length) { bad(res, "O‘zgarish yo‘q"); return; }
  const [day] = await db.update(deliveryDaysTable).set({ ...patch, updatedAt: new Date() }).where(eq(deliveryDaysTable.id, id)).returning();
  if (!day) { res.status(404).json({ error: "Topilmadi" }); return; }
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, day.orderId)).limit(1);
  if (order) await addEvent({ customerId: order.customerId, orderId: order.id, staffId: req.staff!.id, type: "delivery_change", body: `${day.day}: ${Object.entries(patch).map(([k, v]) => `${FIELD_LABEL[k] ?? k} — ${valueLabel(v)}`).join(", ")}` });
  res.json({ ok: true });
});

/** Active subscriptions with 1–2 delivery days left — call them to renew. */
adminApi.get("/admin/renewals", async (_req, res) => {
  const active = await db.select({ o: ordersTable, c: customersTable }).from(ordersTable)
    .innerJoin(customersTable, eq(customersTable.id, ordersTable.customerId))
    .where(and(eq(ordersTable.crmStatus, "active"), isNull(customersTable.archivedAt)));
  const prog = await orderProgress(active.map((r) => r.o.id));
  const items = active
    .map(({ o, c }) => ({ o, c, p: prog.get(o.id)! }))
    .filter(({ p }) => p.remaining >= 1 && p.remaining <= 2 && p.frozen === 0)
    .sort((a, b) => (a.p.lastDay ?? "").localeCompare(b.p.lastDay ?? ""))
    .map(({ o, c, p }) => ({ orderId: o.id, customerId: c.id, name: c.name, phone: c.phone, ration: o.ration, sku: o.sku, plan: o.plan, remaining: p.remaining, lastDay: p.lastDay, lastContactAt: c.lastContactAt }));
  res.json({ items });
});

// ─── Staff (owner only) ──────────────────────────────────────────────────────
adminApi.get("/admin/staff", requireOwner, async (_req, res) => {
  res.json({ items: await db.select().from(staffTable).orderBy(staffTable.createdAt) });
});
adminApi.post("/admin/staff", requireOwner, async (req, res) => {
  const name = str(req.body?.name, 60);
  const chat = String(req.body?.telegramChatId ?? "").trim();
  const role = oneOf(["owner", "manager"] as const, req.body?.role) ?? "manager";
  if (!name || !/^\d{3,20}$/.test(chat)) { bad(res, "Ism va Telegram ID (raqam) kerak"); return; }
  const [row] = await db.insert(staffTable).values({ name, telegramChatId: chat, role })
    .onConflictDoUpdate({ target: staffTable.telegramChatId, set: { name, role, active: true } }).returning();
  res.status(201).json({ staff: row });
});
adminApi.patch("/admin/staff/:id", requireOwner, async (req, res) => {
  const id = idParam(req);
  if (!id) { bad(res, "ID"); return; }
  if (id === req.staff!.id) { bad(res, "O‘zingizni o‘zgartira olmaysiz"); return; }
  const patch: Record<string, unknown> = {};
  if ("active" in (req.body ?? {})) patch["active"] = !!req.body.active;
  if ("role" in (req.body ?? {})) { const r = oneOf(["owner", "manager"] as const, req.body.role); if (!r) { bad(res, "Rol noto‘g‘ri"); return; } patch["role"] = r; }
  const [row] = await db.update(staffTable).set(patch).where(eq(staffTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Topilmadi" }); return; }
  res.json({ staff: row });
});
/** Remove a deactivated staff member completely (owner only). */
adminApi.delete("/admin/staff/:id", requireOwner, async (req, res) => {
  const id = idParam(req);
  if (!id) { bad(res, "ID"); return; }
  if (id === req.staff!.id) { bad(res, "O‘zingizni o‘chira olmaysiz"); return; }
  const [row] = await db.select().from(staffTable).where(eq(staffTable.id, id)).limit(1);
  if (!row) { res.status(404).json({ error: "Topilmadi" }); return; }
  if (row.active) { bad(res, "Avval xodimni faolsizlantiring"); return; }
  await db.execute(sql`DELETE FROM staff_login_tokens WHERE staff_id = ${id}`);
  await db.delete(staffTable).where(eq(staffTable.id, id));
  res.json({ ok: true });
});
