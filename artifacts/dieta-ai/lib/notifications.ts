import { Alert, Linking, Platform } from "react-native";
import * as Notifications from "expo-notifications";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const MEAL_TIMES: Record<number, { hour: number; minute: number; label: string }[]> = {
  1: [{ hour: 13, minute: 0, label: "Tushlik" }],
  2: [
    { hour: 8, minute: 30, label: "Nonushta" },
    { hour: 19, minute: 0, label: "Kechki ovqat" },
  ],
  3: [
    { hour: 8, minute: 30, label: "Nonushta" },
    { hour: 13, minute: 0, label: "Tushlik" },
    { hour: 19, minute: 0, label: "Kechki ovqat" },
  ],
  4: [
    { hour: 8, minute: 0, label: "Nonushta" },
    { hour: 12, minute: 30, label: "Tushlik" },
    { hour: 16, minute: 0, label: "Kunduzi gazak" },
    { hour: 19, minute: 30, label: "Kechki ovqat" },
  ],
  5: [
    { hour: 8, minute: 0, label: "Nonushta" },
    { hour: 11, minute: 0, label: "Ikkinchi nonushta" },
    { hour: 14, minute: 0, label: "Tushlik" },
    { hour: 17, minute: 0, label: "Kunduzi gazak" },
    { hour: 20, minute: 0, label: "Kechki ovqat" },
  ],
  6: [
    { hour: 8, minute: 0, label: "Nonushta" },
    { hour: 10, minute: 30, label: "Ikkinchi nonushta" },
    { hour: 13, minute: 0, label: "Tushlik" },
    { hour: 15, minute: 30, label: "Kunduzi gazak" },
    { hour: 18, minute: 0, label: "Kechki ovqat" },
    { hour: 20, minute: 30, label: "Yengil gazak" },
  ],
};

const WATER_TIMES = [
  { hour: 9, minute: 0 },
  { hour: 11, minute: 30 },
  { hour: 14, minute: 0 },
  { hour: 16, minute: 30 },
  { hour: 19, minute: 0 },
];

const DAILY_SUMMARY_TIME = { hour: 21, minute: 30 };
const MORNING_GREETING_TIME = { hour: 7, minute: 30 };

export type PermissionStatus = "granted" | "denied" | "undetermined" | "unsupported";

export interface ReminderPreferences {
  masterEnabled: boolean;
  mealsEnabled: boolean;
  waterEnabled: boolean;
  summaryEnabled: boolean;
  morningEnabled: boolean;
  mealsPerDay: number;
}

export interface ScheduleResult {
  scheduled: number;
  permissionGranted: boolean;
}

export function getMealSchedule(count: number) {
  const c = Math.max(1, Math.min(6, Math.round(count)));
  return MEAL_TIMES[c] ?? MEAL_TIMES[3];
}

export function getWaterSchedule() {
  return WATER_TIMES;
}

export function getDailySummaryTime() {
  return DAILY_SUMMARY_TIME;
}

export function getMorningTime() {
  return MORNING_GREETING_TIME;
}

export async function getPermissionStatus(): Promise<PermissionStatus> {
  if (Platform.OS === "web") return "unsupported";
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status as PermissionStatus;
  } catch {
    return "unsupported";
  }
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === "granted") return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === "granted";
  } catch {
    return false;
  }
}

export function openSystemSettings(): void {
  if (Platform.OS === "web") return;
  Linking.openSettings().catch(() => {});
}

export async function requestPermissionWithRationale(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === "granted") return true;

    return new Promise((resolve) => {
      Alert.alert(
        "Eslatmalarni yoqish",
        "Bir Burda ovqatlanish va suv ichish eslatmalarini yuborishi uchun ruxsat bering. Bu sog'lom rejimni saqlashga yordam beradi.",
        [
          {
            text: "Ruxsat berish",
            onPress: async () => {
              const { status } = await Notifications.requestPermissionsAsync();
              resolve(status === "granted");
            },
          },
          {
            text: "Keyinroq",
            style: "cancel",
            onPress: () => resolve(false),
          },
        ],
        { cancelable: true, onDismiss: () => resolve(false) },
      );
    });
  } catch {
    return false;
  }
}

export async function cancelAllReminders(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {}
}

export async function scheduleAllReminders(
  prefs: ReminderPreferences,
): Promise<ScheduleResult> {
  if (Platform.OS === "web") return { scheduled: 0, permissionGranted: false };

  if (!prefs.masterEnabled) {
    await cancelAllReminders();
    return { scheduled: 0, permissionGranted: false };
  }

  const granted = await ensureNotificationPermission();
  if (!granted) return { scheduled: 0, permissionGranted: false };

  await cancelAllReminders();

  let scheduled = 0;

  if (prefs.mealsEnabled) {
    const meals = getMealSchedule(prefs.mealsPerDay);
    for (const m of meals) {
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `🍽️ ${m.label} vaqti!`,
            body: "Ovqatingizni yeb, kaloriyangizni kuzatishni unutmang.",
            sound: true,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: m.hour,
            minute: m.minute,
          },
        });
        scheduled++;
      } catch {}
    }
  }

  if (prefs.waterEnabled) {
    const waters = getWaterSchedule();
    const waterMessages = [
      "Bir stakan suv iching — tana suvga muhtoj! 💧",
      "Suv ichishni unutmang! Kun davomida 8 stakan tavsiya etiladi. 💧",
      "Bir oz suv iching — bu kaloriyasiz foydali odatdir. 💧",
      "Suv vaqti! Tanangizni namlab turing. 💧",
      "Oxirgi eslatma: kechqurun ham suv ichish muhim. 💧",
    ];
    for (let i = 0; i < waters.length; i++) {
      const w = waters[i];
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "💧 Suv ichish vaqti",
            body: waterMessages[i % waterMessages.length],
            sound: false,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: w.hour,
            minute: w.minute,
          },
        });
        scheduled++;
      } catch {}
    }
  }

  if (prefs.summaryEnabled) {
    const s = getDailySummaryTime();
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "📊 Kunlik hisobot",
          body: "Bugun necha kaloriya iste'mol qildingiz? Statistikangizni tekshiring.",
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: s.hour,
          minute: s.minute,
        },
      });
      scheduled++;
    } catch {}
  }

  if (prefs.morningEnabled) {
    const m = getMorningTime();
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "🌅 Xayrli tong!",
          body: "Bugungi ovqatlanish rejangizni boshlang. Birinchi ovqat eng muhimi!",
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: m.hour,
          minute: m.minute,
        },
      });
      scheduled++;
    } catch {}
  }

  return { scheduled, permissionGranted: true };
}

export async function sendTestNotification(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    const granted = await ensureNotificationPermission();
    if (!granted) return false;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "✅ Eslatmalar faol!",
        body: "Bir Burda eslatmalari muvaffaqiyatli sozlandi.",
        sound: true,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 1 },
    });
    return true;
  } catch {
    return false;
  }
}
