import { and, eq, inArray, sql } from "drizzle-orm";
import {
  db, customersTable, crmEventsTable, ordersTable, deliveryDaysTable,
  type Customer, type Order, type DeliverySlot, type CourierType,
} from "@workspace/db";
import { PLAN_DAYS, getSiteConfig, type PlanKey, type RationKey } from "./siteConfig";

/** Tashkent is UTC+5 all year (no DST). */
const TZ_OFFSET_MS = 5 * 60 * 60 * 1000;
/** After this hour (Tashkent) tomorrow's deliveries are locked. */
export const CUTOFF_HOUR = 18;

export const SKUS: Record<RationKey, number[]> = { ozish: [1200, 1400], balans: [1600, 1900], sport: [2200, 2500] };
export const SLOT_LABEL: Record<DeliverySlot, string> = { morning: "08:00–10:00", evening: "18:00–22:30" };

/** YYYY-MM-DD for a moment, in Tashkent time. */
export function tashkentDate(at: Date = new Date()): string {
  return new Date(at.getTime() + TZ_OFFSET_MS).toISOString().slice(0, 10);
}
export function tashkentHour(at: Date = new Date()): number {
  return new Date(at.getTime() + TZ_OFFSET_MS).getUTCHours();
}
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export const isSunday = (day: string) => new Date(`${day}T00:00:00Z`).getUTCDay() === 0;
export const isIsoDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));

/** Default first delivery: tomorrow if it's before 18:00 in Tashkent, else the day after; never a Sunday. */
export function defaultStartDate(at: Date = new Date()): string {
  let day = addDays(tashkentDate(at), tashkentHour(at) < CUTOFF_HOUR ? 1 : 2);
  while (isSunday(day)) day = addDays(day, 1);
  return day;
}

/** `count` delivery dates from `start`, skipping Sundays. */
export function scheduleDays(start: string, count: number): string[] {
  const out: string[] = [];
  let day = start;
  while (out.length < count) {
    if (!isSunday(day)) out.push(day);
    day = addDays(day, 1);
  }
  return out;
}

/** Price of an order; `daysOverride` is a manager-set number of delivery days (e.g. a custom plan). */
export function quote(ration: RationKey, plan: PlanKey, pricePerDay?: number, daysOverride?: number) {
  const cfg = getSiteConfig();
  const days = daysOverride ?? PLAN_DAYS[plan];
  const price = pricePerDay ?? cfg.prices[ration];
  const discountPct = cfg.discounts[plan] ?? 0;
  const amount = Math.round((days * price * (1 - discountPct / 100)) / 1000) * 1000;
  return { days, pricePerDay: price, discountPct, amount };
}

/**
 * Finds the customer for a phone number or creates one. Empty fields are
 * filled from `data`; existing values are kept unless `overwrite` is set
 * (a manager editing the card).
 */
export async function upsertCustomer(
  phone: string,
  data: Partial<Pick<Customer, "name" | "lang" | "district" | "address" | "deliverySlot" | "utmSource" | "utmCampaign">> & { source?: string },
  overwrite = false,
): Promise<Customer> {
  const [existing] = await db.select().from(customersTable).where(eq(customersTable.phone, phone)).limit(1);
  if (!existing) {
    const [row] = await db
      .insert(customersTable)
      .values({
        phone,
        name: data.name ?? null,
        lang: data.lang ?? "uz",
        district: data.district ?? null,
        address: data.address ?? null,
        deliverySlot: data.deliverySlot ?? null,
        firstSource: data.source ?? "web",
        utmSource: data.utmSource ?? null,
        utmCampaign: data.utmCampaign ?? null,
      })
      .onConflictDoNothing({ target: customersTable.phone })
      .returning();
    if (row) return row;
    // Lost a race with a parallel insert of the same phone.
    const [again] = await db.select().from(customersTable).where(eq(customersTable.phone, phone)).limit(1);
    return again!;
  }
  const pick = <K extends keyof typeof data>(k: K, cur: unknown) =>
    data[k] != null && data[k] !== "" && (overwrite || cur == null || cur === "") ? data[k] : undefined;
  const patch: Record<string, unknown> = {};
  // A new request from an archived customer brings them back.
  if (existing.archivedAt) patch["archivedAt"] = null;
  for (const k of ["name", "district", "address", "deliverySlot"] as const) {
    const v = pick(k, existing[k]);
    if (v !== undefined) patch[k] = v;
  }
  if (!Object.keys(patch).length) return existing;
  const [row] = await db.update(customersTable).set({ ...patch, updatedAt: new Date() }).where(eq(customersTable.id, existing.id)).returning();
  return row!;
}

