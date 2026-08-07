import { router } from "expo-router";
import React, { useState } from "react";
import { OnboardingLayout } from "@/components/OnboardingLayout";
import { WeightRuler } from "@/components/WeightRuler";
import { useApp } from "@/context/AppContext";

export default function HeightScreen() {
  const { profile, setProfile } = useApp();
  const [height, setHeight] = useState(profile.height ?? 170);

  const handleNext = () => {
    setProfile({ height });
    router.push("/onboarding/goal");
  };

  return (
    <OnboardingLayout
      step={6}
      total={18}
      title="Bo'yingiz qancha?"
      subtitle="Bu sizga shaxsiy kundalik reja yaratish uchun kerak"
      onNext={handleNext}
      onBack={() => router.back()}
    >
      <WeightRuler value={height} onChange={setHeight} min={100} max={220} unit="sm" />
    </OnboardingLayout>
  );
}
