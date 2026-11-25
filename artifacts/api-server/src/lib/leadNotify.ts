import type { Lead } from "@workspace/db";
import { logger } from "./logger";
import * as tg from "./telegram";
import { getSiteConfig, PLAN_DAYS, type PlanKey, type RationKey } from "./siteConfig";

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
const DISTRICT_LABEL: Record<string, string> = {
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
      const total = Math.round((days * cfg.prices[ration] * (1 - (cfg.discounts[plan] ?? 0) / 100)) / 1000) * 1000;
      line += ` · ${RATION_LABEL[ration]} · ${days} kun · ≈ ${total.toLocaleString("ru-RU")} so‘m`;
    }
    lines.push(line);
  }
  const utm = [l.utmSource, l.utmMedium, l.utmCampaign, l.utmContent].filter(Boolean).map((s) => esc(String(s)));
  if (utm.length) lines.push(`📣 UTM: ${utm.join(" / ")}`);
  else if (l.referrer) lines.push(`↩️ Manba: ${esc(l.referrer)}`);
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
