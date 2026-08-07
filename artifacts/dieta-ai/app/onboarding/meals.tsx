import { router } from "expo-router";
import React, { useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { OnboardingLayout } from "@/components/OnboardingLayout";
import { SelectionCard } from "@/components/SelectionCard";
import { useApp } from "@/context/AppContext";
import { requestPermissionWithRationale } from "@/lib/notifications";

const OPTIONS = [
  { key: 2, label: "2 marta" },
  { key: 3, label: "3 marta" },
  { key: 4, label: "4 marta" },
  { key: 5, label: "5 marta" },
  { key: 6, label: "6 marta" },
];

export default function MealsScreen() {
  const { profile, setProfile } = useApp();
  const [selected, setSelected] = useState<number | null>(profile.mealsPerDay ?? null);
  const [busy, setBusy] = useState(false);

  const handleNext = async () => {
    if (!selected || busy) return;
    setBusy(true);
    // MUHIM: avval ruxsat so'raymiz — keyin setProfile chaqiramiz, shunda
    // reschedule effekti allaqachon ruxsat bilan ishlay boshlaydi.
    if (Platform.OS !== "web") {
      try {
        await requestPermissionWithRationale();
      } catch {}
    }
    setProfile({
      mealsPerDay: selected,
      notificationsEnabled: profile.notificationsEnabled ?? true,
      mealRemindersEnabled: profile.mealRemindersEnabled ?? true,
      waterRemindersEnabled: profile.waterRemindersEnabled ?? true,
      dailySummaryEnabled: profile.dailySummaryEnabled ?? true,
      morningGreetingEnabled: profile.morningGreetingEnabled ?? true,
    });
    setBusy(false);
    router.push("/onboarding/loading");
  };

  return (
    <OnboardingLayout
      step={15}
      total={18}
      title="Kuniga necha marta ovqatlanasiz?"
      onNext={handleNext}
      onBack={() => router.back()}
      buttonDisabled={!selected || busy}
    >
      <View style={styles.list}>
        {OPTIONS.map((opt) => (
          <SelectionCard
            key={opt.key}
            label={opt.label}
            selected={selected === opt.key}
            onPress={() => setSelected(opt.key)}
          />
        ))}
      </View>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({ list: { marginTop: 8 } });
