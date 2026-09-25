import type { DiaryEntry, Goal, WeightEntry } from "@/context/AppContext";
import type { BodyMeasurement, CustomFood, FastingState, ProgressPhoto } from "@/context/TrackerContext";
import { shiftDateKey } from "@/lib/date";
import { entryMeal, MEAL_INFO, type MealType } from "@/lib/meals";

export interface InsightInput {
  entries: DiaryEntry[];
  weightLog: WeightEntry[];
  waterByDate: Record<string, number>;
  stepsByDate: Record<string, number>;
  fasting: FastingState;
  customFoods: CustomFood[];
  measurements: BodyMeasurement[];
  photos: ProgressPhoto[];
  todayKey: string;
  goalCal: number;
  goalProtein: number;
  waterGoalMl: number;
  goal?: Goal;
  startWeight?: number;
}

function daysBack(todayKey: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => shiftDateKey(todayKey, -(n - 1 - i)));
}

function byDate(entries: DiaryEntry[]): Map<string, DiaryEntry[]> {
  const m = new Map<string, DiaryEntry[]>();
  for (const e of entries) {
    const list = m.get(e.date);
    if (list) list.push(e);
    else m.set(e.date, [e]);
  }
  return m;
}

/** Consecutive logged days ending today (or yesterday, so an unlogged morning doesn't break it). */
export function loggingStreak(entries: DiaryEntry[], todayKey: string): number {
  const dates = new Set(entries.map((e) => e.date));
  let day = dates.has(todayKey) ? todayKey : shiftDateKey(todayKey, -1);
  let n = 0;
  while (dates.has(day)) {
    n++;
    day = shiftDateKey(day, -1);
  }
  return n;
}

