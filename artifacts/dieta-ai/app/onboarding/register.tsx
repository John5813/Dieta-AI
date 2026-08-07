import { router } from "expo-router";
import React, { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

export default function RegisterScreen() {
  const { setProfile } = useApp();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [phone, setPhone] = useState("");

  const handleNext = () => {
    // Sinov rejimi: har qanday raqam bilan o'tib ketamiz (yoki bo'sh)
    if (phone) setProfile({ phone });
    router.replace("/onboarding/language");
  };

  return (
    <KeyboardAvoidingView
      behavior="padding"
      keyboardVerticalOffset={0}
      style={[
        styles.root,
        { backgroundColor: colors.background, paddingTop: insets.top },
      ]}
    >
      <View style={[styles.sheet, { backgroundColor: colors.card }]}>
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
        <Text style={[styles.appName, { color: colors.primary }]}>Bir Burda</Text>

        <Text style={[styles.title, { color: colors.text }]}>
          Telefon raqam bilan kirish
        </Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Sinov rejimi: ixtiyoriy
        </Text>

        <View style={[styles.phoneRow, { backgroundColor: colors.input }]}>
          <View style={[styles.flagPill, { backgroundColor: colors.secondary }]}>
            <Text style={styles.flag}>🇺🇿</Text>
            <Text style={[styles.code, { color: colors.text }]}>+998</Text>
          </View>
          <TextInput
            style={[styles.phoneInput, { color: colors.text }]}
            placeholder="Telefon raqam (ixtiyoriy)"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
            maxLength={9}
          />
        </View>
        <Pressable
          onPress={handleNext}
          style={({ pressed }) => [
            styles.btn,
            { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={[styles.btnText, { color: colors.primaryForeground }]}>
            Davom etish
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  sheet: {
    flex: 1,
    marginTop: 120,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    alignItems: "center",
    gap: 14,
  },
  handle: { width: 40, height: 4, borderRadius: 2, marginBottom: 8 },
  appName: { fontSize: 22, fontFamily: "Inter_700Bold" },
  title: { fontSize: 17, fontFamily: "Inter_600SemiBold", textAlign: "center", lineHeight: 26 },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: -8 },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    overflow: "hidden",
    width: "100%",
  },
  flagPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 4,
  },
  flag: { fontSize: 18 },
  code: { fontSize: 14, fontFamily: "Inter_500Medium" },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 14,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  btn: {
    width: "100%",
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
