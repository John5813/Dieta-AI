import type { Customer, Lead, Order } from "@workspace/db";
import { mealPrice, mealsText } from "./meals";
import { logger } from "./logger";
import * as tg from "./telegram";
import { getSiteConfig, siteBaseUrl, PLAN_DAYS, type PlanKey, type RationKey } from "./siteConfig";

/**
 * Sends every new website lead (and every later plan choice) to the sales
 * team's Telegram chat: TELEGRAM_LEADS_CHAT_ID, or the admin chat if unset.
 */

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const INTENT_LABEL: Record<string, string> = {
  quiz: "🧮 Kalkulyatordan o‘tdi",
  test_drive: "🔥 3 kunlik SINOVNI tanladi",
  subscription: "📦 OBUNA tanladi",
  manager: "☎️ Menejer bog‘lansin",
};
const RATION_LABEL: Record<RationKey, string> = { ozish: "Ozish", balans: "Balans", sport: "Sport" };
const GOAL_LABEL: Record<string, string> = { ozish: "Ozish", saqlash: "Vaznni saqlash", oshirish: "Massa olish" };
export const DISTRICT_LABEL: Record<string, string> = {
  bektemir: "Bektemir", chilonzor: "Chilonzor", mirobod: "Mirobod", mirzo_ulugbek: "Mirzo Ulug‘bek", olmazor: "Olmazor",
  sergeli: "Sergeli", shayxontohur: "Shayxontohur", uchtepa: "Uchtepa", yakkasaroy: "Yakkasaroy", yangihayot: "Yangihayot",
  yashnobod: "Yashnobod", yunusobod: "Yunusobod", other: "Boshqa / viloyat",
};
const PLAN_LABEL: Record<PlanKey, string> = { d3: "3 kun (sinov)", w1: "1 hafta", w2: "2 hafta", w3: "3 hafta", w4: "4 hafta", m1: "1 oy" };

function chatId(): string {
  return (process.env["TELEGRAM_LEADS_CHAT_ID"] || tg.getAdminChatId() || "").trim();
}

export function buildLeadMessage(l: Lead, kind: "new" | "intent"): string {
  const lines: string[] = [];
  lines.push(`<b>${kind === "new" ? "🆕 Yangi lead" : "🔁 Lead yangilandi"} #${l.id}</b>`);
  lines.push(INTENT_LABEL[l.intent] ?? l.intent);
  lines.push("");
  lines.push(`👤 <b>${esc(l.name)}</b>`);
  lines.push(`📞 ${esc(l.phone)}`);
  lines.push(`🌐 Til: ${l.lang === "ru" ? "RU" : "UZ"}`);
  if (l.deliverySlot) lines.push(`🕒 Yetkazish: ${l.deliverySlot === "evening" ? "kechki 18:00–22:30" : "ertalabki 08:00–10:00"}`);
  if (l.district || l.address) {
    lines.push(`📍 ${[l.district ? DISTRICT_LABEL[l.district] ?? l.district : "", l.address ? esc(l.address) : ""].filter(Boolean).join(", ")}`);
  }
  if (l.calories) {
    lines.push("");
    lines.push(
      `⚖️ ${l.gender === "erkak" ? "Erkak" : "Ayol"}, ${l.age} yosh, ${l.height} sm, ${l.weight} kg · ${GOAL_LABEL[l.goal ?? ""] ?? l.goal}`,
    );
    lines.push(`🔥 <b>${l.calories} kkal</b> · B ${l.protein} / Y ${l.fat} / U ${l.carbs} g`);
    if (l.ration && l.sku) lines.push(`🍱 Mos rasion: <b>${RATION_LABEL[l.ration as RationKey] ?? l.ration} ${l.sku}</b>`);
  }
  if (l.healthRisk) lines.push("⚠️ <b>Sog‘lig‘ida cheklov bor</b> (diabet / buyrak / allergiya) — onlayn sotmang, maslahat bering");
  if (l.plan) {
    const plan = l.plan as PlanKey;
    const ration = (l.planRation ?? l.ration) as RationKey | null;
    let line = `🧾 Tanlov: ${PLAN_LABEL[plan] ?? plan}`;
    if (ration && RATION_LABEL[ration]) {
      const cfg = getSiteConfig();
      const days = PLAN_DAYS[plan];
      const total = Math.round((days * mealPrice(cfg.prices[ration], l.meals ?? 5) * (1 - (cfg.discounts[plan] ?? 0) / 100)) / 1000) * 1000;
      const meals = l.meals === 4 || l.meals === 3 ? l.meals : 5;
      line += ` · ${RATION_LABEL[ration]}${l.planSku ? " " + l.planSku : ""} · ${mealsText(meals)} · ${days} kun · ≈ ${total.toLocaleString("ru-RU")} so‘m`;
    }
    lines.push(line);
  }
  if (l.note) lines.push(`📝 Izoh / allergiya: ${esc(l.note)}`);
  const utm = [l.utmSource, l.utmMedium, l.utmCampaign, l.utmContent].filter(Boolean).map((s) => esc(String(s)));
  if (utm.length) lines.push(`📣 UTM: ${utm.join(" / ")}`);
  else if (l.referrer) lines.push(`↩️ Manba: ${esc(l.referrer)}`);
  if (l.customerId) lines.push(`\n👉 <a href="${siteBaseUrl()}/admin#c/${l.customerId}">CRM'da ochish</a>`);
  return lines.join("\n");
}

