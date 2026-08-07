import { router } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { OnboardingLayout } from "@/components/OnboardingLayout";
import { SelectionCard } from "@/components/SelectionCard";
import { useApp } from "@/context/AppContext";

const OPTIONS = [
  { key: "intizom", label: "Intizom yo'qligi", icon: "bar-chart-2" },
  { key: "ovqat", label: "Noto'g'ri ovqatlanish odatlari", icon: "coffee" },
  { key: "qollab", label: "Qo'llab-quvvatlash yo'qligi", icon: "heart" },
  { key: "jadval", label: "Band jadval", icon: "calendar" },
];

export default function ObstaclesScreen() {
  const { profile, setProfile } = useApp();
  const [selected, setSelected] = useState<string[]>(profile.obstacles ?? []);

  const toggle = (key: string) => {
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleNext = () => {
    setProfile({ obstacles: selected });
    router.push("/onboarding/achievements");
  };

  return (
    <OnboardingLayout
      step={11}
      total={18}
      title="Maqsadlaringizga erishishda sizni nima to'xtatadi?"
      onNext={handleNext}
      onBack={() => router.back()}
      buttonDisabled={selected.length === 0}
    >
      <View style={styles.list}>
        {OPTIONS.map((opt) => (
          <SelectionCard
            key={opt.key}
            label={opt.label}
            icon={opt.icon}
            selected={selected.includes(opt.key)}
            onPress={() => toggle(opt.key)}
            multi
          />
        ))}
      </View>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  list: { marginTop: 8 },
});