function longestStreak(entries: DiaryEntry[]): number {
  const dates = [...new Set(entries.map((e) => e.date))].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of dates) {
    run = prev && shiftDateKey(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

export interface WeeklyReport {
  daysLogged: number;
  avgCal: number;
  avgProtein: number;
  daysOnTarget: number;
  daysOver: number;
  weightChange: number | null;
  avgWaterMl: number;
  avgSteps: number;
  topFood: { name: string; count: number } | null;
  skippedMeal: { meal: MealType; days: number } | null;
  tips: string[];
}

/** The last 7 days (today included) in numbers plus a few plain-language tips. */
export function weeklyReport(inp: InsightInput): WeeklyReport {
  const days = daysBack(inp.todayKey, 7);
  const grouped = byDate(inp.entries);
  const logged = days.filter((d) => (grouped.get(d)?.length ?? 0) > 0);
  const cals = logged.map((d) => grouped.get(d)!.reduce((s, e) => s + e.cal, 0));
  const prots = logged.map((d) => grouped.get(d)!.reduce((s, e) => s + e.protein, 0));
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
  const avgCal = avg(cals);
  const avgProtein = avg(prots);
  const daysOnTarget = cals.filter((c) => c <= inp.goalCal && c >= inp.goalCal * 0.8).length;
  const daysOver = cals.filter((c) => c > inp.goalCal).length;

  const inWeek = inp.weightLog.filter((w) => w.date >= days[0]! && w.date <= inp.todayKey);
  const before = [...inp.weightLog].reverse().find((w) => w.date < days[0]!);
  const firstW = before ?? inWeek[0];
  const lastW = inWeek[inWeek.length - 1];
  const weightChange = firstW && lastW && firstW !== lastW ? Math.round((lastW.kg - firstW.kg) * 10) / 10 : null;

  const waterDays = days.map((d) => inp.waterByDate[d] ?? 0).filter((v) => v > 0);
  const stepDays = days.map((d) => inp.stepsByDate[d] ?? 0).filter((v) => v > 0);

  const counts = new Map<string, number>();
  for (const d of logged) for (const e of grouped.get(d)!) counts.set(e.name, (counts.get(e.name) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];

  let skippedMeal: WeeklyReport["skippedMeal"] = null;
  if (logged.length >= 3) {
    for (const meal of ["nonushta", "tushlik", "kechki"] as MealType[]) {
      const missing = logged.filter((d) => !grouped.get(d)!.some((e) => entryMeal(e) === meal)).length;
      if (missing >= Math.ceil(logged.length / 2) && (!skippedMeal || missing > skippedMeal.days)) {
        skippedMeal = { meal, days: missing };
      }
    }
  }

  const tips: string[] = [];
  if (logged.length === 0) {
    tips.push("Bu hafta hali ovqat yozilmagan. Kuniga kamida bitta ovqatni qo'shishdan boshlang.");
  } else {
    if (logged.length < 5) tips.push(`7 kundan ${logged.length} kuni yozildi — har kuni yozsangiz natija aniqroq bo'ladi.`);
    if (daysOver >= 3) tips.push(`${daysOver} kun me'yordan oshdi. Kechki ovqat porsiyasini kichraytirib ko'ring.`);
    if (avgProtein > 0 && avgProtein < inp.goalProtein * 0.75)
      tips.push(`Oqsil o'rtacha ${avgProtein} g — me'yor ${inp.goalProtein} g. Tuxum, tvorog, go'sht, dukkaklilar qo'shing.`);
    if (skippedMeal)
      tips.push(`${MEAL_INFO[skippedMeal.meal].label} ${skippedMeal.days} kun yozilmagan — ovqatni o'tkazib yuborish keyin ortiqcha yeyishga olib keladi.`);
    if (waterDays.length > 0 && avg(waterDays) < inp.waterGoalMl * 0.7)
      tips.push(`Suv o'rtacha ${(avg(waterDays) / 1000).toFixed(1)} L — me'yor ${(inp.waterGoalMl / 1000).toFixed(1)} L.`);
    if (daysOnTarget >= 5) tips.push("Ajoyib hafta! 5 va undan ko'p kun me'yorda bo'ldingiz. 👏");
  }

  return {
    daysLogged: logged.length,
    avgCal,
    avgProtein,
    daysOnTarget,
    daysOver,
    weightChange,
    avgWaterMl: avg(waterDays),
    avgSteps: avg(stepDays),
    topFood: top ? { name: top[0], count: top[1] } : null,
    skippedMeal,
    tips: tips.slice(0, 3),
  };
}

export interface Achievement {
  id: string;
  emoji: string;
  title: string;
  desc: string;
  current: number;
  target: number;
}

/** Badge list with progress; `current >= target` means earned. */
export function achievements(inp: InsightInput): Achievement[] {
  const grouped = byDate(inp.entries);
  const best = longestStreak(inp.entries);
  const onTargetDays = [...grouped.values()].filter((list) => {
    const c = list.reduce((s, e) => s + e.cal, 0);
    return c <= inp.goalCal && c >= inp.goalCal * 0.8;
  }).length;
  const waterDays = Object.values(inp.waterByDate).filter((v) => v >= inp.waterGoalMl).length;
  const maxSteps = Math.max(0, ...Object.values(inp.stepsByDate));
  const longestFastH = Math.max(0, ...inp.fasting.history.map((f) => (f.end - f.start) / 3600_000));
  const latestW = inp.weightLog[inp.weightLog.length - 1]?.kg;
  const startW = inp.startWeight ?? inp.weightLog[0]?.kg;
  const progressKg =
    latestW != null && startW != null
      ? Math.max(0, Math.round((inp.goal === "oshirish" ? latestW - startW : startW - latestW) * 10) / 10)
      : 0;
  const weightWord = inp.goal === "oshirish" ? "oshirildi" : "tashlandi";

  const list: Achievement[] = [
    { id: "first", emoji: "🌱", title: "Birinchi qadam", desc: "Birinchi ovqatni yozing", current: Math.min(1, inp.entries.length), target: 1 },
    { id: "streak3", emoji: "🔥", title: "3 kun ketma-ket", desc: "3 kun uzluksiz yozing", current: Math.min(best, 3), target: 3 },
    { id: "streak7", emoji: "⚡", title: "Bir hafta", desc: "7 kun uzluksiz yozing", current: Math.min(best, 7), target: 7 },
    { id: "streak30", emoji: "🏆", title: "Bir oy", desc: "30 kun uzluksiz yozing", current: Math.min(best, 30), target: 30 },
    { id: "logs100", emoji: "📒", title: "100 yozuv", desc: "Jami 100 ta ovqat yozing", current: Math.min(inp.entries.length, 100), target: 100 },
    { id: "ontarget7", emoji: "🎯", title: "Me'yor ustasi", desc: "7 kun kaloriya me'yorida qoling", current: Math.min(onTargetDays, 7), target: 7 },
    { id: "water7", emoji: "💧", title: "Suv chempioni", desc: "7 kun suv me'yorini bajaring", current: Math.min(waterDays, 7), target: 7 },
    { id: "steps10k", emoji: "👟", title: "10 000 qadam", desc: "Bir kunda 10 000 qadam yuring", current: Math.min(maxSteps, 10000), target: 10000 },
    { id: "kg2", emoji: "⚖️", title: `2 kg ${weightWord}`, desc: `Boshlang'ich vazndan 2 kg`, current: Math.min(progressKg, 2), target: 2 },
    { id: "kg5", emoji: "🥇", title: `5 kg ${weightWord}`, desc: `Boshlang'ich vazndan 5 kg`, current: Math.min(progressKg, 5), target: 5 },
    { id: "fast16", emoji: "⏳", title: "16 soat ochlik", desc: "16 soatlik ochlikni bajaring", current: Math.min(Math.floor(longestFastH), 16), target: 16 },
    { id: "recipe", emoji: "👩‍🍳", title: "Oshpaz", desc: "O'z taomingiz yoki retseptingizni yarating", current: Math.min(inp.customFoods.length, 1), target: 1 },
    { id: "measure4", emoji: "📏", title: "O'lchovchi", desc: "Tana o'lchamlarini 4 marta yozing", current: Math.min(inp.measurements.length, 4), target: 4 },
    { id: "photo2", emoji: "📸", title: "Oldin va keyin", desc: "2 ta progress surati qo'shing", current: Math.min(inp.photos.length, 2), target: 2 },
  ];
  return list;
}
