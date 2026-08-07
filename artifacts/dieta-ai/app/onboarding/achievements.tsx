import { router } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { OnboardingLayout } from "@/components/OnboardingLayout";
import { SelectionCard } from "@/components/SelectionCard";
import { useApp } from "@/context/AppContext";

const OPTIONS = [
  { key: "soglom", label: "Sog'lom ovqatlanish", icon: "heart" },
  { key: "energiya", label: "Energiya va kayfiyatni oshirish", icon: "sun" },
  { key: "motivatsiya", label: "Motivatsiyaga ega va intizomli bo'lish", icon: "trending-up" },
  { key: "tana", label: "Tana yaxshiroq ko'rinishi", icon: "user" },
];

export default function AchievementsScreen() {
  const { profile, setProfile } = useApp();
  const [selected, setSelected] = useState<string[]>(profile.achievements ?? []);

  const toggle = (key: string) => {
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleNext = () => {
    setProfile({ achievements: selected });
    router.push("/onboarding/confirmation");
  };

  return (
    <OnboardingLayout
      step={12}
      total={18}
      title="Nimaga erishishni xohlardingiz?"
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

const styles = StyleSheet.create({ list: { marginTop: 8 } });
