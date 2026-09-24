import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "tz_offset_minutes";

let cachedOffsetMinutes: number | null = null;

export async function loadCachedOffset(): Promise<void> {
  try {
    const v = await AsyncStorage.getItem(STORAGE_KEY);
    if (v != null) {
      const n = parseInt(v, 10);
      if (!Number.isNaN(n)) cachedOffsetMinutes = n;
    }
  } catch {}
}

/**
 * Refreshes the cached timezone offset from the device's own timezone.
 * Previously this used GPS via expo-location to derive offset from
 * longitude; that required runtime permission and a heavy native module.
 * Device timezone is virtually always correct and removes ~1 MB native code
 * plus permission friction.
 */
export async function refreshLocationTimezone(): Promise<void> {
  try {
    // Date#getTimezoneOffset returns minutes WEST of UTC, so negate.
    cachedOffsetMinutes = -new Date().getTimezoneOffset();
    AsyncStorage.setItem(STORAGE_KEY, String(cachedOffsetMinutes)).catch(() => {});
  } catch {
    // Keep whatever was cached.
  }
}

function localDate(base: Date = new Date()): Date {
  if (cachedOffsetMinutes == null) return base;
  const utcMs = base.getTime() + base.getTimezoneOffset() * 60000;
  return new Date(utcMs + cachedOffsetMinutes * 60000);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function todayStr(): string {
  const d = localDate();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function yesterdayStr(): string {
  const d = localDate();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function getCachedOffsetMinutes(): number | null {
  return cachedOffsetMinutes;
}

/** Moves a "YYYY-MM-DD" key by `days` (negative = into the past). */
export function shiftDateKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}

const UZ_MONTHS_FULL = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
];

/** "18 sentabr" for a "YYYY-MM-DD" key. */
export function formatDateKeyUz(key: string): string {
  const [, m, d] = key.split("-").map(Number);
  return `${d} ${UZ_MONTHS_FULL[m - 1] ?? ""}`.trim();
}

/**
 * Normalizes a "YYYY-M-D" or "YYYY-MM-DD" date key to the zero-padded
 * "YYYY-MM-DD" form used everywhere. Diary entries / burned-calorie keys
 * saved before todayStr()/yesterdayStr() were zero-padded are stored on
 * existing devices as e.g. "2026-9-5" — normalizing on read lets those
 * legacy values keep matching stats/home-screen lookups without a
 * separate migration step.
 */
export function normalizeDateKey(raw: string): string {
  const parts = raw.split("-");
  if (parts.length !== 3) return raw;
  const [y, m, d] = parts;
  const mNum = Number(m);
  const dNum = Number(d);
  if (!y || !Number.isFinite(mNum) || !Number.isFinite(dNum)) return raw;
  return `${y}-${pad2(mNum)}-${pad2(dNum)}`;
}
