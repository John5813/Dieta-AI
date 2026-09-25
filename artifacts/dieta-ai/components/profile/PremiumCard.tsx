import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { isPremiumExpired, TRIAL_DAYS, type Subscription } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { formatUzDate } from "@/lib/nutrition";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Start nudging to renew this many days before premium runs out. */
const RENEW_SOON_DAYS = 14;

type State =
  | { kind: "active"; until: number; daysLeft: number }
  | { kind: "trial"; hoursLeft: number }
  | { kind: "expired"; until?: number }
  | { kind: "none" };

function getState(sub: Subscription, now: number): State {
  if (sub.status === "active") {
    if (isPremiumExpired(sub, now)) return { kind: "expired", until: sub.premiumUntil };
    const until = sub.premiumUntil ?? now;
    return { kind: "active", until, daysLeft: Math.max(0, Math.ceil((until - now) / DAY_MS)) };
  }
  if (sub.status === "trial" && sub.trialStartedAt) {
    const end = sub.trialStartedAt + TRIAL_DAYS * DAY_MS;
    if (now < end) return { kind: "trial", hoursLeft: Math.max(1, Math.ceil((end - now) / (60 * 60 * 1000))) };
    return { kind: "expired" };
  }
  return { kind: "none" };
}

export function PremiumCard({
  subscription,
  onBuy,
  onRestore,
}: {
  subscription: Subscription;
  onBuy: () => void;
  onRestore: () => void;
}) {
  const colors = useColors();
  const state = getState(subscription, Date.now());
  const isActive = state.kind === "active";
  const renewSoon = isActive && state.daysLeft <= RENEW_SOON_DAYS;

  const title =
    state.kind === "active"
      ? "Premium faol"
      : state.kind === "trial"
        ? "Bepul sinov"
        : state.kind === "expired"
          ? "Muddat tugagan"
          : "Premium faol emas";

  const subtitle =
    state.kind === "active"
      ? `${formatUzDate(new Date(state.until))} gacha · ${state.daysLeft} kun qoldi`
      : state.kind === "trial"
        ? `${state.hoursLeft} soat qoldi — keyin davom etish uchun Premium kerak`
        : state.kind === "expired"
          ? state.until
            ? `${formatUzDate(new Date(state.until))} da tugagan`
            : "AI tahlildan foydalanish uchun Premium oling"
          : "Cheksiz AI tahlil va shaxsiy reja uchun Premium oling";

  const accent = isActive && !renewSoon ? colors.primary : "#E07A1F";
  const tint = isActive && !renewSoon ? colors.secondary : "#FEF3C7";

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: isActive ? accent : colors.border }]}>
      <View style={styles.head}>
        <View style={[styles.badge, { backgroundColor: tint }]}>
          <Feather name={isActive ? "award" : state.kind === "trial" ? "clock" : "lock"} size={20} color={accent} />
        </View>
        <View style={styles.flex1}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.sub, { color: renewSoon ? accent : colors.mutedForeground }]}>{subtitle}</Text>
        </View>
      </View>

      {subscription.login && (isActive || state.kind === "expired") ? (
        <View style={[styles.loginRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <Feather name="key" size={14} color={colors.mutedForeground} />
          <Text style={[styles.loginText, { color: colors.mutedForeground }]}>
            Login: <Text style={{ color: colors.text, fontFamily: "Inter_700Bold" }}>{subscription.login}</Text>
          </Text>
        </View>
      ) : null}
      {isActive ? (
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          Telefon almashsa yoki ilova qayta o'rnatilsa, shu login va botdagi parol bilan Premium tiklanadi.
        </Text>
      ) : null}

      {!isActive || renewSoon ? (
        <View style={styles.actions}>
          <Pressable
            onPress={onBuy}
            style={({ pressed }) => [styles.primaryBtn, { backgroundColor: accent, opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={styles.primaryText}>{isActive ? "Muddatni uzaytirish" : "Premium olish"}</Text>
          </Pressable>
          {!isActive ? (
            <Pressable onPress={onRestore} style={({ pressed }) => [styles.linkBtn, { opacity: pressed ? 0.6 : 1 }]}>
              <Text style={[styles.linkText, { color: colors.primary }]}>Sotib olganman — login bilan tiklash</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  card: { borderRadius: 18, borderWidth: 1.5, padding: 16, gap: 12, marginBottom: 20 },
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  badge: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 17, fontFamily: "Inter_700Bold" },
  sub: { fontSize: 12.5, fontFamily: "Inter_500Medium", marginTop: 2, lineHeight: 17 },
  loginRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  loginText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  hint: { fontSize: 11.5, fontFamily: "Inter_400Regular", lineHeight: 16 },
  actions: { gap: 4 },
  primaryBtn: { height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  primaryText: { color: "#FFFFFF", fontSize: 15, fontFamily: "Inter_700Bold" },
  linkBtn: { alignSelf: "center", paddingVertical: 8 },
  linkText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
