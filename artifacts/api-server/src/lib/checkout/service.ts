/**
 * Website checkout: a lead whose delivery point is inside Tashkent becomes a CRM customer
 * with a subscription (order) that is paid through a provider (demo or live).
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db, leadsTable, customersTable, ordersTable, type Lead, type Order, type Customer } from "@workspace/db";
import { SKUS, addEvent, defaultStartDate, quote, rebuildSchedule, upsertCustomer } from "../crm";
import { mealsOf, mealsText } from "../meals";
import { inTashkent, mapLink } from "../geo";
import { type MealPaymentProvider } from "./providers";
import { type PlanKey, type RationKey } from "../siteConfig";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

/** The lead, if `key` is the secret the browser got when it was created. */
export async function leadByKey(id: number, key: unknown): Promise<Lead | null> {
  if (!Number.isSafeInteger(id) || id <= 0 || typeof key !== "string" || !key) return null;
  const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, id)).limit(1);
  if (!lead) return null;
  const a = Buffer.from(lead.keyHash ?? "", "hex"), b = Buffer.from(sha(key), "hex");
  return a.length === b.length && timingSafeEqual(a, b) ? lead : null;
}

/** Payment is allowed only for a delivery point the server itself found inside Tashkent. */
export function canPay(lead: Lead): boolean {
  return lead.geoStatus === "inside" && lead.lat != null && lead.lng != null && inTashkent(lead.lat, lead.lng);
}

const RATIONS: RationKey[] = ["ozish", "balans", "sport"];
const PLANS: PlanKey[] = ["d3", "w1", "w2", "w3", "w4", "m1"];

/** What the lead chose on the website, with safe defaults. */
export function leadChoice(lead: Lead) {
  const ration = (RATIONS.includes(lead.planRation as RationKey) ? lead.planRation : RATIONS.includes(lead.ration as RationKey) ? lead.ration : "balans") as RationKey;
  const skus = SKUS[ration];
  const sku = [lead.planSku, lead.sku].find((s) => s != null && skus.includes(s)) ?? skus[0]!;
  const plan = (lead.intent === "test_drive" ? "d3" : PLANS.includes(lead.plan as PlanKey) ? lead.plan : "w1") as PlanKey;
  const meals = mealsOf(lead.meals) ?? 5;
  return { ration, sku, plan, meals };
}

/** Creates (or returns the open one) the website order for this lead, awaiting payment. */
export async function orderForLead(lead: Lead): Promise<{ order: Order; customer: Customer }> {
  const customer = await upsertCustomer(lead.phone, {
    name: lead.name, lang: lead.lang, district: lead.district, address: lead.address, deliverySlot: lead.deliverySlot as never, source: "web",
    utmSource: lead.utmSource, utmCampaign: lead.utmCampaign,
  });
  // The point checked at checkout is the delivery point.
  const [cust] = await db.update(customersTable)
    .set({ lat: lead.lat, lng: lead.lng, ...(lead.meals ? { meals: lead.meals } : {}), updatedAt: new Date() })
    .where(eq(customersTable.id, customer.id)).returning();
  const [open] = await db.select().from(ordersTable).where(and(eq(ordersTable.leadId, lead.id), eq(ordersTable.source, "web"))).orderBy(desc(ordersTable.createdAt)).limit(1);
  if (open && open.crmStatus !== "cancelled") return { order: open, customer: cust! };

  const c = leadChoice(lead);
  const q = quote(c.ration, c.plan, undefined, undefined, 0, c.meals);
  const [order] = await db.insert(ordersTable).values({
    customerId: customer.id, leadId: lead.id, source: "web",
    ration: c.ration, sku: c.sku, plan: c.plan, meals: c.meals,
    daysTotal: q.days, pricePerDay: q.pricePerDay, discountPct: q.discountPct, amount: q.amount, paidAmount: 0,
    paymentStatus: "pending", crmStatus: "awaiting_payment", startDate: defaultStartDate(),
    deliverySlot: lead.deliverySlot === "evening" ? "evening" : "morning", courierType: "internal",
    district: lead.district, address: lead.address, lat: lead.lat, lng: lead.lng, note: lead.note,
  }).returning();
  await rebuildSchedule(order!);
  await addEvent({
    customerId: customer.id, orderId: order!.id, leadId: lead.id, type: "order_created",
    body: `Saytda buyurtma: ${c.ration} ${c.sku} · ${mealsText(c.meals)} · ${c.plan} · boshlanish ${order!.startDate}`,
    meta: { source: "web", amount: q.amount, lat: lead.lat, lng: lead.lng },
  });
  return { order: order!, customer: cust! };
}

/**
 * Marks a website order paid: active subscription (goes to delivery + kitchen lists).
 * Called right away in demo mode, and by a merchant webhook once live providers are connected.
 */
export async function markOrderPaid(order: Order, provider: MealPaymentProvider, ref: string): Promise<Order> {
  if (order.paymentStatus === "paid") return order;
  const [paid] = await db.update(ordersTable).set({
    paymentStatus: "paid", paidAmount: order.amount, crmStatus: "active",
    paymentProvider: provider.id, paymentMode: provider.mode, paymentRef: ref, paidAt: new Date(), updatedAt: new Date(),
  }).where(eq(ordersTable.id, order.id)).returning();
  if (order.leadId) await db.update(leadsTable).set({ status: "converted", paymentStatus: "paid", updatedAt: new Date() }).where(eq(leadsTable.id, order.leadId));
  await addEvent({
    customerId: order.customerId, orderId: order.id, leadId: order.leadId, type: "order_updated",
    body: `To‘landi: ${provider.id === "payme" ? "Payme" : provider.id === "click" ? "Click" : "Uzum"}${provider.mode === "demo" ? " (demo)" : ""} · ${order.amount.toLocaleString("ru-RU")} so‘m · ${ref}`,
    meta: { provider: provider.id, mode: provider.mode, ref, lat: order.lat, lng: order.lng, map: order.lat != null && order.lng != null ? mapLink(order.lat, order.lng) : null },
  });
  return paid!;
}
