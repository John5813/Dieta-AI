import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  BackHandler,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { calculatePlan } from "@/lib/nutrition";

const { width } = Dimensions.get("window");
const chartW = width - 80;
const chartH = 200;

type Direction = "up" | "down" | "flat";

function WeightCurve({ direction }: { direction: Direction }) {
  const colors = useColors();
  const padX = 30;
  const x0 = padX;
  const x1 = chartW - padX;
  const topY = 30;
  const bottomY = chartH - 60;
  const midY = (topY + bottomY) / 2;

  let startY: number;
  let endY: number;
  if (direction === "down") {
    startY = topY;
    endY = bottomY;
  } else if (direction === "up") {
    startY = bottomY;
    endY = topY;
  } else {
    startY = midY;
    endY = midY;
  }

  const c1x = x0 + (x1 - x0) * 0.45;
  const c2x = x0 + (x1 - x0) * 0.55;
  const path =
    direction === "flat"
      ? `M ${x0} ${startY} L ${x1} ${endY}`
      : `M ${x0} ${startY} C ${c1x} ${startY}, ${c2x} ${endY}, ${x1} ${endY}`;
  const baseY = chartH;
  const fillPath = `${path} L ${x1} ${baseY} L ${x0} ${baseY} Z`;

  return (
    <Svg width={chartW} height={chartH}>
      <Defs>
        <LinearGradient id="curve-fill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={colors.primary} stopOpacity="0.25" />
          <Stop offset="100%" stopColor={colors.primary} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      {[0.2, 0.4, 0.6, 0.8].map((p) => (
        <Path
          key={p}
          d={`M ${chartW * p} 0 L ${chartW * p} ${chartH}`}
          stroke={colors.border}
          strokeWidth={1}
          strokeDasharray="3,3"
        />
      ))}
      <Path d={fillPath} fill="url(#curve-fill)" />
      <Path d={path} stroke={colors.primary} strokeWidth={3} fill="none" strokeLinecap="round" />
      <Circle cx={x0} cy={startY} r={6} fill={colors.card} stroke={colors.primary} strokeWidth={2.5} />
      <Circle cx={x1} cy={endY} r={8} fill={colors.primary} strokeWidth={2.5} opacity={0.3} />
      <Circle cx={x1} cy={endY} r={5} fill={colors.card} stroke={colors.primary} strokeWidth={2.5} />
    </Svg>
  );
}

