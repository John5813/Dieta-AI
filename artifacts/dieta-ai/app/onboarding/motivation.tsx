import { router } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { OnboardingLayout } from "@/components/OnboardingLayout";
import { SelectionCard } from "@/components/SelectionCard";
import { useApp } from "@/context/AppContext";

const OPTIONS = [
  { key: "salomatlik", label: "Sog'liqni yaxshilash", icon: "heart" },
  { key: "korinish", label: "Ko'rinishni yaxshilash", icon: "star" },
  { key: "energiya", label: "Ko'proq energiya", icon: "zap" },
  { key: "ishonch", label: "O'ziga ishonchni oshirish", icon: "award" },
  { key: "sport", label: "Sport ko'rsatkichlarini oshirish", icon: "activity" },
  { key: "boshqa", label: "Boshqa sabab", icon: "more-horizontal" },
];

export default function MotivationScreen() {
  const { profile, setProfile } = useApp();
  const [selected, setSelected] = useState<string[]>(
    (profile as any).motivations ?? []
  );

  const toggle = (key: string) => {
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleNext = () => {
    setProfile({ ...(profile as any), motivations: selected });
    router.push("/onboarding/speed");
  };

  return (
    <OnboardingLayout
      step={9}
      total={18}
      title="Asosiy motivatsiyangiz nima?"
      subtitle="Bir yoki bir nechtasini tanlang"
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
