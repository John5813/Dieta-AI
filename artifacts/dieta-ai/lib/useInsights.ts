import { useMemo } from "react";
import { useApp } from "@/context/AppContext";
import { useTracker } from "@/context/TrackerContext";
import { achievements, loggingStreak, weeklyReport, type InsightInput } from "@/lib/insights";
import { calculatePlan } from "@/lib/nutrition";

/** Weekly report, badges and streak computed from everything the user has logged. */
export function useInsights() {
  const { entries, weightLog, profile, todayKey } = useApp();
  const { waterByDate, stepsByDate, fasting, customFoods, measurements, photos } = useTracker();
  return useMemo(() => {
    const plan = calculatePlan(profile);
    const input: InsightInput = {
      entries,
      weightLog,
      waterByDate,
      stepsByDate,
      fasting,
      customFoods,
      measurements,
      photos,
      todayKey,
      goalCal: profile.dailyCalories ?? plan.calories,
      goalProtein: profile.protein ?? plan.protein,
      waterGoalMl: plan.waterMl,
      goal: profile.goal,
      startWeight: weightLog[0]?.kg,
    };
    return {
      report: weeklyReport(input),
      badges: achievements(input),
      streak: loggingStreak(entries, todayKey),
    };
  }, [entries, weightLog, profile, todayKey, waterByDate, stepsByDate, fasting, customFoods, measurements, photos]);
}
