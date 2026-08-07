import { router } from "expo-router";
import React from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";
import { DietitianAnimation } from "@/components/DietitianAnimation";
import { OnboardingLayout } from "@/components/OnboardingLayout";
import { useColors } from "@/hooks/useColors";

const { width } = Dimensions.get("window");

export default function ConfirmationScreen() {
  const colors = useColors();

  return (
    <OnboardingLayout
      step={13}
      total={18}
      title=""
      buttonText="Maqsadga erishish"
      onNext={() => router.push("/onboarding/transformation")}
      onBack={() => router.back()}
    >
      <View style={styles.center}>
        <DietitianAnimation size={width * 0.75} />
        <Text style={[styles.title, { color: colors.text }]}>
          Tushundik!{"\n"}Maqsadlaringizga{"\n"}erishishingizga{"\n"}yordam beramiz
        </Text>
      </View>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 28 },
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    lineHeight: 38,
  },
});
