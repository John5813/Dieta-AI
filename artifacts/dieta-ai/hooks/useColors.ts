import { useColorScheme } from "react-native";

import colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";

/**
 * The scheme the app draws in: the user's choice in the profile, or the
 * device setting when they chose "system". Defaults to light.
 */
export function useThemeScheme(): "light" | "dark" {
  const system = useColorScheme();
  const { profile } = useApp();
  const pref = profile.theme ?? "light";
  if (pref === "system") return system === "dark" ? "dark" : "light";
  return pref;
}

/** Design tokens for the active scheme plus scheme-independent values like `radius`. */
export function useColors() {
  const scheme = useThemeScheme();
  const palette = scheme === "dark" ? colors.dark : colors.light;
  return { ...palette, radius: colors.radius };
}

/**
 * Pale accent backgrounds (#DBEAFE behind a blue icon, etc.) glare on the dark
 * theme; there they become a translucent wash of the accent color instead.
 */
export function useTint() {
  const dark = useThemeScheme() === "dark";
  return (light: string, accent: string) => (dark ? `${accent}33` : light);
}
