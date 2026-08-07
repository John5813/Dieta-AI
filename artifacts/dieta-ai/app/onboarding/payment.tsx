import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "https://dietaai-lexhk.ondigitalocean.app";

const FALLBACK_BOT_USERNAME =
  process.env.EXPO_PUBLIC_BOT_USERNAME || "UzDieta_AI_bot";

type InitResponse = {
  paymentId: string;
  linkToken: string;
  botUsername: string | null;
  botUrl: string | null;
  amount: number;
};

const PAYMENT_STORAGE_KEY = "active_payment_session";

export default function PaymentScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { activateSubscription, completeOnboarding, profile, startTrial, subscription } = useApp();

  const [init, setInit] = useState<InitResponse | null>(null);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [credErr, setCredErr] = useState<string | null>(null);
  const [activated, setActivated] = useState(false);
  const [opening, setOpening] = useState(false);
  const [showTrialOffer, setShowTrialOffer] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(PAYMENT_STORAGE_KEY);
        if (raw) {
          try {
            const saved = JSON.parse(raw) as InitResponse;
            if (saved.botUrl && saved.botUsername) {
              if (!cancelled) setInit(saved);
              return;
            }
          } catch {}
        }
        await createSession();
      } catch {
        if (!cancelled) await createSession();
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createSession = async (): Promise<InitResponse | null> => {
    try {
      const r = await fetch(`${API_BASE}/api/payment/init`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: profile.name, phone: profile.phone }),
      });
      if (!r.ok) return null;
      const data = (await r.json()) as InitResponse;
      setInit(data);
      await AsyncStorage.setItem(PAYMENT_STORAGE_KEY, JSON.stringify(data));
      return data;
    } catch {
      return null;
    }
  };

  const openBot = async () => {
    if (opening) return;
    setOpening(true);
    try {
      let current = init;
      if (!current?.botUrl || !current?.linkToken) {
        current = await createSession();
      }
      const token = current?.linkToken;
      if (!token) {
        Alert.alert(
          "Ulanish xatosi",
          "Serverga ulanib bo'lmadi. Internetni tekshirib, qaytadan urinib ko'ring.",
        );
        return;
      }
      const username = current?.botUsername || FALLBACK_BOT_USERNAME;
      const httpsUrl = current?.botUrl || `https://t.me/${username}?start=${token}`;
      const deepLink = `tg://resolve?domain=${username}&start=${token}`;

      try {
        await Linking.openURL(deepLink);
        return;
      } catch {}
      try {
        await Linking.openURL(httpsUrl);
        return;
      } catch {}
      try {
        await WebBrowser.openBrowserAsync(httpsUrl);
        return;
      } catch {
        Alert.alert("Telegram topilmadi", `Iltimos botni qo'lda oching: @${username}`);
      }
    } finally {
      setOpening(false);
    }
  };

  const redeemCredentials = async () => {
    if (!init) {
      setCredErr("Sessiya yuklanmoqda, bir oz kuting");
      return;
    }
    setCredErr(null);
    if (!login.trim() || !password.trim()) {
      setCredErr("Login va parolni kiriting");
      return;
    }
    setRedeeming(true);
    try {
      const r = await fetch(`${API_BASE}/api/payment/${init?.paymentId ?? "master"}/redeem`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ login: login.trim(), password: password.trim() }),
      });
      const data = await r.json();
      if (!r.ok || !data.success) {
        setCredErr(data?.error || "Login yoki parol noto'g'ri");
        return;
      }
      const until = data.premiumUntil ? new Date(data.premiumUntil).getTime() : undefined;
      activateSubscription(until);
      await completeOnboarding();
      try {
        await AsyncStorage.setItem("onboarding_complete", "true");
        await AsyncStorage.removeItem(PAYMENT_STORAGE_KEY);
      } catch {}
      setActivated(true);
      setTimeout(() => router.replace("/(tabs)"), 1200);
    } catch (err: any) {
      setCredErr(err?.message || "Tarmoq xatosi");
    } finally {
      setRedeeming(false);
    }
  };

  const handleSkip = () => {
    if (subscription.status === "none") {
      setShowTrialOffer(true);
      return;
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/onboarding/premium");
    }
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
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior="padding"
      keyboardVerticalOffset={0}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topRow}>
          <TouchableOpacity onPress={handleSkip} hitSlop={10} style={styles.closeBtn}>
            <Feather name="x" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Faollashtirish</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.sectionIconWrap, { backgroundColor: "#E3F2FD" }]}>
            <Feather name="send" size={22} color="#229ED9" />
          </View>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            1-qadam — Telegram botga o'ting
          </Text>
          <Text style={[styles.sectionDesc, { color: colors.mutedForeground }]}>
            <Text style={{ fontFamily: "Inter_600SemiBold", color: colors.text }}>Login va parol</Text>{" "}
            olish uchun Telegram botga o'ting. Botdagi ko'rsatmalarga amal qiling — login va parol
            sizga shu yerda beriladi.
          </Text>

          <Pressable
            onPress={openBot}
            disabled={opening}
            style={({ pressed }) => [
              styles.tgBtn,
              { backgroundColor: "#229ED9", opacity: pressed || opening ? 0.85 : 1 },
            ]}
          >
            {opening ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Feather name="send" size={18} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.tgBtnText}>
                  {init?.botUsername ? `@${init.botUsername} — botni ochish` : "Telegram botni ochish"}
                </Text>
              </>
            )}
          </Pressable>
        </View>

        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.sectionIconWrap, { backgroundColor: colors.secondary }]}>
            <Feather name="key" size={22} color={colors.primary} />
          </View>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            2-qadam — Login va parolni kiriting
          </Text>
          <Text style={[styles.sectionDesc, { color: colors.mutedForeground }]}>
            Telegram bot tomonidan yuborilgan bir martalik login va parolni kiriting.
          </Text>

          <Text style={[styles.label, { color: colors.text }]}>Login</Text>
          <TextInput
            value={login}
            onChangeText={(v) => { setLogin(v); setCredErr(null); }}
            placeholder="Botdan olgan loginingiz"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
          />

          <Text style={[styles.label, { color: colors.text }]}>Parol</Text>
          <TextInput
            value={password}
            onChangeText={(v) => { setPassword(v); setCredErr(null); }}
            placeholder="Botdan olgan parolingiz"
            placeholderTextColor={colors.mutedForeground}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
          />

          {credErr && (
            <View style={[styles.errBox, { backgroundColor: "#FEE2E2" }]}>
              <Feather name="alert-circle" size={14} color="#DC2626" />
              <Text style={styles.errText}>{credErr}</Text>
            </View>
          )}

          <Pressable
            onPress={redeemCredentials}
            disabled={redeeming}
            style={({ pressed }) => [
              styles.cta,
              { backgroundColor: colors.primary, opacity: pressed || redeeming ? 0.8 : 1, marginTop: 8 },
            ]}
          >
            {redeeming ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Feather name="unlock" size={18} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.ctaText}>Faollashtirish</Text>
              </>
            )}
          </Pressable>
        </View>

        <View style={[styles.helpNote, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <Feather name="info" size={14} color={colors.mutedForeground} style={{ marginTop: 2 }} />
          <Text style={[styles.helpText, { color: colors.mutedForeground }]}>
            Login va parol faqat bir marta ishlatiladi. Muammolar bo'lsa, Telegram botda yordam so'rang.
          </Text>
        </View>
      </ScrollView>

      <Modal
        visible={showTrialOffer}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTrialOffer(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <View style={[styles.modalIconWrap, { backgroundColor: colors.secondary }]}>
              <Feather name="gift" size={28} color={colors.primary} />
            </View>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              1 kun bepul sinab ko'ring
            </Text>
            <Text style={[styles.modalDesc, { color: colors.mutedForeground }]}>
              Ilovani 24 soat davomida to'liq bepul ishlating. Sinov muddati tugagach, davom etish
              uchun Telegram botdan login va parol olishingiz kerak bo'ladi.
            </Text>

            <Pressable
              onPress={acceptTrial}
              style={({ pressed }) => [
                styles.modalPrimary,
                { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
              ]}
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
  tgBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", height: 48, borderRadius: 24, marginTop: 4 },
  tgBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
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