export async function notifyLead(l: Lead, kind: "new" | "intent"): Promise<void> {
  const chat = chatId();
  if (!chat || !process.env["TELEGRAM_BOT_TOKEN"]?.trim()) {
    logger.info({ leadId: l.id }, "lead saved (Telegram not configured, no notification)");
    return;
  }
  try {
    await tg.sendMessage(chat, buildLeadMessage(l, kind));
  } catch (err) {
    logger.warn({ err, leadId: l.id }, "lead Telegram notification failed");
  }
}

async function send(text: string, ctx: Record<string, unknown>): Promise<void> {
  const chat = chatId();
  if (!chat || !process.env["TELEGRAM_BOT_TOKEN"]?.trim()) { logger.info(ctx, "Telegram not configured, no notification"); return; }
  try { await tg.sendMessage(chat, text); } catch (err) { logger.warn({ err, ...ctx }, "Telegram notification failed"); }
}
const mapUrl = (lat: number, lng: number) => `https://maps.google.com/?q=${lat.toFixed(6)},${lng.toFixed(6)}`;
const place = (district?: string | null, address?: string | null) =>
  [district ? DISTRICT_LABEL[district] ?? district : "", address ? esc(address) : ""].filter(Boolean).join(", ");

/** Checkout blocked: the delivery point is outside Tashkent, or no location was shared → the manager calls. */
export async function notifyGeoBlocked(l: Lead): Promise<void> {
  const why = l.geoStatus === "outside"
    ? `📍 Yetkazish nuqtasi Toshkent shahridan <b>TASHQARIDA</b> (${l.geoSource === "map" ? "xaritada belgilangan" : "GPS"})`
    : "📍 Joylashuv aniqlanmadi / ruxsat berilmadi";
  const lines = [
    `<b>☎️ Qo‘ng‘iroq qiling — onlayn to‘lov ochilmadi</b> (ariza #${l.id})`, why, "",
    `👤 <b>${esc(l.name)}</b>`, `📞 ${esc(l.phone)}`,
  ];
  const pl = place(l.district, l.address);
  if (pl) lines.push(`🏠 ${pl}`);
  if (l.lat != null && l.lng != null) lines.push(`🗺 <a href="${mapUrl(l.lat, l.lng)}">Xaritada ochish</a>`);
  if (l.customerId) lines.push(`\n👉 <a href="${siteBaseUrl()}/admin#c/${l.customerId}">CRM'da ochish</a>`);
  await send(lines.join("\n"), { leadId: l.id });
}

/** A website order was paid (demo or live). */
export async function notifyPaidOrder(o: Order, c: Customer): Promise<void> {
  const prov = o.paymentProvider === "payme" ? "Payme" : o.paymentProvider === "click" ? "Click" : o.paymentProvider === "uzum" ? "Uzum" : o.paymentProvider ?? "";
  const lines = [
    `<b>✅ Saytda to‘landi${o.paymentMode === "demo" ? " (DEMO)" : ""} — ${esc(prov)}</b> · buyurtma #${o.id}`, "",
    `👤 <b>${esc(c.name ?? "")}</b>`, `📞 ${esc(c.phone)}`,
    `🍱 ${RATION_LABEL[o.ration as RationKey] ?? o.ration} ${o.sku} · ${mealsText(o.meals)} · ${PLAN_LABEL[o.plan as PlanKey] ?? o.plan} (${o.daysTotal} kun)`,
    `💰 ${o.amount.toLocaleString("ru-RU")} so‘m`,
    `🕒 ${o.deliverySlot === "evening" ? "kechki 18:00–22:30" : "ertalabki 08:00–10:00"} · boshlanish ${o.startDate}`,
  ];
  const pl = place(o.district, o.address);
  if (pl) lines.push(`🏠 ${pl}`);
  if (o.lat != null && o.lng != null) lines.push(`🗺 <a href="${mapUrl(o.lat, o.lng)}">Yetkazish nuqtasi</a>`);
  if (o.note) lines.push(`📝 ${esc(o.note)}`);
  lines.push(`\n👉 <a href="${siteBaseUrl()}/admin#c/${c.id}">CRM'da ochish</a>`);
  await send(lines.join("\n"), { orderId: o.id });
}
