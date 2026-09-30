import { Alert, I18nManager, Platform } from "react-native";
import { isRtlLanguage, trText } from "@/lib/i18n";

/**
 * Persian lays out right-to-left. On phones the direction only
 * changes after the app restarts, so this stores it and returns whether a
 * restart is needed; on web the document direction switches immediately.
 */
export function syncLayoutDirection(language: string | undefined): boolean {
  const rtl = isRtlLanguage(language);
  if (Platform.OS === "web") {
    if (typeof document !== "undefined") document.documentElement.dir = rtl ? "rtl" : "ltr";
    return false;
  }
  if (I18nManager.isRTL === rtl) return false;
  I18nManager.allowRTL(rtl);
  I18nManager.forceRTL(rtl);
  return true;
}

export function askToRestartForDirection(): void {
  Alert.alert(
    trText("Ilovani qayta oching"),
    trText("Tanlangan til o'ngdan chapga yoziladi. To'liq ko'rinishi uchun ilovani yopib, qaytadan oching."),
  );
}
