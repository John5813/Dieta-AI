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

export function todayStr(): string {
  const d = localDate();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function yesterdayStr(): string {
  const d = localDate();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function getCachedOffsetMinutes(): number | null {
  return cachedOffsetMinutes;
}
