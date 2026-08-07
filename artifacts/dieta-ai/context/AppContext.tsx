import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus, Platform } from "react-native";
import {
  loadCachedOffset,
  refreshLocationTimezone,
  todayStr,
  yesterdayStr,
} from "@/lib/date";
import { cancelAllReminders, scheduleAllReminders } from "@/lib/notifications";

export type Language = "uz" | "uz-kril" | "ru" | "en";
export type Gender = "erkak" | "ayol";
export type Goal = "oshirish" | "saqlash" | "ozish";

export interface UserProfile {
  language: Language;
  name: string;
  gender: Gender;
  birthDate: { month: number; day: number; year: number };
  goal: Goal;
  height: number;
  currentWeight: number;
  targetWeight: number;
  speedKgPerWeek: number;
  activityLevel: number;
  obstacles: string[];
  achievements: string[];
  mealsPerDay: number;
  dailyCalories: number;
  protein: number;
  carbs: number;
  fat: number;
  phone: string;
  /** Master switch — barcha eslatmalarni o'chiradi/yoqadi */
  notificationsEnabled: boolean;
  /** Ovqat eslatmalari (master ostida mustaqil) */
  mealRemindersEnabled: boolean;
  waterRemindersEnabled: boolean;
  dailySummaryEnabled: boolean;
  morningGreetingEnabled: boolean;
}

export type SubscriptionStatus = "none" | "trial" | "active";
export const TRIAL_DAYS = 1;
export const TRIAL_DAILY_SCAN_LIMIT = 6;

export interface Subscription {
  status: SubscriptionStatus;
  trialStartedAt?: number;
  scansDate?: string;
  scansToday: number;
  spinAttempts: number;
  premiumUntil?: number;
}

export interface ExercisePlanItem {
  name: string;
  emoji: string;
  when: string;
  state: string;
  duration: string;
  burnsCal: number;
  instruction: string;
}
export type ExStatus = "idle" | "started" | "done";
export interface StoredExercisePlan {
  date: string;
  summary: string;
  warning: string;
  exercises: ExercisePlanItem[];
  statuses: Record<number, ExStatus>;
}

export interface DiaryEntry {
  id: string;
  name: string;
  cal: number;
  protein: number;
  carbs: number;
  fat: number;
  time: string;
  date: string;
  source: "camera" | "gallery" | "text" | "catalog" | "plan";
  imageUri?: string;
  emoji?: string;
  portion?: string;
}

const DEFAULT_SUB: Subscription = {
  status: "none",
  scansToday: 0,
  spinAttempts: 0,
};

interface AppContextType {
  onboardingComplete: boolean;
  profile: Partial<UserProfile>;
  subscription: Subscription;
  entries: DiaryEntry[];
  burnedByDate: Record<string, number>;
  setProfile: (updates: Partial<UserProfile>) => void;
  completeOnboarding: () => Promise<void>;
  resetApp: () => Promise<void>;
  startTrial: () => void;
  activateSubscription: (premiumUntil?: number) => void;
  incrementSpinAttempts: () => void;
  tourPending: boolean;
  clearTourPending: () => void;
  registerScan: () => { allowed: boolean; reason?: "trial_expired" | "daily_limit" | "locked" };
  canScan: () => { allowed: boolean; reason?: "trial_expired" | "daily_limit" | "locked"; remaining: number };
  addEntry: (entry: Omit<DiaryEntry, "id" | "time" | "date">) => void;
  addEntries: (entries: Array<Omit<DiaryEntry, "id" | "time" | "date">>) => void;
  removeEntry: (id: string) => void;
  addBurned: (cal: number) => void;
  resetBurnedToday: () => void;
  exercisePlan: StoredExercisePlan | null;
  setExercisePlan: (plan: StoredExercisePlan) => void;
  setExerciseStatus: (idx: number, status: ExStatus) => void;
  replaceExerciseAt: (idx: number, item: ExercisePlanItem) => void;
  clearExercisePlan: () => void;
  todayKey: string;
  yesterdayKey: string;
  loading: boolean;
  addFoodModalVisible: boolean;
  setAddFoodModalVisible: (v: boolean) => void;
}

