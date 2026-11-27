import { mealPricing, type MealPricing } from "./meals";
import { paymentsForSite } from "./checkout/providers";
/**
 * Business settings the public website shows, all from environment variables
 * so prices and contacts change without a code deploy.
 *
 *   SITE_PRICES='{"ozish":159000,"balans":179000,"sport":209000}'   so'm per delivery day
 *   SITE_DISCOUNTS='{"d3":0,"w1":0,"w2":3,"w3":5,"w4":7,"m1":10}'    percent per plan
 *   MANAGER_TELEGRAM_URL=https://t.me/kaloria_uz
 *   MANAGER_PHONE=+998901234567
 *   META_PIXEL_ID, TIKTOK_PIXEL_ID, YANDEX_METRIKA_ID               optional analytics
 *   MERCHANT_LEGAL_NAME, MERCHANT_INN, MERCHANT_ADDRESS               seller details (footer, offer)
 *   SITE_DELIVERY_UZ / SITE_DELIVERY_RU                               delivery area and price text
 *   SITE_KITCHEN_UZ/RU, SITE_DIETITIAN_UZ/RU, SITE_INSTAGRAM_URL       trust block; hidden while empty
 */

export type RationKey = "ozish" | "balans" | "sport";
export type PlanKey = "d3" | "w1" | "w2" | "w3" | "w4" | "m1";

/** Delivery days per plan. Sunday is a day off, so a week has 6 deliveries. */
export const PLAN_DAYS: Record<PlanKey, number> = { d3: 3, w1: 6, w2: 12, w3: 18, w4: 24, m1: 26 };

const DEFAULT_PRICES: Record<RationKey, number> = { ozish: 159_000, balans: 179_000, sport: 209_000 };
const DEFAULT_DISCOUNTS: Record<PlanKey, number> = { d3: 0, w1: 0, w2: 3, w3: 5, w4: 7, m1: 10 };

function readJson<T extends Record<string, number>>(name: string, fallback: T, min: number, max: number): T {
  const raw = process.env[name]?.trim();
  if (!raw) return { ...fallback };
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out = { ...fallback };
    for (const k of Object.keys(fallback)) {
      const v = Number(parsed[k]);
      if (Number.isFinite(v) && v >= min && v <= max) (out as Record<string, number>)[k] = Math.round(v);
    }
    return out;
  } catch {
    return { ...fallback };
  }
}

function telegramUrl(): string {
  const raw = (process.env["MANAGER_TELEGRAM_URL"] || process.env["MERCHANT_TELEGRAM"] || "").trim();
  const handle = raw.replace(/^@/, "");
  const url = /^[A-Za-z0-9_]{4,32}$/.test(handle) ? `https://t.me/${handle}` : cleanUrl(raw);
  // A bare "https://t.me/" opens nothing, so treat it as not configured.
  return /^https:\/\/t\.me\/.+/.test(url) ? url : "";
}

function cleanUrl(v: string | undefined): string {
  const s = v?.trim() ?? "";
  return /^https:\/\/[^\s"'<>]+$/.test(s) ? s : "";
}

export interface SiteConfig {
  baseUrl: string;
  mealDiscounts: MealPricing;
  payments: ReturnType<typeof paymentsForSite>;
  prices: Record<RationKey, number>;
  discounts: Record<PlanKey, number>;
  planDays: Record<PlanKey, number>;
  telegram: string;
  phone: string;
  /** True while prices are the built-in samples, not set by the business. */
  samplePrices: boolean;
  company: { name: string; inn: string; address: string };
  /** Optional texts the business fills in; empty means "hide this block". */
  text: {
    delivery: { uz: string; ru: string };
    kitchen: { uz: string; ru: string };
    dietitian: { uz: string; ru: string };
  };
  instagram: string;
}

const envText = (k: string, max = 300) => (process.env[k] ?? "").replace(/[<>]/g, "").trim().slice(0, max);
const pair = (k: string) => ({ uz: envText(`${k}_UZ`), ru: envText(`${k}_RU`) || envText(`${k}_UZ`) });

/** Public https origin of the site, used for canonical links, og:image and the sitemap. */
export function siteBaseUrl(): string {
  const v = (process.env["PUBLIC_BASE_URL"] ?? "").trim().replace(/\/+$/, "");
  return /^https:\/\/[a-z0-9.-]+$/i.test(v) ? v : "https://kaloria.uz";
}

export function getSiteConfig(): SiteConfig {
  const phone = (process.env["MANAGER_PHONE"] || process.env["MERCHANT_PHONE"] || "").replace(/[^\d+]/g, "").slice(0, 16);
  return {
    baseUrl: siteBaseUrl(),
    prices: readJson("SITE_PRICES", DEFAULT_PRICES, 1_000, 10_000_000),
    discounts: readJson("SITE_DISCOUNTS", DEFAULT_DISCOUNTS, 0, 90),
    planDays: { ...PLAN_DAYS },
    // Empty until a real channel is configured — the site then hides every Telegram button.
    telegram: telegramUrl(),
    phone,
    samplePrices: !process.env["SITE_PRICES"]?.trim(),
    company: { name: envText("MERCHANT_LEGAL_NAME", 120), inn: envText("MERCHANT_INN", 20), address: envText("MERCHANT_ADDRESS", 200) },
    text: { delivery: pair("SITE_DELIVERY"), kitchen: pair("SITE_KITCHEN"), dietitian: pair("SITE_DIETITIAN") },
    instagram: cleanUrl(process.env["SITE_INSTAGRAM_URL"]),
    /** Percent off the day price for 4 and 3 meals (−10% / −20% by default; edited in the CRM). */
    mealDiscounts: mealPricing(),
    /** Online checkout: demo (default) or live, and the providers that can take a payment. */
    payments: paymentsForSite(),
  };
}

export function pixelIds(): { meta: string; tiktok: string; metrika: string } {
  const meta = process.env["META_PIXEL_ID"]?.trim() ?? "";
  const tiktok = process.env["TIKTOK_PIXEL_ID"]?.trim() ?? "";
  const metrika = process.env["YANDEX_METRIKA_ID"]?.trim() ?? "";
  return {
    meta: /^\d{5,20}$/.test(meta) ? meta : "",
    tiktok: /^[A-Za-z0-9]{8,32}$/.test(tiktok) ? tiktok : "",
    metrika: /^\d{5,12}$/.test(metrika) ? metrika : "",
  };
}