export default function PremiumScreen() {
  const { profile, subscription, startTrial, completeOnboarding } = useApp();
  const colors = useColors();
  const isExpired =
    subscription.status === "trial" &&
    subscription.trialStartedAt != null &&
    (Date.now() - subscription.trialStartedAt) / (1000 * 60 * 60 * 24) >= 1;
  const isLocked = isExpired;
  const insets = useSafeAreaInsets();
  const [showTrialOffer, setShowTrialOffer] = useState(false);

  const handleClose = async () => {
    if (subscription.status === "none") {
      setShowTrialOffer(true);
      return;
    }
    await completeOnboarding();
    router.replace("/(tabs)");
  };

  const acceptTrial = async () => {
    setShowTrialOffer(false);
    startTrial();
    await completeOnboarding();
    router.replace("/(tabs)");
  };

  const goToBot = () => {
    setShowTrialOffer(false);
    router.push("/onboarding/payment");
  };

  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        if (isLocked) return true;
        handleClose();
        return true;
      };
      const sub = BackHandler.addEventListener("hardwareBackPress", onBack);
      return () => sub.remove();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [subscription.status, isLocked]),
  );

  const plan = calculatePlan(profile);
  const current = profile.currentWeight ?? 75;
  const goalKind = profile.goal ?? "ozish";
  const fallbackTarget =
    goalKind === "ozish" ? current - 5 : goalKind === "oshirish" ? current + 5 : current;
  const target = profile.targetWeight ?? fallbackTarget;
  const direction: Direction =
    goalKind === "saqlash" || target === current
      ? "flat"
      : target > current
        ? "up"
        : "down";
  const totalDays = plan.weeksToGoal * 7;
  const dayLabel = totalDays > 0 ? `Kun ${totalDays}` : "Bugun";

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
        showsVerticalScrollIndicator={false}
      >
        {!isLocked && (
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn} hitSlop={10}>
            <Feather name="x" size={24} color={colors.text} />
          </TouchableOpacity>
        )}
        {isLocked && <View style={styles.closeBtn} />}

        <Text style={[styles.title, { color: colors.text }]}>Shaxsiy reja tayyor</Text>

        <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.chartLabels}>
            <View>
              <Text style={[styles.weightLabel, { color: colors.text }]}>{current} kg</Text>
              <Text style={[styles.dayLabel, { color: colors.mutedForeground }]}>Bugun</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={[styles.weightLabel, { color: colors.primary }]}>{target} kg</Text>
              <Text style={[styles.dayLabel, { color: colors.mutedForeground }]}>{dayLabel}</Text>
            </View>
          </View>
          <WeightCurve direction={direction} />
        </View>

        <Text style={[styles.tagline, { color: colors.text }]}>
          Maqsadingizga 4 barobar tezroq erishing{"\n"}shaxsiy AI-yordamchi bilan
        </Text>

        <View style={styles.brandRow}>
          <Text style={[styles.brandSub, { color: colors.mutedForeground }]}>Cheksiz kirish</Text>
          <View style={styles.brandBadge}>
            <View style={[styles.brandLogo, { backgroundColor: colors.primary }]}>
              <Text style={[styles.brandLogoText, { color: colors.primaryForeground }]}>BB</Text>
            </View>
            <Text style={[styles.brandName, { color: colors.text }]}>BIR BURDA</Text>
          </View>
        </View>

        <View style={styles.benefits}>
          {[
            { icon: "camera", label: "Cheksiz AI kamera tahlili" },
            { icon: "trending-down", label: "Shaxsiy ozish rejasi" },
            { icon: "bar-chart-2", label: "Batafsil statistika" },
            { icon: "heart", label: "Ekspert tomonidan tasdiqlangan" },
          ].map((b) => (
            <View key={b.label} style={styles.benefitRow}>
              <View style={[styles.benefitDot, { backgroundColor: colors.secondary }]}>
                <Feather
                  name={b.icon as keyof typeof Feather.glyphMap}
                  size={14}
                  color={colors.primary}
                />
              </View>
              <Text style={[styles.benefitText, { color: colors.text }]}>{b.label}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          onPress={() => router.push("/onboarding/payment")}
          style={({ pressed }) => [
            styles.cta,
            { backgroundColor: colors.text, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={styles.ctaText}>Faollashtirish</Text>
        </Pressable>
        {!isLocked && (
          <TouchableOpacity onPress={handleClose} style={styles.skip}>
            <Text style={[styles.skipText, { color: colors.mutedForeground }]}>Keyinroq</Text>
          </TouchableOpacity>
        )}
      </View>

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
            <TouchableOpacity onPress={goToBot} style={styles.modalSecondary}>
              <Text style={[styles.modalSecondaryText, { color: colors.text }]}>Botga o'tish</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 24, paddingBottom: 16 },
  closeBtn: { width: 40, height: 40, justifyContent: "center", marginBottom: 8 },
  title: { fontSize: 22, fontFamily: "Inter_700Bold", textAlign: "center", marginBottom: 16 },
  chartCard: { borderRadius: 18, borderWidth: 1, padding: 16, marginBottom: 14 },
  chartLabels: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  weightLabel: { fontSize: 16, fontFamily: "Inter_700Bold" },
  dayLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  tagline: { fontSize: 14, fontFamily: "Inter_500Medium", textAlign: "center", marginBottom: 24, lineHeight: 22 },
  brandRow: { alignItems: "center", marginBottom: 20, gap: 8 },
  brandSub: { fontSize: 13, fontFamily: "Inter_400Regular" },
  brandBadge: { flexDirection: "row", alignItems: "center", gap: 8 },
  brandLogo: { width: 28, height: 28, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  brandLogoText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  brandName: { fontSize: 22, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  benefits: { gap: 10 },
  benefitRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  benefitDot: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  benefitText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  footer: { paddingHorizontal: 24, paddingTop: 12 },
  cta: { height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  ctaText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#fff" },
  skip: { alignItems: "center", marginTop: 10, padding: 8 },
  skipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
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
