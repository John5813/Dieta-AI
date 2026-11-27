/**
 * 5 / 4 / 3 meals a day. 5 is the standard (all prices are for 5 meals); 4 drops the 16:30
 * snack, 3 drops both snacks. The 3/4-meal day price is the 5-meal price minus an
 * admin-editable percent ("Perekus chegirmasi"); a manager can still type any price.
 */
import { eq } from "drizzle-orm";
import { db, crmSettingsTable } from "@workspace/db";
import { logger } from "./logger";

export const MEAL_COUNTS = [5, 4, 3] as const;
export type MealCount = (typeof MEAL_COUNTS)[number];
/** Meal indexes of the 5-meal kitchen menu that a box contains. */
export const MEAL_SETS: Record<MealCount, number[]> = { 5: [0, 1, 2, 3, 4], 4: [0, 1, 2, 4], 3: [0, 2, 4] };
export const MEALS_NOTE: Record<MealCount, string> = { 5: "", 4: "Perekus 16:30siz", 3: "perekussiz: 11:00 va 16:30 yo‘q" };
export const mealsText = (n: number) => (n === 4 || n === 3 ? `${n} mahal (${MEALS_NOTE[n]})` : "5 mahal");
export function mealsOf(v: unknown): MealCount | null {
  const n = Number(v);
  return n === 5 || n === 4 || n === 3 ? n : null;
}

export type MealPricing = { "4": number; "3": number };
/** Confirmed rule: 4 meals −10%, 3 meals −20% of the 5-meal price (editable by the owner in the CRM). */
export const DEFAULT_MEAL_PRICING: MealPricing = { "4": 10, "3": 20 };
let current: MealPricing = { ...DEFAULT_MEAL_PRICING };

export const mealPricing = (): MealPricing => current;
/** Day price for `meals` from the 5-meal price, rounded to 1000 so'm. */
export function mealPrice(base5: number, meals: number): number {
  if (meals !== 4 && meals !== 3) return base5;
  const pct = current[String(meals) as "4" | "3"] ?? 0;
  return Math.round((base5 * (1 - pct / 100)) / 1000) * 1000;
}

const KEY = "meal_pricing";
export async function loadMealPricing(): Promise<void> {
  try {
    const [row] = await db.select().from(crmSettingsTable).where(eq(crmSettingsTable.key, KEY)).limit(1);
    const v = row?.value as Partial<MealPricing> | undefined;
    if (v) current = { "4": Number(v["4"] ?? DEFAULT_MEAL_PRICING["4"]), "3": Number(v["3"] ?? DEFAULT_MEAL_PRICING["3"]) };
  } catch (err) {
    logger.error({ err }, "meal pricing load failed");
  }
}
export async function saveMealPricing(v: MealPricing): Promise<MealPricing> {
  await db.insert(crmSettingsTable).values({ key: KEY, value: v })
    .onConflictDoUpdate({ target: crmSettingsTable.key, set: { value: v, updatedAt: new Date() } });
  current = { ...v };
  return current;
}
