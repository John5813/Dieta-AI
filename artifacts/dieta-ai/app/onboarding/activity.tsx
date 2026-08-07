import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { OnboardingLayout } from "@/components/OnboardingLayout";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

const OPTIONS: Array<{
  value: number;
  label: string;
  desc: string;
  icon: keyof typeof Feather.glyphMap;
}> = [
  {
    value: 1.2,
    label: "Kam harakatli",
    desc: "Ko'p o'tirib ishlash, deyarli sport yo'q",
    icon: "monitor",
  },
  {
    value: 1.375,
    label: "Yengil faol",
    desc: "Haftada 1–3 marta yengil mashq yoki yurish",
    icon: "wind",
  },
  {
    value: 1.55,
    label: "O'rtacha faol",
    desc: "Haftada 3–5 marta o'rtacha mashq",
    icon: "activity",
  },
  {
    value: 1.725,
    label: "Juda faol",
    desc: "Deyarli har kuni intensiv mashq",
    icon: "zap",
  },
  {
    value: 1.9,
    label: "Sportchi",
    desc: "Kuniga 2 marta mashq, og'ir jismoniy ish",
    icon: "award",
  },
];

export default function ActivityScreen() {
  const { profile, setProfile } = useApp();
  const colors = useColors();
  const [value, setValue] = useState<number>(profile.activityLevel ?? 1.375);

  const handleNext = () => {
    setProfile({ activityLevel: value });
    if (profile.goal === "saqlash") {
      router.push("/onboarding/motivation");
    } else {
      router.push("/onboarding/target-weight");
    }
  };

  return (
    <OnboardingLayout
      step={8}
      total={18}
      title="Kunlik faolligingiz qanday?"
      subtitle="Bu sizning kunlik kaloriya normangizni aniqlash uchun muhim"
      onNext={handleNext}
      onBack={() => router.back()}
      scrollable
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: 10, paddingBottom: 20 }}
      >
        {OPTIONS.map((opt) => {
          const selected = Math.abs(opt.value - value) < 0.001;
          return (
            <Pressable
              key={opt.value}
              onPress={() => setValue(opt.value)}
              style={({ pressed }) => [
                styles.row,
                {
                  backgroundColor: selected ? colors.secondary : colors.card,
                  borderColor: selected ? colors.primary : colors.border,
                  borderWidth: selected ? 2 : 1,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <View
                style={[
                  styles.iconCircle,
                  {
                    backgroundColor: selected ? colors.primary : colors.secondary,
                  },
                ]}
              >
                <Feather
                  name={opt.icon}
                  size={20}
                  color={selected ? colors.primaryForeground : colors.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: colors.text }]}>{opt.label}</Text>
                <Text style={[styles.desc, { color: colors.mutedForeground }]}>
                  {opt.desc}
                </Text>
              </View>
              {selected ? (
                <Feather name="check-circle" size={22} color={colors.primary} />
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderRadius: 16,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  desc: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
});
