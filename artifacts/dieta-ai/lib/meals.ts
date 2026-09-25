export type MealType = "nonushta" | "tushlik" | "kechki" | "gazak";

export const MEAL_ORDER: MealType[] = ["nonushta", "tushlik", "kechki", "gazak"];

export const MEAL_INFO: Record<MealType, { label: string; emoji: string }> = {
  nonushta: { label: "Nonushta", emoji: "🌅" },
  tushlik: { label: "Tushlik", emoji: "☀️" },
  kechki: { label: "Kechki ovqat", emoji: "🌙" },
  gazak: { label: "Gazak", emoji: "🍎" },
};

/** Meal a clock time most likely belongs to ("HH:MM" or a Date). */
export function mealForTime(time: string | Date = new Date()): MealType {
  let h: number;
  if (typeof time === "string") {
    // Stored times come from toLocaleTimeString and may be "1:10 PM" on some engines.
    const m = /^(\d{1,2}):\d{2}\s*([AaPp][Mm])?/.exec(time.trim());
    h = m ? Number.parseInt(m[1]!, 10) : Number.NaN;
    if (m?.[2]) h = (h % 12) + (m[2].toLowerCase() === "pm" ? 12 : 0);
  } else {
    h = time.getHours();
  }
  if (!Number.isFinite(h)) return "gazak";
  if (h >= 4 && h < 11) return "nonushta";
  if (h >= 11 && h < 16) return "tushlik";
  if (h >= 18 && h < 24) return "kechki";
  return "gazak";
}

/** Maps a free-text meal name from the AI meal plan ("Kechki ovqat", "Gazak (tushlikdan keyin)"). */
export function mealFromLabel(label: string | undefined): MealType | undefined {
  const l = (label ?? "").toLowerCase();
  if (l.includes("gazak") || l.includes("snack") || l.includes("перекус")) return "gazak";
  if (l.includes("nonushta") || l.includes("завтрак")) return "nonushta";
  if (l.includes("tushlik") || l.includes("обед")) return "tushlik";
  if (l.includes("kechki") || l.includes("ужин")) return "kechki";
  return undefined;
}

export function entryMeal(e: { meal?: MealType; time: string }): MealType {
  return e.meal ?? mealForTime(e.time);
}