const AppContext = createContext<AppContextType>({
  onboardingComplete: false,
  profile: {},
  subscription: DEFAULT_SUB,
  entries: [],
  burnedByDate: {},
  setProfile: () => {},
  completeOnboarding: async () => {},
  resetApp: async () => {},
  startTrial: () => {},
  activateSubscription: () => {},
  incrementSpinAttempts: () => {},
  tourPending: false,
  clearTourPending: () => {},
  registerScan: () => ({ allowed: false, reason: "locked" }),
  canScan: () => ({ allowed: false, reason: "locked", remaining: 0 }),
  addEntry: () => {},
  addEntries: () => {},
  removeEntry: () => {},
  addBurned: () => {},
  resetBurnedToday: () => {},
  exercisePlan: null,
  setExercisePlan: () => {},
  setExerciseStatus: () => {},
  replaceExerciseAt: () => {},
  clearExercisePlan: () => {},
  todayKey: todayStr(),
  yesterdayKey: yesterdayStr(),
  loading: true,
  addFoodModalVisible: false,
  setAddFoodModalVisible: () => {},
});

function nowTime(): string {
  return new Date().toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" });
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [profile, setProfileState] = useState<Partial<UserProfile>>({});
  const [subscription, setSubscriptionState] = useState<Subscription>(DEFAULT_SUB);
  const [entries, setEntriesState] = useState<DiaryEntry[]>([]);
  const [burnedByDate, setBurnedByDate] = useState<Record<string, number>>({});
  const [exercisePlan, setExercisePlanState] = useState<StoredExercisePlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [tourPending, setTourPendingState] = useState(false);
  const [addFoodModalVisible, setAddFoodModalVisible] = useState(false);

  useEffect(() => {
    (async () => {
      await loadCachedOffset();
      refreshLocationTimezone().catch(() => {});

      try {
        const [
          obRaw,
          profileRaw,
          subRaw,
          entriesRaw,
          burnedRaw,
          exPlanRaw,
        ] = await AsyncStorage.multiGet([
          "onboarding_complete",
          "user_profile",
          "subscription",
          "diary_entries",
          "burned_by_date",
          "exercise_plan",
        ]);

        if (obRaw[1] === "true") setOnboardingComplete(true);

        if (profileRaw[1]) {
          try { setProfileState(JSON.parse(profileRaw[1])); } catch {}
        }
        if (subRaw[1]) {
          try { setSubscriptionState(JSON.parse(subRaw[1])); } catch {}
        }
        if (entriesRaw[1]) {
          try {
            const parsed = JSON.parse(entriesRaw[1]) as DiaryEntry[];
            setEntriesState(
              parsed.map((e) => ({
                ...e,
                cal: Number.isFinite(e.cal) ? e.cal : 0,
                protein: Number.isFinite(e.protein) ? e.protein : 0,
                carbs: Number.isFinite(e.carbs) ? e.carbs : 0,
                fat: Number.isFinite(e.fat) ? e.fat : 0,
              }))
            );
          } catch {}
        }
        if (burnedRaw[1]) {
          try { setBurnedByDate(JSON.parse(burnedRaw[1])); } catch {}
        }
        if (exPlanRaw[1]) {
          try { setExercisePlanState(JSON.parse(exPlanRaw[1])); } catch {}
        }
      } catch {}

      setLoading(false);
    })();
  }, []);

  const persistBurned = (next: Record<string, number>) => {
    setBurnedByDate(next);
    AsyncStorage.setItem("burned_by_date", JSON.stringify(next)).catch(() => {});
  };

  const persistExPlan = (next: StoredExercisePlan | null) => {
    setExercisePlanState(next);
    if (next) {
      AsyncStorage.setItem("exercise_plan", JSON.stringify(next)).catch(() => {});
    } else {
      AsyncStorage.removeItem("exercise_plan").catch(() => {});
    }
  };

  const setExercisePlan = (plan: StoredExercisePlan) => {
    persistExPlan(plan);
  };

  const setExerciseStatus = (idx: number, status: ExStatus) => {
    setExercisePlanState((curr) => {
      if (!curr) return curr;
      const nextStatuses = { ...curr.statuses, [idx]: status };
      const next = { ...curr, statuses: nextStatuses };
      AsyncStorage.setItem("exercise_plan", JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  const replaceExerciseAt = (idx: number, item: ExercisePlanItem) => {
    setExercisePlanState((curr) => {
      if (!curr) return curr;
      const exercises = [...curr.exercises];
      exercises[idx] = item;
      const statuses = { ...curr.statuses };
      delete statuses[idx];
      const next = { ...curr, exercises, statuses };
      AsyncStorage.setItem("exercise_plan", JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  const clearExercisePlan = () => {
    persistExPlan(null);
  };

  const persistEntries = (next: DiaryEntry[]) => {
    setEntriesState(next);
    AsyncStorage.setItem("diary_entries", JSON.stringify(next)).catch(() => {});
  };

  const persistSub = (next: Subscription) => {
    setSubscriptionState(next);
    AsyncStorage.setItem("subscription", JSON.stringify(next)).catch(() => {});
  };

  const lastSchedKey = useRef<string>("");
  // Monoton o'sib boruvchi ID — eski async chaqiruvlar yangisiniki ustidan
  // yozib qo'ymasligi uchun.
  const schedReqId = useRef<number>(0);
  // Mutex — bir vaqtda faqat bitta scheduling oqimi ishlasin. Aks holda
  // ikkita parallel chaqiruv cancel/schedule operatsiyalarini interleave
  // qilib, qurilmada noto'g'ri yakuniy holat qoldirishi mumkin.
  const schedQueue = useRef<Promise<unknown>>(Promise.resolve());

  const buildPrefs = (next: Partial<UserProfile>) => {
    const meals = next.mealsPerDay ?? 3;
    const master = next.notificationsEnabled !== false;
    return {
      masterEnabled: master,
      mealsEnabled: next.mealRemindersEnabled !== false,
      waterEnabled: next.waterRemindersEnabled !== false,
      summaryEnabled: next.dailySummaryEnabled !== false,
      morningEnabled: next.morningGreetingEnabled !== false,
      mealsPerDay: meals,
    };
  };

  const reschedule = (next: Partial<UserProfile>, force = false): Promise<void> => {
    const p = buildPrefs(next);
    const key = `${p.mealsPerDay}|${p.masterEnabled ? 1 : 0}|${p.mealsEnabled ? 1 : 0}|${p.waterEnabled ? 1 : 0}|${p.summaryEnabled ? 1 : 0}|${p.morningEnabled ? 1 : 0}`;
    if (!force && key === lastSchedKey.current) return Promise.resolve();
    const myId = ++schedReqId.current;
    // Mutexga qo'yamiz — oldingi scheduling tugamaguncha kutadi.
    const job = schedQueue.current
      .catch(() => {})
      .then(async () => {
        // Mutex ichida bo'lganimizda yangiroq so'rov kelgan bo'lsa, biz eskirib
        // qoldik — bu chaqiruvni o'tkazib yuboramiz.
        if (myId !== schedReqId.current) return;
        try {
          const result = await scheduleAllReminders(p);
          if (myId !== schedReqId.current) return;
          const anyDesired =
            p.masterEnabled &&
            (p.mealsEnabled || p.waterEnabled || p.summaryEnabled || p.morningEnabled);
          if (!anyDesired || result.permissionGranted) {
            lastSchedKey.current = key;
          }
        } catch {}
      });
    schedQueue.current = job;
    return job;
  };

  const RESCHED_KEYS = [
    "mealsPerDay",
    "notificationsEnabled",
    "mealRemindersEnabled",
    "waterRemindersEnabled",
    "dailySummaryEnabled",
    "morningGreetingEnabled",
  ] as const;

  const setProfile = (updates: Partial<UserProfile>) => {
    setProfileState((prev) => {
      const next = { ...prev, ...updates };
      AsyncStorage.setItem("user_profile", JSON.stringify(next)).catch(() => {});
      if (RESCHED_KEYS.some((k) => k in updates)) {
        reschedule(next).catch(() => {});
      }
      return next;
    });
  };

  useEffect(() => {
    if (loading) return;
    if (!profile.mealsPerDay) return;
    reschedule(profile).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // Foydalanuvchi tizim sozlamalaridan qaytganda ruxsat o'zgargan bo'lishi
  // mumkin — ilova oldinga chiqqanda majburiy qayta rejalashtiramiz.
  useEffect(() => {
    if (Platform.OS === "web") return;
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state !== "active") return;
      if (loading) return;
      if (!profile.mealsPerDay) return;
      reschedule(profile, true).catch(() => {});
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, profile]);

  const completeOnboarding = async () => {
    setOnboardingComplete(true);
    try {
      await AsyncStorage.setItem("onboarding_complete", "true");
    } catch {}
  };

  const resetApp = async () => {
    // Eslatmalarni avval o'chiramiz — profil tozalanmasdan oldin, shunda
    // hech qanday rejalashtirilgan bildirishnoma akkaunt o'chirilgandan keyin
    // qurilmada qolmaydi. MUHIM: cancellationni ham mutex orqali yuboramiz,
    // shunda hozir ishlayotgan reschedule tugagandan keyingina cancel ishlaydi.
    // Aks holda eski scheduler bizning cancel'dan keyin yangi notification
    // yaratib qolishi mumkin.
    schedReqId.current++;
    lastSchedKey.current = "";
    const cancelJob = schedQueue.current
      .catch(() => {})
      .then(() => cancelAllReminders().catch(() => {}));
    schedQueue.current = cancelJob;
    await cancelJob;
    await AsyncStorage.multiRemove([
      "onboarding_complete",
      "user_profile",
      "subscription",
      "diary_entries",
      "burned_by_date",
      "ratsion_plan",
      "exercise_plan",
    ]);
    if (FileSystem.documentDirectory) {
      FileSystem.deleteAsync(`${FileSystem.documentDirectory}food_images`, {
        idempotent: true,
      }).catch(() => {});
    }
    setOnboardingComplete(false);
    setProfileState({});
    setSubscriptionState(DEFAULT_SUB);
    setEntriesState([]);
    setBurnedByDate({});
    setExercisePlanState(null);
  };

  const startTrial = () => {
    persistSub({
      ...subscription,
      status: "trial",
      trialStartedAt: Date.now(),
      scansDate: todayStr(),
      scansToday: 0,
    });
  };

  const activateSubscription = (premiumUntil?: number) => {
    persistSub({
      ...subscription,
      status: "active",
      premiumUntil: premiumUntil ?? Date.now() + 365 * 24 * 60 * 60 * 1000,
    });
    setTourPendingState(true);
  };

  const clearTourPending = () => setTourPendingState(false);

  const incrementSpinAttempts = () => {
    persistSub({ ...subscription, spinAttempts: subscription.spinAttempts + 1 });
  };

  const isTrialExpired = (s: Subscription): boolean => {
    if (s.status !== "trial" || !s.trialStartedAt) return false;
    const days = (Date.now() - s.trialStartedAt) / (1000 * 60 * 60 * 24);
    return days >= TRIAL_DAYS;
  };

  const canScan = () => {
    if (subscription.status === "active") {
      return { allowed: true, remaining: Infinity };
    }
    if (subscription.status === "trial") {
      if (isTrialExpired(subscription)) {
        return { allowed: false, reason: "trial_expired" as const, remaining: 0 };
      }
      const today = todayStr();
      const used = subscription.scansDate === today ? subscription.scansToday : 0;
      const remaining = Math.max(0, TRIAL_DAILY_SCAN_LIMIT - used);
      if (remaining <= 0) {
        return { allowed: false, reason: "daily_limit" as const, remaining: 0 };
      }
      return { allowed: true, remaining };
    }
    return { allowed: false, reason: "locked" as const, remaining: 0 };
  };

  const registerScan = () => {
    const c = canScan();
    if (!c.allowed) return { allowed: false, reason: c.reason };
    const today = todayStr();
    const used = subscription.scansDate === today ? subscription.scansToday : 0;
    persistSub({
      ...subscription,
      scansDate: today,
      scansToday: used + 1,
    });
    return { allowed: true };
  };

  const addEntry = (entry: Omit<DiaryEntry, "id" | "time" | "date">) => {
    const e: DiaryEntry = {
      ...entry,
      id: `e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      time: nowTime(),
      date: todayStr(),
    };
    persistEntries([e, ...entries]);
  };

  const addEntries = (list: Array<Omit<DiaryEntry, "id" | "time" | "date">>) => {
    const t = nowTime();
    const d = todayStr();
    const newOnes: DiaryEntry[] = list.map((entry, i) => ({
      ...entry,
      id: `e-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
      time: t,
      date: d,
    }));
    persistEntries([...newOnes, ...entries]);
  };

  const removeEntry = (id: string) => {
    const target = entries.find((e) => e.id === id);
    if (target?.imageUri && target.imageUri.startsWith("file://")) {
      FileSystem.deleteAsync(target.imageUri, { idempotent: true }).catch(() => {});
    }
    persistEntries(entries.filter((e) => e.id !== id));
  };

  const addBurned = (cal: number) => {
    if (!Number.isFinite(cal) || cal <= 0) return;
    const key = todayStr();
    persistBurned({ ...burnedByDate, [key]: (burnedByDate[key] ?? 0) + Math.round(cal) });
  };

  const resetBurnedToday = () => {
    const key = todayStr();
    if (!(key in burnedByDate)) return;
    const next = { ...burnedByDate };
    delete next[key];
    persistBurned(next);
  };

  return (
    <AppContext.Provider
      value={{
        onboardingComplete,
        profile,
        subscription,
        entries,
        burnedByDate,
        setProfile,
        completeOnboarding,
        resetApp,
        startTrial,
        activateSubscription,
        incrementSpinAttempts,
        tourPending,
        clearTourPending,
        registerScan,
        canScan,
        addEntry,
        addEntries,
        removeEntry,
        addBurned,
        resetBurnedToday,
        exercisePlan,
        setExercisePlan,
        setExerciseStatus,
        replaceExerciseAt,
        clearExercisePlan,
        todayKey: todayStr(),
        yesterdayKey: yesterdayStr(),
        loading,
        addFoodModalVisible,
        setAddFoodModalVisible,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
