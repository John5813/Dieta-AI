import { router } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { OnboardingLayout } from "@/components/OnboardingLayout";
import { SelectionCard } from "@/components/SelectionCard";
import { useApp, Language } from "@/context/AppContext";

const LANGUAGES: { key: Language; label: string; sublabel: string; flag: string }[] = [
  { key: "uz", label: "O'zbekcha", sublabel: "Lotin alifbosi", flag: "🇺🇿" },
  { key: "uz-kril", label: "Ўзбекча", sublabel: "Кирил алифбоси", flag: "🇺🇿" },
  { key: "ru", label: "Русский", sublabel: "Кириллица", flag: "🇷🇺" },
];

const TITLE: Record<Language, string> = {
  uz: "Iltimos, tilni tanlang",
  "uz-kril": "Илтимос, тилни танланг",
  ru: "Пожалуйста, выберите язык",
  en: "Please select a language",
};

export default function LanguageScreen() {
  const { profile, setProfile } = useApp();
  const [selected, setSelected] = useState<Language>(profile.language ?? "uz");

  const handleNext = () => {
    setProfile({ language: selected });
    router.push("/onboarding/gender");
  };

  const title = TITLE[selected] ?? TITLE["uz"];

  return (
    <OnboardingLayout
      step={2}
      total={18}
      title={title}
      onNext={handleNext}
      onBack={() => router.back()}
      buttonDisabled={!selected}
    >
      <View style={styles.list}>
        {LANGUAGES.map((lang) => (
          <View key={lang.key} style={styles.row}>
            <Text style={styles.flag}>{lang.flag}</Text>
            <View style={styles.cardWrap}>
              <SelectionCard
                label={lang.label}
                sublabel={lang.sublabel}
                selected={selected === lang.key}
                onPress={() => setSelected(lang.key)}
              />
            </View>
          </View>
        ))}
      </View>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8, marginTop: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  flag: { fontSize: 28 },
  cardWrap: { flex: 1 },
});
