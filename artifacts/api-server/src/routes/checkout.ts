/**
 * Website checkout (public): location check → online payment → CRM customer + paid subscription.
 *   GET  /api/v1/geo/tashkent            city boundary for the map
 *   POST /api/v1/leads/:id/location       { key, lat, lng, accuracy?, source: gps|map } | { key, status: "denied" }
 *   POST /api/v1/checkout                 { leadId, key, provider: payme|click|uzum }
 */
import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, leadsTable, customersTable } from "@workspace/db";
import { rateLimit } from "../lib/guard";
import { logger } from "../lib/logger";
import { addEvent } from "../lib/crm";
import { mealsText } from "../lib/meals";
import { inTashkent, isValidCoord, mapLink } from "../lib/geo";
import { TASHKENT_CITY } from "../lib/geo/tashkentBoundary";
import { getProvider, paymentMode } from "../lib/checkout/providers";
import { canPay, leadByKey, markOrderPaid, orderForLead } from "../lib/checkout/service";
import { notifyGeoBlocked, notifyPaidOrder } from "../lib/leadNotify";
import { publicBaseUrl } from "../lib/pay/config";

const router: IRouter = Router();
const bad = (res: import("express").Response, error: string, code = "bad_request", status = 400) => res.status(status).json({ error, code });

router.get("/v1/geo/tashkent", (_req, res) => {
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.json({ city: TASHKENT_CITY, center: [41.3111, 69.2797], attribution: "© OpenStreetMap contributors" });
});

router.post("/v1/leads/:id/location", rateLimit("lead-location", 30, 60 * 60 * 1000), async (req, res) => {
  const b = (req.body ?? {}) as Record<string, unknown>;
  const lead = await leadByKey(Number(req.params["id"]), b["key"]);
  if (!lead) { bad(res, "Topilmadi", "not_found", 404); return; }
  let patch: Partial<typeof leadsTable.$inferInsert>;
  if (b["status"] === "denied" || b["status"] === "unavailable") {
    patch = { geoStatus: "denied", geoSource: "gps", geoAt: new Date() };
  } else {
    const lat = Number(b["lat"]), lng = Number(b["lng"]);
    if (!isValidCoord(lat, lng)) { bad(res, "Koordinata noto‘g‘ri"); return; }
    const acc = Number(b["accuracy"]);
    patch = {
      lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6, geoAccuracy: Number.isFinite(acc) && acc >= 0 ? Math.round(acc) : null,
      geoStatus: inTashkent(lat, lng) ? "inside" : "outside", geoSource: b["source"] === "map" ? "map" : "gps", geoAt: new Date(),
    };
  }
  const [row] = await db.update(leadsTable).set({ ...patch, updatedAt: new Date() }).where(eq(leadsTable.id, lead.id)).returning();
  const l = row!;
  if (l.customerId) {
    const label = l.geoStatus === "inside" ? "Toshkent ichida" : l.geoStatus === "outside" ? "Toshkentdan TASHQARIDA" : "aniqlanmadi / ruxsat berilmadi";
    await addEvent({ customerId: l.customerId, leadId: l.id, type: "lead", body: `📍 Joylashuv (${l.geoSource === "map" ? "xarita" : "GPS"}): ${label}`, meta: l.lat != null && l.lng != null && l.geoStatus !== "denied" ? { lat: l.lat, lng: l.lng, map: mapLink(l.lat, l.lng) } : null });
  }
  // Blocked → the manager gets the request (once per status change) and calls.
  if (l.geoStatus !== "inside" && lead.geoStatus !== l.geoStatus) void notifyGeoBlocked(l);
  res.json({ status: l.geoStatus, canPay: canPay(l) });
});

router.post("/v1/checkout", rateLimit("checkout", 20, 60 * 60 * 1000), async (req, res) => {
  const b = (req.body ?? {}) as Record<string, unknown>;
  const lead = await leadByKey(Number(b["leadId"]), b["key"]);
  if (!lead) { bad(res, "Topilmadi", "not_found", 404); return; }
  if (lead.intent !== "test_drive" && lead.intent !== "subscription") { bad(res, "Bu so‘rov uchun to‘lov yo‘q — menejer bog‘lanadi", "no_payment"); return; }
  if (!canPay(lead)) { bad(res, "Yetkazish nuqtasi Toshkent shahri ichida tasdiqlanmagan", "outside_tashkent", 403); return; }
  const provider = getProvider(b["provider"]);
  if (!provider) { bad(res, paymentMode() === "live" ? "Bu to‘lov tizimi hali ulanmagan" : "To‘lov usulini tanlang", "provider"); return; }
  try {
    const { order, customer } = await orderForLead(lead);
    let paid = order;
    if (order.paymentStatus !== "paid") {
      const r = await provider.start({ orderId: order.id, amount: order.amount, description: `kaloria.uz #${order.id}`, returnUrl: `${publicBaseUrl(req.get("host"))}/?paid=${order.id}` });
      if (r.status === "redirect") { res.json({ status: "redirect", url: r.url, orderId: order.id }); return; }
      paid = await markOrderPaid(order, provider, r.ref);
      const [c] = await db.select().from(customersTable).where(eq(customersTable.id, customer.id)).limit(1);
      void notifyPaidOrder(paid, c ?? customer);
    }
    res.json({
      status: "paid", mode: paid.paymentMode, provider: paid.paymentProvider, ref: paid.paymentRef,
      order: { id: paid.id, ration: paid.ration, sku: paid.sku, plan: paid.plan, days: paid.daysTotal, meals: paid.meals, mealsText: mealsText(paid.meals), amount: paid.amount, startDate: paid.startDate, deliverySlot: paid.deliverySlot },
    });
  } catch (err) {
    logger.error({ err, leadId: lead.id }, "checkout failed");
    bad(res, "Server xatoligi. Qaytadan urinib ko‘ring.", "server_error", 500);
  }
});

export default router;
