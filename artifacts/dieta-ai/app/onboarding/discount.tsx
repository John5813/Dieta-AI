import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";

export default function DiscountScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { subscription, startTrial, completeOnboarding } = useApp();
  const [seconds, setSeconds] = useState(15 * 60);
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const id = setInterval(() => {
      setSeconds((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.05, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const min = String(Math.floor(seconds / 60)).padStart(2, "0");
  const sec = String(seconds % 60).padStart(2, "0");

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          onPress={async () => {
            if (subscription.status === "none") startTrial();
            await completeOnboarding();
            router.replace("/(tabs)");
          }}
          style={styles.closeBtn}
          hitSlop={10}
        >
          <Feather name="x" size={24} color={colors.text} />
        </TouchableOpacity>

        <Text style={[styles.title, { color: colors.text }]}>Bir martalik taklifingiz</Text>

        <Animated.View style={[styles.heroWrap, { transform: [{ scale: pulse }] }]}>
          <Text style={styles.starLeft}>★</Text>
          <Text style={styles.starLeftSmall}>★</Text>
          <View style={[styles.heroCard, { backgroundColor: colors.text }]}>
            <Text style={styles.heroPercent}>32%</Text>
            <Text style={styles.heroSub}>FAQAT HOZIR</Text>
          </View>
          <Text style={styles.starRight}>★</Text>
          <Text style={styles.starRightSmall}>★</Text>
        </Animated.View>

        <View style={[styles.timer, { backgroundColor: "#FEE2E2" }]}>
          <Feather name="clock" size={16} color="#DC2626" />
          <Text style={[styles.timerText, { color: "#DC2626" }]}>
            Taklif tugashi: {min}:{sec}
          </Text>
        </View>

        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.infoRow}>
            <Feather name="check-circle" size={16} color={colors.primary} />
            <Text style={[styles.infoText, { color: colors.text }]}>Yillik obuna — cheksiz kirish</Text>
          </View>
          <View style={styles.infoRow}>
            <Feather name="check-circle" size={16} color={colors.primary} />
            <Text style={[styles.infoText, { color: colors.text }]}>AI ovqat tahlili va shaxsiy reja</Text>
          </View>
          <View style={styles.infoRow}>
            <Feather name="check-circle" size={16} color={colors.primary} />
            <Text style={[styles.infoText, { color: colors.text }]}>Batafsil statistika va kuzatuv</Text>
          </View>
        </View>

        <View style={[styles.botCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <Feather name="send" size={18} color="#229ED9" style={{ marginBottom: 6 }} />
          <Text style={[styles.botTitle, { color: colors.text }]}>
            Davom etish uchun botga o'ting
          </Text>
          <Text style={[styles.botDesc, { color: colors.mutedForeground }]}>
            Telegram bot orqali login va parolingizni oling
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          onPress={() => router.replace("/onboarding/payment")}
          style={({ pressed }) => [
            styles.cta,
            { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={styles.ctaText}>Faollashtirish</Text>
        </Pressable>
        <TouchableOpacity
          onPress={async () => {
            if (subscription.status === "none") startTrial();
            await completeOnboarding();
            router.replace("/(tabs)");
          }}
          style={styles.skip}
        >
          <Text style={[styles.skipText, { color: colors.mutedForeground }]}>Keyinroq</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 24, paddingBottom: 16, alignItems: "center" },
  closeBtn: { width: 40, height: 40, justifyContent: "center", alignSelf: "flex-start", marginBottom: 8 },
  title: { fontSize: 22, fontFamily: "Inter_700Bold", textAlign: "center", marginBottom: 24 },
  heroWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginBottom: 20,
  },
  heroCard: {
    paddingHorizontal: 36,
    paddingVertical: 28,
    borderRadius: 22,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  heroPercent: { fontSize: 56, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: -2 },
  heroSub: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff", letterSpacing: 1.5, marginTop: 4 },
  starLeft: { fontSize: 32, color: "#94A3B8" },
  starLeftSmall: { fontSize: 16, color: "#CBD5E1", marginTop: 24 },
  starRight: { fontSize: 32, color: "#94A3B8" },
  starRightSmall: { fontSize: 16, color: "#CBD5E1", marginTop: 24 },
  timer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 20,
  },
  timerText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  infoCard: {
    width: "100%",
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 10,
    marginBottom: 14,
  },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  infoText: { fontSize: 14, fontFamily: "Inter_500Medium", flex: 1 },
  botCard: {
    width: "100%",
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    alignItems: "center",
  },
  botTitle: { fontSize: 15, fontFamily: "Inter_700Bold", textAlign: "center", marginBottom: 6 },
  botDesc: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  footer: { paddingHorizontal: 24, paddingTop: 12 },
  cta: { height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  ctaText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
  skip: { alignItems: "center", marginTop: 10, padding: 8 },
  skipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
});
