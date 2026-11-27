/**
 * Kitchen: special portions catalog (2x go'sht, garnirsiz…), the weekly menu with product
 * grams per calorie option, and the daily cooking report built from the delivery list.
 */
import { asc, sql } from "drizzle-orm";
import { db, kitchenExtrasTable, kitchenMenuTable, type ExtraItem, type KitchenExtra, type KitchenMeal, type MenuItem } from "@workspace/db";
import { logger } from "./logger";

export const SKU_LIST = [1200, 1400, 1600, 1900, 2200, 2500] as const;
export const MEALS = [
  { label: "Nonushta", time: "08:00" },
  { label: "Perekus", time: "11:00" },
  { label: "Tushlik", time: "13:30" },
  { label: "Perekus", time: "16:30" },
  { label: "Kechki ovqat", time: "19:30" },
] as const;
export const WEEKDAYS = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"] as const;
export const ROLES = ["protein", "side", "other"] as const;
export const ROLE_LABEL: Record<string, string> = { protein: "Asosiy oqsil", side: "Garnir", other: "Boshqa" };

/** kcal per meal for every calorie option — the same sample day the website shows. */
const KC: Record<number, number[]> = {
  1200: [280, 120, 380, 110, 310], 1400: [320, 140, 440, 130, 370], 1600: [360, 170, 500, 160, 410],
  1900: [430, 200, 590, 190, 490], 2200: [480, 250, 680, 240, 550], 2500: [550, 280, 770, 270, 630],
};

// ── seed: special portions ──
const EXTRAS_SEED: Omit<KitchenExtra, "updatedAt" | "active">[] = [
  { code: "double_meat", label: "2x go‘sht", price: 25000, target: "protein", mode: "add", value: 1, sort: 1 },
  { code: "more_protein", label: "+Oqsil", price: 15000, target: "protein", mode: "add", value: 0.5, sort: 2 },
  { code: "less_side", label: "Garnir kamroq", price: 0, target: "side", mode: "set", value: 0.5, sort: 3 },
  { code: "no_side", label: "Garnirsiz", price: 0, target: "side", mode: "set", value: 0, sort: 4 },
  { code: "lactose_free", label: "Laktozasiz", price: 0, target: null, mode: null, value: 0, sort: 5 },
  { code: "nut_free", label: "Yong‘oqsiz", price: 0, target: null, mode: null, value: 0, sort: 6 },
];

// ── seed: weekly menu built from the dishes shown on the website ──
type Dish = { name: string; ref: number; items: [string, MenuItem["role"], number][] };
// `ref` = kcal of the dish at 1600 in its usual meal; grams are for that portion and scale with kcal.
const D: Record<string, Dish> = {
  avo: { name: "Avokado-tost va tuxum", ref: 360, items: [["Tuxum", "other", 110], ["Avokado", "other", 50], ["Javdar noni", "side", 60]] },
  omlet: { name: "Omlet va sabzavotlar", ref: 360, items: [["Tuxum", "other", 150], ["Sabzavotlar", "other", 120], ["Javdar noni", "side", 40]] },
  oat: { name: "Suli bo‘tqasi, banan", ref: 360, items: [["Suli yormasi", "side", 70], ["Yunon yogurti", "other", 100], ["Banan", "other", 80]] },
  yog: { name: "Yunon yogurti, qulupnay", ref: 170, items: [["Yunon yogurti", "other", 180], ["Qulupnay", "other", 80]] },
  tvo: { name: "Tvorog va mevalar", ref: 170, items: [["Tvorog", "other", 150], ["Mevalar", "other", 100]] },
  tofu: { name: "Tofu va guruch bouli", ref: 160, items: [["Tofu", "other", 80], ["Guruch", "side", 60], ["Sabzavotlar", "other", 60]] },
  nut: { name: "No‘xat va avokado bouli", ref: 160, items: [["No‘xat", "other", 70], ["Avokado", "other", 40], ["Sabzavotlar", "other", 60]] },
  chick: { name: "Grilda tovuq, sabzavotlar", ref: 500, items: [["Tovuq filesi", "protein", 150], ["Guruch", "side", 120], ["Sabzavotlar", "other", 150]] },
  beef: { name: "Mol go‘shtli iliq salat", ref: 500, items: [["Mol go‘shti", "protein", 140], ["Bulg‘ur", "side", 100], ["Salat va sabzavotlar", "other", 150]] },
  turkey: { name: "Kurka kotleti, grechka", ref: 500, items: [["Kurka filesi", "protein", 150], ["Grechka", "side", 120], ["Sabzavotlar", "other", 120]] },
  salmon: { name: "Losos, kinoa, yashil loviya", ref: 410, items: [["Losos", "protein", 130], ["Kinoa", "side", 100], ["Yashil loviya", "other", 100]] },
  chick2: { name: "Tovuq, kinoa va brokkoli", ref: 410, items: [["Tovuq filesi", "protein", 140], ["Kinoa", "side", 90], ["Brokkoli", "other", 120]] },
  beef2: { name: "Mol go‘shti, grechka", ref: 410, items: [["Mol go‘shti", "protein", 130], ["Grechka", "side", 100], ["Sabzavotlar", "other", 120]] },
};
const WEEK: string[][] = [
  ["avo", "yog", "chick", "tofu", "salmon"], // Dushanba
  ["omlet", "tvo", "beef", "yog", "chick2"], // Seshanba
  ["oat", "yog", "turkey", "tofu", "salmon"], // Chorshanba
  ["avo", "tvo", "chick", "nut", "beef2"], // Payshanba
  ["omlet", "yog", "beef", "tofu", "salmon"], // Juma
  ["oat", "tvo", "turkey", "nut", "chick2"], // Shanba
];
export function seedGrams(base: number, ref: number, meal: number): Record<string, number> {
  const g: Record<string, number> = {};
  for (const sku of SKU_LIST) g[String(sku)] = Math.max(5, Math.round((base * KC[sku]![meal]!) / ref / 5) * 5);
  return g;
}

