import { router } from "expo-router";
import React, { useState, useRef } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  Platform,
} from "react-native";
import {
  useFonts,
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import { OnboardingLayout } from "@/components/OnboardingLayout";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

export default function NameScreen() {
  const { profile, setProfile } = useApp();
  const colors = useColors();
  const [name, setName] = useState<string>((profile.name as string) ?? "");
  const inputRef = useRef<TextInput>(null);

  useFonts({ Inter_400Regular, Inter_600SemiBold, Inter_700Bold });

  const trimmed = name.trim();

  const handleNext = () => {
    if (!trimmed) return;
    setProfile({ name: trimmed });
    router.push("/onboarding/comparison");
  };

  return (
    <OnboardingLayout
      step={4}
      total={19}
      title="Ismingizni kiriting"
      subtitle="Ilova sizga shaxsiy murojaat qilishi uchun kerak"
      onNext={handleNext}
      onBack={() => router.back()}
      buttonDisabled={!trimmed}
    >
      <View style={styles.inputWrap}>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>
          Ism
        </Text>
        <TextInput
          ref={inputRef}
          value={name}
          onChangeText={setName}
          placeholder="Masalan: Jasur"
          placeholderTextColor={colors.mutedForeground}
          autoFocus={Platform.OS !== "web"}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={handleNext}
          maxLength={40}
          style={[
            styles.input,
            {
              color: colors.text,
              backgroundColor: colors.card,
              borderColor: name.trim() ? colors.primary : colors.border,
            },
          ]}
        />
        {trimmed.length > 0 && (
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>
            Salom, {trimmed}! 👋
          </Text>
        )}
      </View>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  inputWrap: {
    marginTop: 24,
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 2,
  },
  input: {
    height: 54,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    fontSize: 18,
    fontFamily: "Inter_400Regular",
  },
  hint: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
    textAlign: "center",
  },
});
