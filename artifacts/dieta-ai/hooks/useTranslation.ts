import { useApp } from "@/context/AppContext";
import { translate, type Language } from "@/i18n";

export function useTranslation() {
  const { profile } = useApp();
  const lang = (profile.language ?? "uz") as Language;

  function t(key: string, params?: Record<string, string | number>): string {
    return translate(lang, key, params);
  }

  return { t, lang };
}
