import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";

/**
 * Identifies this install and (when premium) proves the purchase to the server,
 * so the server can apply per-user AI quotas. Both ride on every request to our
 * own /api/ as headers; nothing else is ever sent to other hosts.
 */

const DEVICE_KEY = "device_id";
let deviceId: string | null = null;
let deviceIdPromise: Promise<string> | null = null;
let premiumToken: string | null = null;

export function setPremiumToken(token: string | null | undefined): void {
  premiumToken = token || null;
}

export function getPremiumToken(): string | null {
  return premiumToken;
}

function newId(): string {
  return Array.from(Crypto.getRandomBytes(16), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function getDeviceId(): Promise<string> {
  if (deviceId) return Promise.resolve(deviceId);
  if (!deviceIdPromise) {
    deviceIdPromise = (async () => {
      try {
        const saved = await AsyncStorage.getItem(DEVICE_KEY);
        if (saved && /^[A-Za-z0-9_-]{16,64}$/.test(saved)) return (deviceId = saved);
      } catch {}
      const fresh = newId();
      try {
        await AsyncStorage.setItem(DEVICE_KEY, fresh);
      } catch {}
      return (deviceId = fresh);
    })();
  }
  return deviceIdPromise;
}

/** Wraps the global fetch once so every call to our API carries the headers. */
export function installApiHeaders(apiBase: string): void {
  const g = globalThis as { fetch: typeof fetch; __uzdietaFetchPatched?: boolean };
  if (g.__uzdietaFetchPatched) return;
  g.__uzdietaFetchPatched = true;
  const original = g.fetch.bind(globalThis);
  const prefix = `${apiBase.replace(/\/+$/, "")}/api/`;

  g.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.startsWith(prefix)) {
        const headers = new Headers(init?.headers ?? (typeof input === "object" && "headers" in input ? input.headers : undefined));
        if (!headers.has("x-device-id")) headers.set("x-device-id", await getDeviceId());
        if (premiumToken && !headers.has("authorization")) headers.set("authorization", `Bearer ${premiumToken}`);
        return original(input, { ...init, headers });
      }
    } catch {}
    return original(input, init);
  };
}
