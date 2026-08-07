import { router } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { OnboardingLayout } from "@/components/OnboardingLayout";
import { WeightRuler } from "@/components/WeightRuler";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

const BMI_MIN = 16;
const BMI_MAX = 40;

function calcBMI(weightKg: number, heightCm: number): number {
  const h = heightCm / 100;
  return weightKg / (h * h);
}

function safeWeightRange(heightCm: number): { min: number; max: number } {
  const h = heightCm / 100;
  return {
    min: Math.ceil(BMI_MIN * h * h),
    max: Math.floor(BMI_MAX * h * h),
  };
}

export default function TargetWeightScreen() {
  const { profile, setProfile } = useApp();
  const colors = useColors();
  const current = profile.currentWeight ?? 70;
  const heightCm = profile.height ?? 170;
  const isGain = profile.goal === "oshirish";
  const isLose = profile.goal === "ozish";

  const min = isGain ? current + 1 : 30;
  const max = isLose ? current - 1 : 200;

  const defaultTarget = isGain ? current + 5 : current - 5;
  const initial = (() => {
    const stored = profile.targetWeight;
    if (stored !== undefined && stored >= min && stored <= max) return stored;
    return Math.min(max, Math.max(min, defaultTarget));
  })();
  const [weight, setWeight] = useState(initial);

  const diff = current - weight;
  const targetBMI = calcBMI(weight, heightCm);
  const { min: safeMin, max: safeMax } = safeWeightRange(heightCm);
  const isTooLow = targetBMI < BMI_MIN;
  const isTooHigh = targetBMI > BMI_MAX;
  const isInvalid = isTooLow || isTooHigh;

  const handleNext = () => {
    if (isInvalid) return;
    setProfile({ targetWeight: weight });
    router.push("/onboarding/motivation");
  };

  const title = isGain
    ? "Qancha vazn olmoqchisiz?"
    : isLose
      ? "Qancha vazn yo'qotmoqchisiz?"
      : "Istalgan vazningiz qancha?";

  const hint = isGain
    ? `Hozirgi vazningizdan yuqori bo'lishi kerak (${current} kg dan ko'p)`
    : isLose
      ? `Hozirgi vazningizdan past bo'lishi kerak (${current} kg dan kam)`
      : null;

  return (
    <OnboardingLayout
      step={8}
      total={18}
      title={title}
      onNext={handleNext}
      onBack={() => router.back()}
      buttonDisabled={isInvalid}
    >
      <WeightRuler value={weight} onChange={setWeight} min={min} max={max} />

      {diff !== 0 && !isInvalid && (
        <View style={[styles.badge, { backgroundColor: colors.secondary }]}>
          <Text style={[styles.badgeText, { color: colors.primary }]}>
            {diff > 0 ? `▼ ${diff} kg ozish` : `▲ ${Math.abs(diff)} kg oshirish`}
          </Text>
        </View>
      )}

      {hint && !isInvalid && (
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>{hint}</Text>
      )}

      {isInvalid && (
        <View style={[styles.warningCard, { backgroundColor: "#FEF2F2", borderColor: "#DC2626" }]}>
          <Text style={styles.warningIcon}>⚠️</Text>
          <Text style={[styles.warningTitle, { color: "#DC2626" }]}>
            {isTooLow
              ? "Bu maqsad juda xavfli past vazn!"
              : "Bu maqsad juda yuqori vazn!"}
          </Text>
          <Text style={[styles.warningDesc, { color: "#7F1D1D" }]}>
            {isTooLow
              ? `${weight} kg maqsad siz uchun BMI ${targetBMI.toFixed(1)} ga teng — bu juda past va sog'liq uchun xavfli.`
              : `${weight} kg maqsad siz uchun BMI ${targetBMI.toFixed(1)} ga teng — bu juda yuqori va sog'liq uchun xavfli.`}
          </Text>
          <View style={[styles.rangeBox, { backgroundColor: "#ECFDF5", borderColor: "#16A34A" }]}>
            <Text style={[styles.rangeLabel, { color: "#166534" }]}>
              Bo'yingiz ({heightCm} sm) uchun xavfsiz maqsad vazn:
            </Text>
            <Text style={[styles.rangeValue, { color: "#15803D" }]}>
              {safeMin} kg — {safeMax} kg
            </Text>
            <Text style={[styles.rangeBmi, { color: "#166534" }]}>
              (BMI: {BMI_MIN}–{BMI_MAX} oralig'i)
            </Text>
          </View>
          <Text style={[styles.warningAsk, { color: "#7F1D1D" }]}>
            Iltimos, bo'yingiz, hozirgi vazningiz yoki maqsad vazningizni qayta kiriting:
          </Text>
          <View style={styles.fixBtns}>
            <Pressable
              onPress={() => router.push("/onboarding/height")}
              style={({ pressed }) => [
                styles.fixBtn,
                { backgroundColor: "#DC2626", opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={styles.fixBtnText}>Bo'yni qayta kiriting</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push("/onboarding/current-weight")}
              style={({ pressed }) => [
                styles.fixBtn,
                { backgroundColor: "#B91C1C", opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={styles.fixBtnText}>Hozirgi vaznni qayta kiriting</Text>
            </Pressable>
          </View>
        </View>
      )}

      {!isInvalid && (
        <View style={[styles.bmiInfo, { backgroundColor: colors.secondary }]}>
          <Text style={[styles.bmiText, { color: colors.mutedForeground }]}>
            Maqsad BMI:{" "}
            <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold" }}>
              {targetBMI.toFixed(1)}
            </Text>
            {"  ·  "}Xavfsiz: {BMI_MIN}–{BMI_MAX}
          </Text>
        </View>
      )}
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 16,
  },
  badgeText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  hint: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 12 },
  warningCard: {
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
    gap: 10,
    alignItems: "center",
  },
  warningIcon: { fontSize: 32 },
  warningTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  warningDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 19,
  },
  rangeBox: {
    width: "100%",
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    alignItems: "center",
    gap: 4,
  },
  rangeLabel: { fontSize: 12, fontFamily: "Inter_500Medium", textAlign: "center" },
  rangeValue: { fontSize: 20, fontFamily: "Inter_700Bold" },
  rangeBmi: { fontSize: 11, fontFamily: "Inter_400Regular" },
  warningAsk: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
    lineHeight: 19,
  },
  fixBtns: { width: "100%", gap: 8 },
  fixBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  fixBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  bmiInfo: {
    alignSelf: "center",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 12,
  },
  bmiText: { fontSize: 12, fontFamily: "Inter_400Regular" },
});
