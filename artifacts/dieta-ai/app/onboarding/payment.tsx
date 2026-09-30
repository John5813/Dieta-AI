import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text, TextInput } from "@/components/i18n/Text";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { CAN_BUY_IN_APP, openPurchasePage, signInPremium } from "@/lib/premium";

/**
 * Premium sign-in. Store builds only take an existing account's login and
 * password; buying happens on the website (see lib/premium.ts). The route keeps
 * its old name so existing links into it still work.
 */
export default function PremiumSignInScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { activateSubscription, completeOnboarding, onboardingComplete, profile, startTrial, subscription } = useApp();

  const [login, setLogin] = useState(subscription.login ?? "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [credErr, setCredErr] = useState<string | null>(null);
  const [activated, setActivated] = useState(false);
  const [showTrialOffer, setShowTrialOffer] = useState(false);
  // Offer the free trial once; closing again just leaves (the free app stays usable).
  const [trialOffered, setTrialOffered] = useState(false);

  const signIn = async () => {
    setCredErr(null);
    if (!login.trim() || !password.trim()) {
      setCredErr("Login va parolni kiriting");
      return;
    }
    setBusy(true);
    const res = await signInPremium(login, password);
    setBusy(false);
    if (!res.ok) {
      setCredErr(res.error);
      return;
    }
    activateSubscription(res.premiumUntil, login.trim().toUpperCase());
    setActivated(true);
    setTimeout(async () => {
      if (onboardingComplete) {
        router.replace("/(tabs)");
        return;
      }
      await completeOnboarding();
      try {
        await AsyncStorage.setItem("onboarding_complete", "true");
      } catch {}
      router.replace("/(tabs)");
    }, 1200);
  };

  const handleSkip = () => {
    if (subscription.status === "none" && !trialOffered) {
      setTrialOffered(true);
      setShowTrialOffer(true);
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  };

  const acceptTrial = async () => {
    setShowTrialOffer(false);
    startTrial();
    await completeOnboarding();
    router.replace("/(tabs)");
  };

  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        handleSkip();
        return true;
      };
      const sub = BackHandler.addEventListener("hardwareBackPress", onBack);
      return () => sub.remove();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [subscription.status]),
  );

  if (activated) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }]}>
        <View style={[styles.successCircle, { backgroundColor: colors.primary }]}>
          <Feather name="check" size={40} color="#fff" />
        </View>
        <Text style={[styles.successTitle, { color: colors.text }]}>Faollashtirildi!</Text>
        <Text style={[styles.successSub, { color: colors.mutedForeground }]}>
          Ilovadan to'liq foydalanishingiz mumkin
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior="padding" keyboardVerticalOffset={0}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topRow}>
          <TouchableOpacity onPress={handleSkip} hitSlop={10} style={styles.closeBtn}>
            <Feather name="x" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Hisobga kirish</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.sectionIconWrap, { backgroundColor: colors.secondary }]}>
            <Feather name="key" size={22} color={colors.primary} />
          </View>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Premium hisobingizga kiring</Text>
          <Text style={[styles.sectionDesc, { color: colors.mutedForeground }]}>
            Premium hisobingizning login va parolini kiriting. Telefon almashtirsangiz ham shu ma'lumotlar bilan kirasiz.
          </Text>

          <Text style={[styles.label, { color: colors.text }]}>Login</Text>
          <TextInput
            value={login}
            onChangeText={(v) => {
              setLogin(v);
              setCredErr(null);
            }}
            placeholder="Masalan: DAI-ABC234"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="username"
            textContentType="username"
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
          />

          <Text style={[styles.label, { color: colors.text }]}>Parol</Text>
          <TextInput
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              setCredErr(null);
            }}
            placeholder="Parol"
            placeholderTextColor={colors.mutedForeground}
            secureTextEntry
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="password"
            textContentType="password"
            onSubmitEditing={signIn}
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
          />

          {credErr && (
            <View style={[styles.errBox, { backgroundColor: "#FEE2E2" }]}>
              <Feather name="alert-circle" size={14} color="#DC2626" />
              <Text style={styles.errText}>{credErr}</Text>
            </View>
          )}

          <Pressable
            onPress={signIn}
            disabled={busy}
            style={({ pressed }) => [
              styles.cta,
              { backgroundColor: colors.primary, opacity: pressed || busy ? 0.8 : 1, marginTop: 8 },
            ]}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Feather name="log-in" size={18} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.ctaText}>Kirish</Text>
              </>
            )}
          </Pressable>
        </View>

        {CAN_BUY_IN_APP ? (
          <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Premium hisobingiz yo'qmi?</Text>
            <Text style={[styles.sectionDesc, { color: colors.mutedForeground }]}>
              Click, Payme, Uzum yoki bank kartasi orqali to'lang — login va parol darhol beriladi.
            </Text>
            <Pressable
              onPress={() => openPurchasePage(profile.language, subscription.login)}
              style={({ pressed }) => [styles.cta, { backgroundColor: colors.text, opacity: pressed ? 0.85 : 1 }]}
            >
              <Text style={styles.ctaText}>Premium olish</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={[styles.helpNote, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <Feather name="info" size={14} color={colors.mutedForeground} style={{ marginTop: 2 }} />
          <Text style={[styles.helpText, { color: colors.mutedForeground }]}>
            Login va parolni saqlab qo'ying — telefon almashtirsangiz yoki ilovani qayta o'rnatsangiz, Premiumni shu bilan tiklaysiz.
          </Text>
        </View>
      </ScrollView>

      <Modal visible={showTrialOffer} transparent animationType="fade" onRequestClose={() => setShowTrialOffer(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <View style={[styles.modalIconWrap, { backgroundColor: colors.secondary }]}>
              <Feather name="gift" size={28} color={colors.primary} />
            </View>
            <Text style={[styles.modalTitle, { color: colors.text }]}>1 kun bepul sinab ko'ring</Text>
            <Text style={[styles.modalDesc, { color: colors.mutedForeground }]}>
              AI rasm tahlilini 24 soat bepul sinab ko'ring. Kundalik, suv, qadam va boshqa asosiy funksiyalar keyin ham bepul qoladi.
            </Text>
            <Pressable
              onPress={acceptTrial}
              style={({ pressed }) => [styles.modalPrimary, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
            >
              <Text style={styles.modalPrimaryText}>Bepul boshlash</Text>
            </Pressable>
            <TouchableOpacity onPress={() => setShowTrialOffer(false)} style={styles.modalSecondary}>
              <Text style={[styles.modalSecondaryText, { color: colors.text }]}>Yopish</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 32, gap: 16 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  closeBtn: { width: 40, height: 40, justifyContent: "center" },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  sectionCard: { borderRadius: 16, borderWidth: 1, padding: 18, gap: 10 },
  sectionIconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  sectionDesc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  label: { fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: -4 },
  input: { height: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 15, fontFamily: "Inter_400Regular" },
  errBox: { flexDirection: "row", alignItems: "flex-start", gap: 6, padding: 10, borderRadius: 10 },
  errText: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#DC2626", flex: 1 },
  cta: { height: 52, borderRadius: 26, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  ctaText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#fff" },
  helpNote: { flexDirection: "row", gap: 8, padding: 14, borderRadius: 12, borderWidth: 1, alignItems: "flex-start" },
  helpText: { fontSize: 12, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 18 },
  successCircle: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center", marginBottom: 20 },
  successTitle: { fontSize: 24, fontFamily: "Inter_700Bold", marginBottom: 8 },
  successSub: { fontSize: 15, fontFamily: "Inter_400Regular", textAlign: "center" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", paddingHorizontal: 28 },
  modalCard: { width: "100%", borderRadius: 24, padding: 24, alignItems: "center" },
  modalIconWrap: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold", textAlign: "center", marginBottom: 10 },
  modalDesc: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 21, marginBottom: 22 },
  modalPrimary: { width: "100%", height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center" },
  modalPrimaryText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
  modalSecondary: { alignItems: "center", marginTop: 12, padding: 8 },
  modalSecondaryText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
