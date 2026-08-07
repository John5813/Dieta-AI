import { router } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { OnboardingLayout } from "@/components/OnboardingLayout";
import { SelectionCard } from "@/components/SelectionCard";
import { useApp, Goal } from "@/context/AppContext";

export default function GoalScreen() {
  const { profile, setProfile } = useApp();
  const [selected, setSelected] = useState<Goal | null>(profile.goal ?? null);

  const handleNext = () => {
    if (!selected) return;
    setProfile({ goal: selected });
    router.push("/onboarding/current-weight");
  };

  return (
    <OnboardingLayout
      step={6}
      total={18}
      title="Maqsadingiz"
      subtitle="Bu sizga shaxsiy kundalik reja yaratish uchun kerak"
      onNext={handleNext}
      onBack={() => router.back()}
      buttonDisabled={!selected}
    >
      <View style={styles.list}>
        <SelectionCard
          label="Vazn oshirish"
          selected={selected === "oshirish"}
          onPress={() => setSelected("oshirish")}
        />
        <SelectionCard
          label="Vaznni saqlab qolish"
          selected={selected === "saqlash"}
          onPress={() => setSelected("saqlash")}
        />
        <SelectionCard
          label="Ozish"
          selected={selected === "ozish"}
          onPress={() => setSelected("ozish")}
        />
      </View>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  list: { gap: 0, marginTop: 8 },
});
