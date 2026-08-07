import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import { Feather } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import Slider from "@react-native-community/slider";
import { OnboardingLayout } from "@/components/OnboardingLayout";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { calculatePlan } from "@/lib/nutrition";

export default function SpeedScreen() {
  const { profile, setProfile } = useApp();
  const colors = useColors();
  const [speed, setSpeed] = useState(profile.speedKgPerWeek ?? 0.5);
  const isMaintain = profile.goal === "saqlash";
  const isGain = profile.goal === "oshirish";

  const maxSafeSpeed = useMemo(() => {
    for (let s = 150; s >= 1; s--) {
      const sp = s / 100;
      const p = calculatePlan({ ...profile, speedKgPerWeek: sp });
      if (!p.isCaloriesClamped) return sp;
    }
    return 0.1;
  }, [profile]);

  const effectiveSpeed = Math.min(speed, maxSafeSpeed);

  const plan = useMemo(
    () => calculatePlan({ ...profile, speedKgPerWeek: effectiveSpeed }),
    [profile, effectiveSpeed],
  );

  const handleNext = () => {
    setProfile({ speedKgPerWeek: isMaintain ? 0 : effectiveSpeed });
    router.push("/onboarding/obstacles");
  };

  if (isMaintain) {
    return (
      <OnboardingLayout
        step={10}
        total={18}
        title="Sizning vazningiz ideal!"
        subtitle="Buni saqlash qiyin emas"
        onNext={handleNext}
        onBack={() => router.back()}
      >
        <View style={styles.center}>
          <View style={[styles.iconCircle, { backgroundColor: colors.secondary }]}>
            <Feather name="check" size={56} color={colors.primary} />
          </View>
          <View style={[styles.infoCard, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.infoText, { color: colors.text }]}>
              Bir Burda sizga ideal vazningizni oson va sog'lom tarzda saqlab qolishda yordam beradi.
              Hech qanday qattiq cheklov yo'q — faqat to'g'ri ovqatlanish odatlari.
            </Text>
          </View>
        </View>
      </OnboardingLayout>
    );
  }

  return (
    <OnboardingLayout
      step={10}
      total={18}
      title="Maqsadingizga qanchalik tez yetmoqchisiz?"
      onNext={handleNext}
      onBack={() => router.back()}
    >
      <View style={styles.center}>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>
          Haftada vazn {isGain ? "oshirish" : "yo'qotish"} tezligi
        </Text>
        <Text style={[styles.value, { color: colors.text }]}>
          {speed.toFixed(1)} kg
        </Text>
        <View style={styles.sliderWrap}>
          <Slider
            minimumValue={0.1}
            maximumValue={1.5}
            step={0.1}
            value={speed}
            onValueChange={setSpeed}
            minimumTrackTintColor={colors.primary}
            maximumTrackTintColor={colors.border}
            thumbTintColor={colors.primary}
            style={{ width: "100%", height: 48 }}
          />
          <View style={styles.sliderLabels}>
            <Text style={[styles.sliderLabel, { color: colors.mutedForeground }]}>0.1 kg</Text>
            <Text style={[styles.sliderLabel, { color: colors.mutedForeground }]}>1.5 kg</Text>
          </View>
        </View>

        <View style={[styles.previewCard, { backgroundColor: colors.secondary }]}>
          <Text style={[styles.previewLabel, { color: colors.mutedForeground }]}>
            Kunlik kaloriya norma
          </Text>
          <Text style={[styles.previewValue, { color: colors.primary }]}>
            {plan.calories} kkal/kun
          </Text>
          <Text style={[styles.previewMin, { color: colors.mutedForeground }]}>
            Xavfsiz minimum: {plan.minCalories} kkal
          </Text>
        </View>
      </View>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  label: { fontSize: 15, fontFamily: "Inter_400Regular", textAlign: "center" },
  value: { fontSize: 40, fontFamily: "Inter_700Bold" },
  sliderWrap: { width: "100%", marginTop: 8 },
  sliderLabels: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  sliderLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  previewCard: {
    width: "100%",
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    gap: 4,
  },
  previewLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  previewValue: { fontSize: 22, fontFamily: "Inter_700Bold" },
  previewMin: { fontSize: 11, fontFamily: "Inter_400Regular" },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  infoCard: { borderRadius: 14, padding: 18 },
  infoText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 21 },
});
