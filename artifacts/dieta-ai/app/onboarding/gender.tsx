import { router } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { BodyAvatar } from "@/components/BodyAvatar";
import { OnboardingLayout } from "@/components/OnboardingLayout";
import { useApp, Gender } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

export default function GenderScreen() {
  const { profile, setProfile } = useApp();
  const colors = useColors();
  const [selected, setSelected] = useState<Gender | null>(profile.gender ?? null);

  const handleNext = () => {
    if (!selected) return;
    setProfile({ gender: selected });
    router.push("/onboarding/name");
  };

  const Card = ({ value, label }: { value: Gender; label: string }) => {
    const active = selected === value;
    return (
      <Pressable
        onPress={() => setSelected(value)}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected: active }}
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: active ? colors.secondary : colors.card,
            borderColor: active ? colors.primary : colors.border,
            borderWidth: active ? 2 : 1.5,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <View style={styles.avatarWrap}>
          <BodyAvatar
            variant="after"
            gender={value}
            width={110}
            height={180}
          />
        </View>
        <Text style={[styles.label, { color: active ? colors.primary : colors.text }]}>
          {label}
        </Text>
        {active && (
          <View style={[styles.checkBadge, { backgroundColor: colors.primary }]}>
            <Feather name="check" size={14} color={colors.primaryForeground} />
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <OnboardingLayout
      step={3}
      total={18}
      title="Iltimos, jinsingizni tanlang"
      subtitle="Bu sizga shaxsiy kundalik reja yaratish uchun kerak"
      onNext={handleNext}
      onBack={() => router.back()}
      buttonDisabled={!selected}
    >
      <View style={styles.list}>
        <Card value="erkak" label="Erkak" />
        <Card value="ayol" label="Ayol" />
      </View>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  list: { flexDirection: "row", gap: 12, marginTop: 16 },
  card: {
    flex: 1,
    height: 260,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    position: "relative",
  },
  avatarWrap: { flex: 1, justifyContent: "center", alignItems: "center" },
  label: { fontSize: 16, fontFamily: "Inter_700Bold", marginTop: 4 },
  checkBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});
