import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { calculatePlan } from "@/lib/nutrition";

const STEPS = [
  "Sog'lomlashtirish rejasi moslanmoqda...",
  "BMR formulasi qo'llanmoqda...",
  "Metabolik yoshingiz hisoblanmoqda...",
  "Natijalar yakunlanmoqda...",
];

export default function LoadingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, setProfile } = useApp();
  const progress = useRef(new Animated.Value(0)).current;
  const [percent, setPercent] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  useEffect(() => {
    let cancelled = false;
    const listener = progress.addListener(({ value }) => {
      if (!cancelled) setPercent(Math.round(value * 100));
    });

    const stepTimers: ReturnType<typeof setTimeout>[] = [];
    STEPS.forEach((_, i) => {
      stepTimers.push(
        setTimeout(() => {
          if (!cancelled) setCompletedSteps((prev) => [...prev, i]);
        }, (i + 1) * 900)
      );
    });

    let navTimer: ReturnType<typeof setTimeout> | null = null;
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: 4000,
      useNativeDriver: false,
    });
    anim.start(({ finished }) => {
      if (!finished || cancelled) return;
      const plan = calculatePlan(profile);
      setProfile({
        dailyCalories: plan.calories,
        protein: plan.protein,
        carbs: plan.carbs,
        fat: plan.fat,
      });
      navTimer = setTimeout(() => {
        if (!cancelled) router.replace("/onboarding/plan");
      }, 300);
    });

    return () => {
      cancelled = true;
      anim.stop();
      progress.removeListener(listener);
      stepTimers.forEach(clearTimeout);
      if (navTimer) clearTimeout(navTimer);
    };
  }, []);

  const widthInterpolated = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: colors.background, paddingTop: insets.top + 20 },
      ]}
    >
      <Image
        source={require("../../assets/images/logo.png")}
        style={styles.logo}
        contentFit="contain"
      />
      <Text style={[styles.percent, { color: colors.text }]}>{percent}%</Text>
      <Text style={[styles.title, { color: colors.text }]}>
        Siz uchun hammasini{"\n"}sozlamoqdamiz
      </Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        Metabolik yoshingiz hisoblanmoqda...
      </Text>

      <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
        <Animated.View
          style={[styles.progressFill, { backgroundColor: colors.primary, width: widthInterpolated }]}
        />
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {STEPS.map((step, i) => {
          const done = completedSteps.includes(i);
          return (
            <View key={i} style={styles.stepRow}>
              <Text
                style={[
                  styles.stepText,
                  { color: done ? colors.text : colors.mutedForeground },
                ]}
              >
                {step}
              </Text>
              {done ? (
                <Feather name="check-circle" size={20} color={colors.primary} />
              ) : (
                <View style={[styles.emptyCircle, { borderColor: colors.border }]} />
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24, alignItems: "center" },
  logo: { width: 140, height: 140, marginBottom: 12 },
  percent: { fontSize: 52, fontFamily: "Inter_700Bold", marginBottom: 8 },
  title: { fontSize: 24, fontFamily: "Inter_700Bold", textAlign: "center", lineHeight: 32 },
  subtitle: { fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 4, marginBottom: 20 },
  progressTrack: { width: "100%", height: 12, borderRadius: 6, overflow: "hidden", marginBottom: 24 },
  progressFill: { height: "100%", borderRadius: 6 },
  card: {
    width: "100%",
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 16,
  },
  stepRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  stepText: { fontSize: 14, fontFamily: "Inter_400Regular", flex: 1 },
  emptyCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5 },
});
