import type { UserProfile } from "@/context/AppContext";

export interface NutritionPlan {
  bmr: number;
  tdee: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  proteinPct: number;
  carbsPct: number;
  fatPct: number;
  waterMl: number;
  bmi: number;
  bmiCategory: string;
  weeksToGoal: number;
  goalDate: Date;
  weeklyDeltaKg: number;
  ageYears: number;
  minCalories: number;
  isCaloriesClamped: boolean;
}

export function calculateAge(birth?: { year: number; month: number; day: number }): number {
  if (!birth) return 30;
  const now = new Date();
  let age = now.getFullYear() - birth.year;
  const m = now.getMonth() + 1 - birth.month;
  if (m < 0 || (m === 0 && now.getDate() < birth.day)) age--;
  return Math.max(age, 14);
}

export function calculatePlan(profile: Partial<UserProfile>): NutritionPlan {
  const weight = profile.currentWeight ?? 75;
  const goalKind = profile.goal ?? "ozish";
  const fallbackTarget =
    goalKind === "ozish" ? weight - 5 : goalKind === "oshirish" ? weight + 5 : weight;
  const target = profile.targetWeight ?? fallbackTarget;
  const height = profile.height ?? 170;
  const age = calculateAge(profile.birthDate);
  const isMale = profile.gender !== "ayol";
  const goal = goalKind;
  const speed = profile.speedKgPerWeek && profile.speedKgPerWeek > 0
    ? profile.speedKgPerWeek
    : 0.5;

  // Mifflin-St Jeor BMR
  const bmr = isMale
    ? 10 * weight + 6.25 * height - 5 * age + 5
    : 10 * weight + 6.25 * height - 5 * age - 161;

  // Activity multiplier from profile (default: light activity)
  const activity = profile.activityLevel && profile.activityLevel > 0
    ? profile.activityLevel
    : 1.375;
  const tdee = bmr * activity;

  // 1 kg fat ≈ 7700 kcal -> daily delta
  const dailyDelta = (speed * 7700) / 7;

  let calories: number;
  let weeklyDeltaKg: number;
  if (goal === "ozish") {
    calories = tdee - dailyDelta;
    weeklyDeltaKg = -speed;
  } else if (goal === "oshirish") {
    calories = tdee + dailyDelta;
    weeklyDeltaKg = speed;
  } else {
    calories = tdee;
    weeklyDeltaKg = 0;
  }

  // Safety floor: weight × 20 (minimal safe calories per day)
  const minCal = weight * 20;
  const rawCalories = calories;
  calories = Math.max(calories, minCal);
  const isCaloriesClamped = rawCalories < minCal;
  calories = Math.round(calories / 10) * 10;

  // Macros
  // Protein: 2.0 g/kg cut, 1.8 maintain, 1.8 bulk
  const proteinPerKg = goal === "ozish" ? 2.0 : 1.8;
  const protein = Math.round(weight * proteinPerKg);
  // Fat: 25% of calories
  const fat = Math.round((calories * 0.25) / 9);
  // Carbs: rest
  const carbs = Math.max(
    Math.round((calories - protein * 4 - fat * 9) / 4),
    0,
  );

  const proteinKcal = protein * 4;
  const fatKcal = fat * 9;
  const carbsKcal = carbs * 4;
  const totalKcal = proteinKcal + fatKcal + carbsKcal;
  const proteinPct = Math.round((proteinKcal / totalKcal) * 100);
  const fatPct = Math.round((fatKcal / totalKcal) * 100);
  const carbsPct = 100 - proteinPct - fatPct;

  // Water: 35 ml per kg
  const waterMl = Math.round((weight * 35) / 50) * 50;

  // BMI
  const heightM = height / 100;
  const bmi = +(weight / (heightM * heightM)).toFixed(1);
  let bmiCategory = "Normal";
  if (bmi < 18.5) bmiCategory = "Vazn kam";
  else if (bmi < 25) bmiCategory = "Normal";
  else if (bmi < 30) bmiCategory = "Ortiqcha";
  else bmiCategory = "Semizlik";

  // Weeks to goal
  const diff = Math.abs(target - weight);
  const weeksToGoal = goal === "saqlash" || speed === 0 ? 0 : Math.ceil(diff / speed);
  const goalDate = new Date();
  goalDate.setDate(goalDate.getDate() + weeksToGoal * 7);

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    calories,
    protein,
    carbs,
    fat,
    proteinPct,
    carbsPct,
    fatPct,
    waterMl,
    bmi,
    bmiCategory,
    weeksToGoal,
    goalDate,
    weeklyDeltaKg,
    ageYears: age,
    minCalories: Math.round(minCal),
    isCaloriesClamped,
  };
}

const MONTHS_UZ = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
];

export function formatUzDate(d: Date): string {
  return `${d.getDate()} ${MONTHS_UZ[d.getMonth()]} ${d.getFullYear()}`;
}