export async function addEvent(e: {
  customerId: number; type: string; body?: string | null; orderId?: number | null; leadId?: number | null;
  staffId?: number | null; meta?: Record<string, unknown> | null;
}): Promise<void> {
  await db.insert(crmEventsTable).values({
    customerId: e.customerId, type: e.type, body: e.body ?? null, orderId: e.orderId ?? null,
    leadId: e.leadId ?? null, staffId: e.staffId ?? null, meta: e.meta ?? null,
  });
  if (e.type === "call" || e.type === "note") {
    await db.update(customersTable).set({ lastContactAt: new Date() }).where(eq(customersTable.id, e.customerId));
  }
}

/** First delivery day that can still be changed: tomorrow before 18:00 (Tashkent), the day after once 18:00 has passed. */
export function firstEditableDay(at: Date = new Date()): string {
  return addDays(tashkentDate(at), tashkentHour(at) < CUTOFF_HOUR ? 1 : 2);
}

/**
 * Keeps an order's schedule at exactly `daysTotal` delivery days. Delivered,
 * skipped, locked and upcoming days count; frozen / cancelled / burned days do
 * not, so freezing a day appends one at the end and unfreezing trims one.
 * `reset` (start date changed) drops the future, not-yet-locked days first.
 */
export async function rebuildSchedule(order: Order, opts: { reset?: boolean } = {}): Promise<void> {
  const today = tashkentDate();
  if (opts.reset) {
    await db.delete(deliveryDaysTable).where(and(
      eq(deliveryDaysTable.orderId, order.id), inArray(deliveryDaysTable.status, ["scheduled", "frozen"]), sql`${deliveryDaysTable.day} > ${today}`,
    ));
  }
  const rows = await db.select({ id: deliveryDaysTable.id, day: deliveryDaysTable.day, status: deliveryDaysTable.status })
    .from(deliveryDaysTable).where(eq(deliveryDaysTable.orderId, order.id)).orderBy(deliveryDaysTable.day);
  const counting = rows.filter((r) => !["frozen", "cancelled", "burned"].includes(r.status));
  const need = order.daysTotal - counting.length;
  if (need > 0) {
    const taken = new Set(rows.map((r) => r.day));
    const last = counting.length ? counting[counting.length - 1]!.day : null;
    let cursor = [order.startDate, today, last ? addDays(last, 1) : ""].sort().pop()!;
    const add: string[] = [];
    while (add.length < need) {
      if (!isSunday(cursor) && !taken.has(cursor)) add.push(cursor);
      cursor = addDays(cursor, 1);
    }
    await db.insert(deliveryDaysTable).values(add.map((day) => ({
      orderId: order.id, day, deliverySlot: order.deliverySlot, courierType: order.courierType,
      district: order.district, address: order.address, sku: order.sku,
    }))).onConflictDoNothing();
  } else if (need < 0) {
    const removable = rows.filter((r) => r.status === "scheduled" && r.day > today).slice(need); // latest ones
    if (removable.length) await db.delete(deliveryDaysTable).where(inArray(deliveryDaysTable.id, removable.map((r) => r.id)));
  }
}

/** Freezes the order's open days in [from, to]; each frozen day is added back at the end and must be used within 30 days. */
export async function freezeDays(order: Order, from: string, to: string): Promise<number> {
  const rows = await db.update(deliveryDaysTable)
    .set({ status: "frozen", frozenAt: new Date(), burnAt: new Date(Date.now() + 30 * 864e5), updatedAt: new Date() })
    .where(and(
      eq(deliveryDaysTable.orderId, order.id), eq(deliveryDaysTable.status, "scheduled"),
      sql`${deliveryDaysTable.day} >= ${from}`, sql`${deliveryDaysTable.day} <= ${to}`,
    ))
    .returning({ id: deliveryDaysTable.id });
  if (rows.length) await rebuildSchedule(order);
  return rows.length;
}