/** Fills the catalog and the weekly menu the first time (never overwrites what the admin edited). */
export async function seedKitchen(): Promise<void> {
  try {
    await db.insert(kitchenExtrasTable).values(EXTRAS_SEED.map((e) => ({ ...e, active: true }))).onConflictDoNothing();
    const [{ n }] = (await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM kitchen_menu`)).rows as [{ n: number }];
    if (n > 0) return;
    const rows = WEEK.flatMap((day, wi) => day.map((key, meal) => {
      const dish = D[key]!;
      return { weekday: wi + 1, meal, name: dish.name, items: dish.items.map(([product, role, base]) => ({ product, role, grams: seedGrams(base, dish.ref, meal) })) };
    }));
    await db.insert(kitchenMenuTable).values(rows).onConflictDoNothing();
  } catch (err) {
    logger.error({ err }, "kitchen seed failed");
  }
}

export async function loadExtras(): Promise<KitchenExtra[]> {
  return db.select().from(kitchenExtrasTable).orderBy(asc(kitchenExtrasTable.sort), asc(kitchenExtrasTable.code));
}
export async function loadMenu(): Promise<KitchenMeal[]> {
  return db.select().from(kitchenMenuTable).orderBy(asc(kitchenMenuTable.weekday), asc(kitchenMenuTable.meal));
}

export function extraLabel(e: ExtraItem): string {
  return e.qty > 1 ? `${e.label} ×${e.qty}` : e.label;
}
export const extrasText = (list: ExtraItem[] | null | undefined) => (list ?? []).map(extraLabel).join(", ");

/**
 * Validates special portions sent by the CRM: catalog codes (qty 1–3) or one free-text
 * request ("custom", with an optional price). Returns the snapshot and the price per day.
 */
export function parseExtras(raw: unknown, catalog: KitchenExtra[]): { error: string | null; items: ExtraItem[]; perDay: number } {
  const fail = (error: string) => ({ error, items: [], perDay: 0 });
  if (raw == null) return { error: null, items: [], perDay: 0 };
  if (!Array.isArray(raw) || raw.length > 10) return fail("Maxsus porsiya ro‘yxati noto‘g‘ri");
  const items: ExtraItem[] = [];
  const seen = new Set<string>();
  for (const r of raw as Record<string, unknown>[]) {
    if (!r || typeof r !== "object") return fail("Maxsus porsiya noto‘g‘ri");
    const code = String(r["code"] ?? "");
    const qty = r["qty"] == null ? 1 : Number(r["qty"]);
    if (!Number.isInteger(qty) || qty < 1 || qty > 3) return fail("Soni 1–3 oralig‘ida bo‘lsin");
    if (code === "custom") {
      const label = String(r["label"] ?? r["note"] ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
      if (label.length < 2) continue;
      const price = r["price"] == null || r["price"] === "" ? 0 : Number(r["price"]);
      if (!Number.isFinite(price) || price < 0 || price > 500_000) return fail("Maxsus talab narxi noto‘g‘ri");
      items.push({ code, label, qty: 1, price: Math.round(price) });
      continue;
    }
    const def = catalog.find((c) => c.code === code && c.active);
    if (!def) return fail(`Noma’lum qo‘shimcha: ${code}`);
    if (seen.has(code)) continue;
    seen.add(code);
    items.push({ code, label: def.label, qty: def.price > 0 || def.mode === "add" ? qty : 1, price: def.price });
  }
  // "Garnir kamroq" and "Garnirsiz" cannot both apply.
  if (seen.has("less_side") && seen.has("no_side")) return fail("«Garnir kamroq» va «Garnirsiz» birga tanlanmaydi");
  return { error: null, items, perDay: items.reduce((s, e) => s + e.price * e.qty, 0) };
}

/** How much of a menu item one box gets with these special portions (1 = a normal portion). */
export function portionFactor(role: string, extras: ExtraItem[] | null | undefined, catalog: KitchenExtra[]): number {
  let add = 0, set = 1;
  for (const e of extras ?? []) {
    const def = catalog.find((c) => c.code === e.code);
    if (!def || def.target !== role) continue;
    if (def.mode === "add") add += def.value * (e.qty || 1);
    else if (def.mode === "set") set = Math.min(set, def.value);
  }
  return Math.max(0, 1 + add) * set;
}

export type KitchenRow = {
  name: string | null; ration: string; sku: number; deliverySlot: string; status: string;
  extras: ExtraItem[] | null; customerNotes: string | null; note: string | null;
};
type Split = { morning: number; evening: number; total: number };
const split = (): Split => ({ morning: 0, evening: 0, total: 0 });
const bump = (s: Split, slot: string, v: number) => { if (slot === "evening") s.evening += v; else s.morning += v; s.total += v; };
const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Daily cooking report (no phones, no addresses):
 *  rations  — boxes per ration/kcal × shift, with how many carry each special portion;
 *  dishes   — that day's menu: portions of every dish per shift;
 *  products — portions and grams of every product per shift (2x go'sht doubles the protein, …);
 *  labels   — boxes with a special portion or an allergy / note, for the box labels.
 */
export function kitchenReport(day: string, rowsIn: KitchenRow[], menu: KitchenMeal[], catalog: KitchenExtra[]) {
  const rows = rowsIn.filter((r) => r.status !== "failed");
  const weekday = new Date(day + "T00:00:00Z").getUTCDay();
  const order = ["ozish", "balans", "sport"];

  const rmap = new Map<string, { ration: string; sku: number; special: Record<string, number>; specialBoxes: number } & Split>();
  for (const r of rows) {
    const k = `${r.ration}:${r.sku}`;
    const e = rmap.get(k) ?? { ration: r.ration, sku: r.sku, special: {}, specialBoxes: 0, ...split() };
    bump(e, r.deliverySlot, 1);
    if (r.extras?.length) {
      e.specialBoxes++;
      for (const x of r.extras) { const l = extraLabel(x); e.special[l] = (e.special[l] ?? 0) + 1; }
    }
    rmap.set(k, e);
  }
  const rations = [...rmap.values()].sort((a, b) => order.indexOf(a.ration) - order.indexOf(b.ration) || a.sku - b.sku);

  const meals = menu.filter((m) => m.weekday === weekday).sort((a, b) => a.meal - b.meal);
  const dishes = meals.map((m) => {
    const d = { meal: m.meal, mealLabel: MEALS[m.meal]?.label ?? "", time: MEALS[m.meal]?.time ?? "", name: m.name, special: 0, ...split() };
    for (const r of rows) {
      bump(d, r.deliverySlot, 1);
      if (m.items.some((it) => portionFactor(it.role, r.extras, catalog) !== 1)) d.special++;
    }
    return d;
  });

  const pmap = new Map<string, { product: string; role: string; meals: Set<string>; portions: Split; grams: Split }>();
  for (const m of meals) {
    for (const it of m.items) {
      const key = it.product.trim().toLowerCase();
      const p = pmap.get(key) ?? { product: it.product.trim(), role: it.role, meals: new Set<string>(), portions: split(), grams: split() };
      if (it.role === "protein") p.role = "protein";
      p.meals.add(MEALS[m.meal]?.label ?? "");
      for (const r of rows) {
        const f = portionFactor(it.role, r.extras, catalog);
        bump(p.portions, r.deliverySlot, f);
        bump(p.grams, r.deliverySlot, f * (Number(it.grams[String(r.sku)]) || 0));
      }
      pmap.set(key, p);
    }
  }
  const roleOrder = ["protein", "side", "other"];
  const products = [...pmap.values()]
    .filter((p) => p.portions.total > 0 || rows.length === 0)
    .map((p) => ({
      product: p.product, role: p.role, roleLabel: ROLE_LABEL[p.role] ?? p.role, meals: [...p.meals].filter(Boolean).join(", "),
      portions: { morning: round1(p.portions.morning), evening: round1(p.portions.evening), total: round1(p.portions.total) },
      grams: { morning: Math.round(p.grams.morning), evening: Math.round(p.grams.evening), total: Math.round(p.grams.total) },
    }))
    .sort((a, b) => roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role) || b.grams.total - a.grams.total || a.product.localeCompare(b.product));

  const labels = rows
    .filter((r) => r.extras?.length || r.customerNotes || r.note)
    .map((r) => ({
      name: r.name, ration: r.ration, sku: r.sku, deliverySlot: r.deliverySlot,
      extras: (r.extras ?? []).map(extraLabel), note: [r.customerNotes, r.note].filter(Boolean).join(" · "),
    }))
    .sort((a, b) => (a.deliverySlot === b.deliverySlot ? 0 : a.deliverySlot === "morning" ? -1 : 1) || order.indexOf(a.ration) - order.indexOf(b.ration) || a.sku - b.sku);

  return { weekday, weekdayLabel: WEEKDAYS[weekday], hasMenu: meals.length > 0, rations, dishes, products, labels };
}
export type KitchenReport = ReturnType<typeof kitchenReport>;
