import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "https://dietaai-lexhk.ondigitalocean.app";

/**
 * Premium is sold on our website, never inside the store builds: App Store and
 * Google Play reject apps that sell digital access through anything but their
 * own billing, or that point users to another way to pay. So the iOS/Android
 * app only lets people sign in with an account they already have; the purchase
 * button and link exist only in the web build.
 */
export const CAN_BUY_IN_APP = Platform.OS === "web";

export function purchaseUrl(language?: string, renewLogin?: string): string {
  const q = new URLSearchParams();
  if (language) q.set("lang", language);
  if (renewLogin) q.set("login", renewLogin);
  const qs = q.toString();
  return `${API_BASE}/pay${qs ? `?${qs}` : ""}`;
}

/** Web build only: opens the payment page. */
export async function openPurchasePage(language?: string, renewLogin?: string): Promise<void> {
  if (!CAN_BUY_IN_APP) return;
  const url = purchaseUrl(language, renewLogin);
  if (typeof window !== "undefined") window.location.assign(url);
  else await WebBrowser.openBrowserAsync(url);
}

export type SignInResult = { ok: true; premiumUntil?: number } | { ok: false; error: string };

/** Signs in with a premium account (login + password from the website or the bot). */
export async function signInPremium(login: string, password: string): Promise<SignInResult> {
  try {
    const r = await fetch(`${API_BASE}/api/payment/restore/redeem`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ login: login.trim(), password: password.trim() }),
    });
    const data = (await r.json().catch(() => ({}))) as { success?: boolean; premiumUntil?: string; error?: string };
    if (!r.ok || !data.success) {
      // The server writes Uzbek with ʻ; the app's dictionary keys use a plain apostrophe.
      return { ok: false, error: (data.error || "Login yoki parol noto'g'ri").replace(/[ʻʼ’]/g, "'") };
    }
    return { ok: true, premiumUntil: data.premiumUntil ? new Date(data.premiumUntil).getTime() : undefined };
  } catch {
    return { ok: false, error: "Internet bilan bog'lanib bo'lmadi. Qaytadan urinib ko'ring." };
  }
}