/** Puts a frozen (not yet locked) day back on the schedule and trims the extra day at the end. */
export async function unfreezeDay(order: Order, dayId: number): Promise<boolean> {
  const [row] = await db.update(deliveryDaysTable)
    .set({ status: "scheduled", frozenAt: null, burnAt: null, updatedAt: new Date() })
    .where(and(eq(deliveryDaysTable.id, dayId), eq(deliveryDaysTable.orderId, order.id), eq(deliveryDaysTable.status, "frozen"), sql`${deliveryDaysTable.day} >= ${firstEditableDay()}`))
    .returning({ id: deliveryDaysTable.id });
  if (!row) return false;
  await rebuildSchedule(order);
  return true;
}

/** Applies slot / courier / address changes to an order's future, still-open days. */
export async function updateFutureDays(orderId: number, patch: { deliverySlot?: DeliverySlot; courierType?: CourierType; district?: string | null; address?: string | null; sku?: number }) {
  if (!Object.keys(patch).length) return;
  const today = tashkentDate();
  await db
    .update(deliveryDaysTable)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(deliveryDaysTable.orderId, orderId), inArray(deliveryDaysTable.status, ["scheduled", "frozen"]), sql`${deliveryDaysTable.day} > ${today}`));
}

export interface OrderProgress {
  remaining: number; delivered: number; skipped: number; frozen: number;
  nextDay: string | null; lastDay: string | null; nextFrozen: boolean;
  frozenDays: { id: number; day: string; burnAt: Date | null }[];
}

/** Per-order day counters relative to today (Tashkent). Unmarked past days count as delivered. */
export async function orderProgress(orderIds: number[]): Promise<Map<number, OrderProgress>> {
  const map = new Map<number, OrderProgress>();
  if (!orderIds.length) return map;
  const today = tashkentDate();
  const rows = await db
    .select({ id: deliveryDaysTable.id, orderId: deliveryDaysTable.orderId, day: deliveryDaysTable.day, status: deliveryDaysTable.status, burnAt: deliveryDaysTable.burnAt })
    .from(deliveryDaysTable)
    .where(inArray(deliveryDaysTable.orderId, orderIds))
    .orderBy(deliveryDaysTable.day);
  for (const id of orderIds) map.set(id, { remaining: 0, delivered: 0, skipped: 0, frozen: 0, nextDay: null, lastDay: null, nextFrozen: false, frozenDays: [] });
  for (const r of rows) {
    const p = map.get(r.orderId)!;
    if (r.status === "cancelled" || r.status === "burned") continue;
    if (r.status === "frozen") {
      p.frozen++; p.frozenDays.push({ id: r.id, day: r.day, burnAt: r.burnAt });
      if (!p.nextDay && r.day >= today) { p.nextDay = r.day; p.nextFrozen = true; }
      continue;
    }
    if (r.status === "failed") p.skipped++;
    else if (r.status === "delivered" || r.day < today) p.delivered++;
    else { p.remaining++; if (!p.nextDay) p.nextDay = r.day; }
    p.lastDay = r.day;
  }
  return map;
}

/** Status shown in the CRM: the stored pipeline status, refined by the schedule for active orders. */
export function displayStatus(o: Pick<Order, "crmStatus">, p?: OrderProgress): string {
  if (o.crmStatus !== "active" || !p) return o.crmStatus;
  if (p.remaining === 0 && p.frozen === 0) return "finished";
  if (p.nextFrozen) return "frozen";
  if (p.remaining <= 2) return "ending";
  return "active";
}

/**
 * Free app Premium for meal customers (used from phase D): a paid, active
 * subscription unlocks Premium until the end of its last delivery day.
 * Returns null when the customer has no such subscription.
 */
export async function mealPremiumUntil(customerId: number): Promise<Date | null> {
  const [row] = await db.execute<{ last_day: string | null }>(sql`
    SELECT max(d.day)::text AS last_day
    FROM delivery_days d JOIN orders o ON o.id = d.order_id
    WHERE o.customer_id = ${customerId} AND o.payment_status = 'paid' AND o.crm_status = 'active'
      AND d.status NOT IN ('cancelled', 'burned')
  `).then((r) => r.rows);
  if (!row?.last_day) return null;
  // End of the last delivery day in Tashkent = next day 00:00 Tashkent.
  const until = new Date(Date.parse(`${addDays(row.last_day, 1)}T00:00:00Z`) - TZ_OFFSET_MS);
  return until.getTime() > Date.now() ? until : null;
}
