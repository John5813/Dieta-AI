import { Alert, Linking, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { tr, trText } from "@/lib/i18n";

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
        trText("Eslatmalarni yoqish"),
        trText("Kaloria.uz ovqatlanish va suv ichish eslatmalarini yuborishi uchun ruxsat bering. Bu sog'lom rejimni saqlashga yordam beradi."),
        [
          {
            text: trText("Ruxsat berish"),
            onPress: async () => {
              const { status } = await Notifications.requestPermissionsAsync();
              resolve(status === "granted");
            },
          },
          {
            text: trText("Keyinroq"),
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

/**
 * Android delivers every notification through a channel, and the channel (not
 * the notification) decides sound and heads-up behaviour. Without our own
 * channels everything lands in a generic one, so water reminders would ring as
 * loudly as meal reminders. Safe to call repeatedly; also refreshes the names
 * when the app language changes.
 */
export const CHANNEL_MEALS = "meals";
export const CHANNEL_WATER = "water";
export const CHANNEL_GENERAL = "general";

export async function ensureChannels(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    await Notifications.setNotificationChannelAsync(CHANNEL_MEALS, {
      name: trText("Ovqat eslatmalari"),
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 150, 250],
      lightColor: "#2D7A2D",
    });
    await Notifications.setNotificationChannelAsync(CHANNEL_WATER, {
      name: trText("Suv eslatmasi"),
      // Visible but quiet: five of these arrive every day.
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: null,
      enableVibrate: false,
    });
    await Notifications.setNotificationChannelAsync(CHANNEL_GENERAL, {
      name: trText("Eslatmalar"),
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  } catch {}
}

/** Which screen a tapped notification should open. */
export type NotificationScreen = "home" | "stats";

export async function cancelAllReminders(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {}
}

/** One-off notifications (fast finished, weekly report) survive reminder rescheduling. */
const ONE_OFF_PREFIX = "uzd-oneoff-";

async function cancelRoutineReminders(): Promise<void> {
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      all
        .filter((n) => !n.identifier.startsWith(ONE_OFF_PREFIX))
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {})),
    );
  } catch {}
}

/** Schedules (or replaces) a single notification at `date`; false without permission. */
export async function scheduleOneOff(
  id: string,
  date: Date,
  title: string,
  body: string,
  opts: { askPermission?: boolean; screen?: NotificationScreen } = {},
): Promise<boolean> {
  if (Platform.OS === "web" || date.getTime() <= Date.now()) return false;
  try {
    const granted =
      opts.askPermission === false
        ? (await getPermissionStatus()) === "granted"
        : await ensureNotificationPermission();
    if (!granted) return false;
    await ensureChannels();
    await Notifications.cancelScheduledNotificationAsync(ONE_OFF_PREFIX + id).catch(() => {});
    await Notifications.scheduleNotificationAsync({
      identifier: ONE_OFF_PREFIX + id,
      content: { title: trText(title), body: trText(body), sound: true, data: { screen: opts.screen ?? "home" } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: CHANNEL_GENERAL },
    });
    return true;
  } catch {
    return false;
  }
}

export async function cancelOneOff(id: string): Promise<void> {
  if (Platform.OS === "web") return;
  await Notifications.cancelScheduledNotificationAsync(ONE_OFF_PREFIX + id).catch(() => {});
}

export async function scheduleAllReminders(
  prefs: ReminderPreferences,
): Promise<ScheduleResult> {
  if (Platform.OS === "web") return { scheduled: 0, permissionGranted: false };

  if (!prefs.masterEnabled) {
    await cancelRoutineReminders();
    return { scheduled: 0, permissionGranted: false };
  }

  // Never ask here: this runs in the background (app start, settings change).
  // The permission dialog is shown only from an explicit user action, after
  // the explanation in requestPermissionWithRationale().
  const granted = (await getPermissionStatus()) === "granted";
  if (!granted) return { scheduled: 0, permissionGranted: false };

  await ensureChannels();
  await cancelRoutineReminders();

  let scheduled = 0;

  if (prefs.mealsEnabled) {
    const meals = getMealSchedule(prefs.mealsPerDay);
    for (const m of meals) {
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: tr("🍽️ {0} vaqti!", trText(m.label)),
            body: trText("Ovqatingizni yeb, kaloriyangizni kuzatishni unutmang."),
            sound: true,
            data: { screen: "home" },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: m.hour,
            minute: m.minute,
            channelId: CHANNEL_MEALS,
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
            title: trText("💧 Suv ichish vaqti"),
            body: trText(waterMessages[i % waterMessages.length]!),
            sound: false,
            data: { screen: "home" },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: w.hour,
            minute: w.minute,
            channelId: CHANNEL_WATER,
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
          title: trText("📊 Kunlik hisobot"),
          body: trText("Bugun necha kaloriya iste'mol qildingiz? Statistikangizni tekshiring."),
          sound: true,
          data: { screen: "stats" },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: s.hour,
          minute: s.minute,
          channelId: CHANNEL_GENERAL,
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
          title: trText("🌅 Xayrli tong!"),
          body: trText("Bugungi ovqatlanish rejangizni boshlang. Birinchi ovqat eng muhimi!"),
          sound: true,
          data: { screen: "home" },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: m.hour,
          minute: m.minute,
          channelId: CHANNEL_GENERAL,
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
    await ensureChannels();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: trText("✅ Eslatmalar faol!"),
        body: trText("Kaloria.uz eslatmalari muvaffaqiyatli sozlandi."),
        sound: true,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, channelId: CHANNEL_MEALS },
    });
    return true;
  } catch {
    return false;
  }
}

/** Next Sunday 20:00 (today if it's Sunday before 20:00). */
export function nextWeeklyReportTime(now = new Date()): Date {
  const d = new Date(now);
  d.setHours(20, 0, 0, 0);
  const add = (7 - d.getDay()) % 7;
  d.setDate(d.getDate() + add);
  if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 7);
  return d;
}
