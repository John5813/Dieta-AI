import { router } from "expo-router";
import React, { useState } from "react";
import { OnboardingLayout } from "@/components/OnboardingLayout";
import { WeightRuler } from "@/components/WeightRuler";
import { useApp } from "@/context/AppContext";

export default function CurrentWeightScreen() {
  const { profile, setProfile } = useApp();
  const [weight, setWeight] = useState(profile.currentWeight ?? 70);

  const handleNext = () => {
    if (profile.goal === "saqlash") {
      setProfile({ currentWeight: weight, targetWeight: weight });
    } else {
      setProfile({ currentWeight: weight });
    }
    router.push("/onboarding/activity");
  };

  return (
    <OnboardingLayout
      step={7}
      total={18}
      title="Hozirgi vazningiz qancha?"
      subtitle="Bu sizga shaxsiy kundalik reja yaratish uchun kerak"
      onNext={handleNext}
      onBack={() => router.back()}
    >
      <WeightRuler value={weight} onChange={setWeight} />
    </OnboardingLayout>
  );
}
