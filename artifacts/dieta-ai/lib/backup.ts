import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { customFetch } from "@/lib/api-client";
import { ALL_DATA_KEYS } from "@/lib/storageKeys";

const CODE_KEY = "backup_code";
const META_KEY = "backup_meta";
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
/** Auto backup at most this often. */
const AUTO_INTERVAL_MS = 6 * 60 * 60 * 1000;

// Premium is restored with the bot login, not from a backup, and onboarding
// state is set explicitly on restore.
const EXCLUDED = new Set(["subscription", "onboarding_complete", "ratsion_plan"]);
const BACKUP_KEYS = ALL_DATA_KEYS.filter((k) => !EXCLUDED.has(k));

export interface BackupMeta {
  lastBackupAt?: number;
}

interface BackupPayload {
  version: 1;
  createdAt: number;
  items: Record<string, string>;
}

/** "UZD-XXXX-XXXX-XXXX-XXXX" from 16 random base32 characters. */
export function generateBackupCode(): string {
  const bytes = Crypto.getRandomBytes(16);
  const chars = Array.from(bytes, (b) => ALPHABET[b % 32]).join("");
  return `UZD-${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}-${chars.slice(12, 16)}`;
}

/** Tolerates lowercase, spaces and missing dashes when the user types a code. */
export function normalizeBackupCode(input: string): string | null {
  const raw = input.toUpperCase().replace(/[^A-Z2-7]/g, "");
  const body = raw.startsWith("UZD") ? raw.slice(3) : raw;
  if (body.length !== 16) return null;
  return `UZD-${body.slice(0, 4)}-${body.slice(4, 8)}-${body.slice(8, 12)}-${body.slice(12, 16)}`;
}

export async function getBackupCode(): Promise<string | null> {
  return AsyncStorage.getItem(CODE_KEY);
}

export async function getBackupMeta(): Promise<BackupMeta> {
  try {
    return JSON.parse((await AsyncStorage.getItem(META_KEY)) ?? "{}") as BackupMeta;
  } catch {
    return {};
  }
}

async function collect(): Promise<BackupPayload> {
  const pairs = await AsyncStorage.multiGet(BACKUP_KEYS);
  const items: Record<string, string> = {};
  for (const [k, v] of pairs) if (v != null) items[k] = v;
  return { version: 1, createdAt: Date.now(), items };
}

/** Uploads everything now; creates and stores a code on first use. Returns the code. */
export async function backupNow(): Promise<{ code: string; at: number }> {
  let code = await getBackupCode();
  if (!code) code = generateBackupCode();
  const payload = await collect();
  await customFetch("/api/backup", {
    method: "PUT",
    headers: { "x-backup-code": code },
    body: JSON.stringify({ data: payload }),
  });
  await AsyncStorage.multiSet([
    [CODE_KEY, code],
    [META_KEY, JSON.stringify({ lastBackupAt: payload.createdAt } satisfies BackupMeta)],
  ]);
  return { code, at: payload.createdAt };
}

/** Backs up in the background if a code exists, there is data, and the last backup is old. */
export async function maybeAutoBackup(): Promise<void> {
  const code = await getBackupCode();
  if (!code) return;
  const meta = await getBackupMeta();
  if (meta.lastBackupAt && Date.now() - meta.lastBackupAt < AUTO_INTERVAL_MS) return;
  // Never replace a good cloud copy with an empty install.
  if (!(await AsyncStorage.getItem("user_profile"))) return;
  await backupNow();
}

export async function fetchBackup(code: string): Promise<{ payload: BackupPayload; updatedAt: string }> {
  const res = await customFetch<{ data: BackupPayload; updatedAt: string }>("/api/backup", {
    headers: { "x-backup-code": code },
  });
  if (!res?.data || res.data.version !== 1 || typeof res.data.items !== "object") {
    throw new Error("Zaxira formati noto'g'ri");
  }
  return { payload: res.data, updatedAt: res.updatedAt };
}

/** Replaces local data with the backup; caller then reloads app state. */
export async function applyBackup(code: string, payload: BackupPayload): Promise<void> {
  await AsyncStorage.multiRemove(BACKUP_KEYS);
  const entries = Object.entries(payload.items).filter(([k]) => BACKUP_KEYS.includes(k));
  await AsyncStorage.multiSet([
    ...entries,
    ["onboarding_complete", "true"],
    [CODE_KEY, code],
    [META_KEY, JSON.stringify({ lastBackupAt: Date.now() } satisfies BackupMeta)],
  ]);
}

export function backupItemCount(payload: BackupPayload): { entries: number; days: number } {
  try {
    const list = JSON.parse(payload.items["diary_entries"] ?? "[]") as Array<{ date: string }>;
    return { entries: list.length, days: new Set(list.map((e) => e.date)).size };
  } catch {
    return { entries: 0, days: 0 };
  }
}

/** Server's Uzbek error text when there is one, otherwise a network message. */
export function backupErrorMessage(err: unknown): string {
  const data = (err as { data?: { error?: unknown } } | null)?.data;
  if (data && typeof data.error === "string") return data.error;
  return "Internet bilan bog'lanib bo'lmadi. Qaytadan urinib ko'ring.";
}
