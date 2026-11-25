/**
 * Business settings the public website shows, all from environment variables
 * so prices and contacts change without a code deploy.
 *
 *   SITE_PRICES='{"ozish":159000,"balans":179000,"sport":209000}'   so'm per delivery day
 *   SITE_DISCOUNTS='{"d3":0,"w1":0,"w2":3,"w3":5,"w4":7,"m1":10}'    percent per plan
 *   MANAGER_TELEGRAM_URL=https://t.me/kaloria_uz
 *   MANAGER_PHONE=+998901234567
 *   META_PIXEL_ID, TIKTOK_PIXEL_ID                                  optional ad pixels
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

function cleanUrl(v: string | undefined): string {
  const s = v?.trim() ?? "";
  return /^https:\/\/[^\s"'<>]+$/.test(s) ? s : "";
}

export interface SiteConfig {
  prices: Record<RationKey, number>;
  discounts: Record<PlanKey, number>;
  planDays: Record<PlanKey, number>;
  telegram: string;
  phone: string;
  /** True while prices are the built-in samples, not set by the business. */
  samplePrices: boolean;
}

export function getSiteConfig(): SiteConfig {
  const phone = (process.env["MANAGER_PHONE"] ?? "").replace(/[^\d+]/g, "").slice(0, 16);
  return {
    prices: readJson("SITE_PRICES", DEFAULT_PRICES, 1_000, 10_000_000),
    discounts: readJson("SITE_DISCOUNTS", DEFAULT_DISCOUNTS, 0, 90),
    planDays: { ...PLAN_DAYS },
    telegram: cleanUrl(process.env["MANAGER_TELEGRAM_URL"]) || "https://t.me/",
    phone,
    samplePrices: !process.env["SITE_PRICES"]?.trim(),
  };
}

export function pixelIds(): { meta: string; tiktok: string } {
  const meta = process.env["META_PIXEL_ID"]?.trim() ?? "";
  const tiktok = process.env["TIKTOK_PIXEL_ID"]?.trim() ?? "";
  return {
    meta: /^\d{5,20}$/.test(meta) ? meta : "",
    tiktok: /^[A-Za-z0-9]{8,32}$/.test(tiktok) ? tiktok : "",
  };
}
