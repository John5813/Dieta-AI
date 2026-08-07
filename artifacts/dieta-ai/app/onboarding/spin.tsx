import { router } from "expo-router";
import React, { useEffect } from "react";
import { View } from "react-native";
import { useApp } from "@/context/AppContext";

// Baraban aylantirish olib tashlandi — to'g'ridan-to'g'ri tabs ga o'tish
export default function SpinScreen() {
  const { subscription, startTrial, completeOnboarding } = useApp();

  useEffect(() => {
    (async () => {
      if (subscription.status === "none") {
        startTrial();
      }
      await completeOnboarding();
      router.replace("/(tabs)");
    })();
  }, []);

  return <View style={{ flex: 1 }} />;
}
