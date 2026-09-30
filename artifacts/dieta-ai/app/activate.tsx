import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/components/i18n/Text";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { signInPremium } from "@/lib/premium";

/**
 * uzdieta://activate?login=…&password=… — the payment website's "Open in the
 * app" button lands here and signs the account in without retyping.
 */
export default function ActivateScreen() {
  const colors = useColors();
  const { login, password } = useLocalSearchParams<{ login?: string; password?: string }>();
  const { loading, onboardingComplete, activateSubscription } = useApp();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (loading || started.current) return;
    started.current = true;
    if (!login || !password) {
      router.replace("/onboarding/payment");
      return;
    }
    (async () => {
      const res = await signInPremium(String(login), String(password));
      if (!res.ok) {
        setError(res.error);
        return;
      }
      activateSubscription(res.premiumUntil, String(login).trim().toUpperCase());
      setDone(true);
      // A fresh install still needs its profile set up; premium is already on.
      setTimeout(() => router.replace(onboardingComplete ? "/(tabs)" : "/onboarding/language"), 1200);
    })();
  }, [loading, login, password, onboardingComplete, activateSubscription]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {error ? (
        <>
          <Feather name="alert-circle" size={40} color="#DC2626" />
          <Text style={[styles.title, { color: colors.text }]}>{error}</Text>
          <Pressable
            onPress={() => router.replace("/onboarding/payment")}
            style={({ pressed }) => [styles.btn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={styles.btnText}>Qo'lda kiritish</Text>
          </Pressable>
        </>
      ) : done ? (
        <>
          <View style={[styles.circle, { backgroundColor: colors.primary }]}>
            <Feather name="check" size={40} color="#fff" />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>Faollashtirildi!</Text>
        </>
      ) : (
        <ActivityIndicator size="large" color={colors.primary} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 16 },
  circle: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontFamily: "Inter_700Bold", textAlign: "center" },
  btn: { height: 50, borderRadius: 25, paddingHorizontal: 28, alignItems: "center", justifyContent: "center" },
  btnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
