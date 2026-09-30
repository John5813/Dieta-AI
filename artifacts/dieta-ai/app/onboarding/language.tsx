import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/components/i18n/Text";
import { OnboardingLayout } from "@/components/OnboardingLayout";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { LANGUAGES, tr, type AppLanguage } from "@/lib/i18n";

export default function LanguageScreen() {
  const { profile, setProfile } = useApp();
  const colors = useColors();
  const [selected, setSelected] = useState<AppLanguage>(profile.language ?? "uz");

  const handleNext = () => {
    setProfile({ language: selected });
    router.push("/onboarding/gender");
  };

  return (
    <OnboardingLayout
      step={2}
      total={18}
      title={tr("Iltimos, tilni tanlang")}
      onNext={handleNext}
      onBack={() => router.back()}
      buttonDisabled={!selected}
      scrollable
    >
      <View style={styles.list}>
        {LANGUAGES.map((lang) => {
          const on = selected === lang.code;
          return (
            <Pressable
              key={lang.code}
              onPress={() => {
                setSelected(lang.code);
                // Apply right away so the rest of this screen switches language too.
                setProfile({ language: lang.code });
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={({ pressed }) => [
                styles.row,
                {
                  backgroundColor: on ? colors.secondary : colors.card,
                  borderColor: on ? colors.primary : colors.border,
                  borderWidth: on ? 2 : 1,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text raw style={styles.flag}>
                {lang.flag}
              </Text>
              <View style={styles.flex1}>
                <Text raw style={[styles.name, { color: colors.text }]}>
                  {lang.native}
                </Text>
                <Text raw style={[styles.hint, { color: colors.mutedForeground }]}>
                  {lang.hint}
                </Text>
              </View>
              {on ? <Feather name="check-circle" size={22} color={colors.primary} /> : null}
            </Pressable>
          );
        })}
      </View>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  list: { gap: 8, marginTop: 8, paddingBottom: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12 },
  flag: { fontSize: 26 },
  name: { fontSize: 16, fontFamily: "Inter_700Bold" },
  hint: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 1 },
});
