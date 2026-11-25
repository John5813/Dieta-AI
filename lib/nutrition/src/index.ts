/**
 * Shared calorie and macro maths for the website, the API and (later) the
 * mobile app. The formulas are the ones the app already ships in
 * `artifacts/dieta-ai/lib/nutrition.ts` (Mifflin-St Jeor BMR, activity
 * multiplier, ±0.5 kg/week by default, weight × 20 safety floor, rounding to
 * 10 kcal, protein 2.0/1.8 g per kg, fat 25 %, carbs the rest), so every
 * channel gives a customer the same number.
 */

export type Gender = "erkak" | "ayol";
export type Goal = "oshirish" | "saqlash" | "ozish";

export interface NutritionInput {
  gender?: Gender;
  goal?: Goal;
  /** Age in whole years. */
  age: number;
  /** cm */
  height: number;
  /** kg */
  weight: number;
  /** Activity multiplier (1.2 … 1.725). Defaults to 1.375 like the app. */
  activityLevel?: number;
  /** kg per week, defaults to 0.5 like the app. */
  speedKgPerWeek?: number;
}

export interface NutritionResult {
  bmr: number;
  tdee: number;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  minCalories: number;
  isCaloriesClamped: boolean;
}

/** The activity choices the app and the website offer. */
export const ACTIVITY_LEVELS = [1.2, 1.375, 1.55, 1.725] as const;

/** Splits a daily calorie target into grams of protein, carbs and fat. */
export function macrosForCalories(
  calories: number,
  weight: number,
  goal: Goal | undefined,
): { protein: number; carbs: number; fat: number } {
  const proteinPerKg = goal === "ozish" ? 2.0 : 1.8;
  const protein = Math.round(weight * proteinPerKg);
  const fat = Math.round((calories * 0.25) / 9);
  const carbs = Math.max(Math.round((calories - protein * 4 - fat * 9) / 4), 0);
  return { protein, carbs, fat };
}

export function calculateNutrition(input: NutritionInput): NutritionResult {
  const weight = input.weight;
  const height = input.height;
  const age = Math.max(Math.round(input.age), 14);
  const isMale = input.gender !== "ayol";
  const goal = input.goal ?? "ozish";
  const speed = input.speedKgPerWeek && input.speedKgPerWeek > 0 ? input.speedKgPerWeek : 0.5;

  const bmr = isMale ? 10 * weight + 6.25 * height - 5 * age + 5 : 10 * weight + 6.25 * height - 5 * age - 161;
  const activity = input.activityLevel && input.activityLevel > 0 ? input.activityLevel : 1.375;
  const tdee = bmr * activity;

  const dailyDelta = (speed * 7700) / 7;
  let calories = goal === "ozish" ? tdee - dailyDelta : goal === "oshirish" ? tdee + dailyDelta : tdee;

  const minCal = weight * 20;
  const rawCalories = calories;
  calories = Math.max(calories, minCal);
  calories = Math.round(calories / 10) * 10;

  const { protein, carbs, fat } = macrosForCalories(calories, weight, goal);
  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    calories,
    protein,
    fat,
    carbs,
    minCalories: Math.round(minCal),
    isCaloriesClamped: rawCalories < minCal,
  };
}

export type RationId = "ozish" | "balans" | "sport";

export interface RationMatch {
  ration: RationId;
  /** The kitchen's calorie SKU the customer gets. */
  sku: 1200 | 1400 | 1600 | 1900 | 2200 | 2500;
}

/**
 * Maps a calorie target to the nearest meal-plan SKU. Ozish 1200–1400,
 * Balans 1600–1900, Sport 2200+; anything under 1200 gets 1200.
 */
export function matchRation(calories: number): RationMatch {
  if (calories < 1500) return { ration: "ozish", sku: calories < 1300 ? 1200 : 1400 };
  if (calories < 2050) return { ration: "balans", sku: calories < 1750 ? 1600 : 1900 };
  return { ration: "sport", sku: calories < 2350 ? 2200 : 2500 };
}
