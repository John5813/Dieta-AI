import { router } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MacroDonut } from "@/components/MacroDonut";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { calculatePlan, formatUzDate } from "@/lib/nutrition";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function CalorieHero({ value }: { value: number }) {
  const colors = useColors();
  const size = 180;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const anim = useRef(new Animated.Value(0)).current;
  const num = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = React.useState(0);

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 1100,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    Animated.timing(num, {
      toValue: value,
      duration: 1100,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    const id = num.addListener(({ value: v }) => setDisplay(Math.round(v)));
    return () => num.removeListener(id);
  }, [anim, num, value]);

  const offset = anim.interpolate({ inputRange: [0, 1], outputRange: [c, 0] });

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="cgrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={colors.accent} />
            <Stop offset="100%" stopColor={colors.primary} />
          </LinearGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.border}
          strokeWidth={stroke}
          fill="transparent"
          opacity={0.5}
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#cgrad)"
          strokeWidth={stroke}
          fill="transparent"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={offset as unknown as number}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text style={[heroStyles.value, { color: colors.text }]}>
        {display.toLocaleString("ru-RU").replace(/,/g, " ")}
      </Text>
      <Text style={[heroStyles.label, { color: colors.mutedForeground }]}>kkal / kun</Text>
    </View>
  );
}

const heroStyles = StyleSheet.create({
  value: { fontSize: 38, fontFamily: "Inter_700Bold", letterSpacing: -1 },
  label: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: -4 },
});

interface StatInfoData {
  label: string;
  emoji: string;
  title: string;
  description: string;
  formula?: string;
  tips: string[];
}

const STAT_INFO: Record<string, StatInfoData> = {
  BMR: {
    label: "BMR",
    emoji: "🫀",
    title: "Bazal Metabolizm Darajasi (BMR)",
    description:
      "BMR — siz mutlaqo dam olayotgan paytda (uxlayotgan, harakatsiz) organizmingiz sarflaydigan minimal kaloriya miqdori. Bu nafas olish, qon aylanishi, organ ishlashi kabi hayotiy jarayonlar uchun kerak bo'ladi.",
    formula: "Mifflin-St Jeor: erkak = 10×vazn + 6.25×bo'y − 5×yosh + 5 | ayol = 10×vazn + 6.25×bo'y − 5×yosh − 161",
    tips: [
      "Mushak massasi qancha ko'p bo'lsa, BMR shuncha yuqori bo'ladi",
      "Yosh oshgan sari BMR sekin pasayadi",
      "Past kaloriya diyetasi BMR ni pasaytirishi mumkin",
    ],
  },
  TDEE: {
    label: "TDEE",
    emoji: "⚡",
    title: "Kunlik Umumiy Energiya Sarfi (TDEE)",
    description:
      "TDEE — siz bir kun davomida barcha faoliyatingiz (ish, mashq, yurish va boshqalar) bilan birga sarflaydigan umumiy kaloriya. Bu sizning 'kaloriya balansi' nuqtangiz — TDEE dan kam yesangiz ozasiz, ko'p yesangiz semiyrasiz.",
    formula: "TDEE = BMR × Faollik koeffitsienti (1.2 — 1.9)",
    tips: [
      "Kam harakatli: 1.2× | Yengil: 1.375× | O'rtacha: 1.55× | Faol: 1.725×",
      "Ozish uchun TDEE dan 300–500 kkal kam iste'mol qiling",
      "Oshirish uchun TDEE dan 200–400 kkal ko'p iste'mol qiling",
    ],
  },
  BMI: {
    label: "BMI",
    emoji: "📊",
    title: "Tana Massasi Indeksi (BMI)",
    description:
      "BMI — vaznni bo'y kvadratiga bo'lib hisoblanadigan umumiy ko'rsatkich. U siz uchun vazn me'yori qanday ekanligini taxminan baholaydi. Ammo BMI mushak va yog' nisbatini farqlamaydi — shuning uchun u faqat taxminiy ko'rsatkich hisoblanadi.",
    formula: "BMI = vazn (kg) ÷ bo'y² (m²)",
    tips: [
      "18.5 dan past — kam vazn",
      "18.5–24.9 — me'yor",
      "25–29.9 — ortiqcha vazn",
      "30 dan yuqori — semizlik",
    ],
  },
  Suv: {
    label: "Suv",
    emoji: "💧",
    title: "Kunlik Suv Me'yori",
    description:
      "Organizmingiz uchun zarur bo'lgan kunlik suyuqlik miqdori. Suv ovqat hazm qilish, qon aylanishi, harorat tartibga solish va chiqindi chiqarishda asosiy rol o'ynaydi. Yetarlicha suv ichish metabolizmni tezlashtiradi va to'yib yeyish tuyg'usini oshiradi.",
    formula: "Kunlik suv = vazn (kg) × 35 ml",
    tips: [
      "Mashq paytida +500 ml qo'shing",
      "Issiq havoda +300–500 ml ko'proq iching",
      "Och qorin suv ichish metabolizmni 30% tezlashtiradi",
      "Kuniga kamida 8 ta stakan (≈ 2 litr) tavsiya etiladi",
    ],
  },
};

export default function PlanScreen() {
  const { profile } = useApp();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [activeInfo, setActiveInfo] = useState<StatInfoData | null>(null);

  const plan = useMemo(() => calculatePlan(profile), [profile]);

  const isMaintain = profile.goal === "saqlash";
  const isGain = profile.goal === "oshirish";
  const diff = Math.abs(
    (profile.currentWeight ?? 0) - (profile.targetWeight ?? profile.currentWeight ?? 0),
  );
  const targetTitle = isMaintain
    ? "Vazningiz ideal — saqlab qoling"
    : isGain
      ? `Siz qo'shishingiz kerak`
      : `Siz yo'qotishingiz kerak`;
  const targetValue = isMaintain ? "Ideal" : `${diff} kg`;

  const goalKcalLine = isMaintain
    ? "Vaznni saqlash uchun kunlik norma"
    : isGain
      ? `+${Math.round(plan.calories - plan.tdee)} kkal kunlik profitsit`
      : `−${Math.round(plan.tdee - plan.calories)} kkal kunlik defitsit`;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 16, paddingBottom: 140 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.checkCircle, { backgroundColor: colors.primary }]}>
          <Feather name="check" size={26} color={colors.primaryForeground} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>
          Tabriklaymiz!{"\n"}Shaxsiy rejangiz tayyor
        </Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{targetTitle}</Text>
        <View style={[styles.targetBadge, { backgroundColor: colors.secondary }]}>
          <Text style={[styles.targetText, { color: colors.primary }]}>{targetValue}</Text>
        </View>

        {/* Hero calorie ring */}
        <View
          style={[
            styles.heroCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.heroHeader}>
            <View>
              <Text style={[styles.heroTitle, { color: colors.text }]}>Kunlik kaloriya</Text>
              <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>
                {goalKcalLine}
              </Text>
            </View>
            <View style={[styles.formulaPill, { backgroundColor: colors.secondary }]}>
              <Text style={[styles.formulaText, { color: colors.primary }]}>
                Mifflin-St Jeor
              </Text>
            </View>
          </View>
          <View style={{ alignItems: "center", marginVertical: 12 }}>
            <CalorieHero value={plan.calories} />
          </View>

          {/* Macros */}
          <View style={styles.macroRow}>
            <MacroDonut
              value={plan.protein}
              label="Oqsil"
              color={colors.chartRed}
              pct={plan.proteinPct}
              delay={150}
            />
            <MacroDonut
              value={plan.carbs}
              label="Uglevod"
              color={colors.accent}
              pct={plan.carbsPct}
              delay={300}
            />
            <MacroDonut
              value={plan.fat}
              label="Yog'"
              color="#3B82F6"
              pct={plan.fatPct}
              delay={450}
            />
          </View>
        </View>

        {/* Safety floor warning */}
        {plan.isCaloriesClamped && (
          <View style={[styles.warnCard, { backgroundColor: "#FEF3C7", borderColor: "#D97706" }]}>
            <View style={styles.warnRow}>
              <Text style={styles.warnIcon}>⚠️</Text>
              <Text style={[styles.warnTitle, { color: "#92400E" }]}>
                Haftalik sur'at juda tez!
              </Text>
            </View>
            <Text style={[styles.warnDesc, { color: "#78350F" }]}>
              Tanlagan sur'atingiz bilan kunlik kaloriya{" "}
              <Text style={{ fontFamily: "Inter_700Bold" }}>
                {profile.currentWeight ?? 75} × 20 = {plan.minCalories} kkal
              </Text>{" "}
              xavfsiz chegarasidan pastga tushib ketadi. Shuning uchun reja avtomatik ravishda{" "}
              <Text style={{ fontFamily: "Inter_700Bold" }}>{plan.calories} kkal</Text> ga tuzatildi.
            </Text>
            <View style={[styles.warnBox, { backgroundColor: "#FDE68A", borderColor: "#F59E0B" }]}>
              <Text style={[styles.warnFormula, { color: "#78350F" }]}>
                Xavfsiz minimum = vazn ({profile.currentWeight ?? 75} kg) × 20 = {plan.minCalories} kkal/kun
              </Text>
            </View>
            <Text style={[styles.warnHint, { color: "#92400E" }]}>
              Tavsiya: haftalik ozish sur'atini kamaytiring — shunda kaloriya normangiz tabiiy saqlanadi va natija uzoqroq muddatda barqaror bo'ladi.
            </Text>
          </View>
        )}

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          <StatCard
            icon="activity"
            iconBg={colors.secondary}
            iconColor={colors.primary}
            label="BMR"
            value={`${plan.bmr}`}
            unit="kkal"
            sub="Asosiy almashuv"
            onPress={() => setActiveInfo(STAT_INFO.BMR)}
          />
          <StatCard
            icon="zap"
            iconBg="#FEF3C7"
            iconColor="#D97706"
            label="TDEE"
            value={`${plan.tdee}`}
            unit="kkal"
            sub="Kunlik sarflash"
            onPress={() => setActiveInfo(STAT_INFO.TDEE)}
          />
          <StatCard
            icon="bar-chart-2"
            iconBg="#DBEAFE"
            iconColor="#2563EB"
            label="BMI"
            value={`${plan.bmi}`}
            unit=""
            sub={plan.bmiCategory}
            onPress={() => setActiveInfo(STAT_INFO.BMI)}
          />
          <StatCard
            icon="droplet"
            iconBg="#E0F2FE"
            iconColor="#0EA5E9"
            label="Suv"
            value={`${(plan.waterMl / 1000).toFixed(1)}`}
            unit="L"
            sub="Kuniga"
            onPress={() => setActiveInfo(STAT_INFO.Suv)}
          />
        </View>

        {/* Goal timeline */}
        {!isMaintain && plan.weeksToGoal > 0 ? (
          <View
            style={[
              styles.timelineCard,
              { backgroundColor: colors.primary },
            ]}
          >
            <View style={styles.timelineLeft}>
              <Text style={[styles.timelineLabel, { color: colors.primaryForeground, opacity: 0.85 }]}>
                Maqsadga erishish vaqti
              </Text>
              <Text style={[styles.timelineValue, { color: colors.primaryForeground }]}>
                {plan.weeksToGoal} hafta
              </Text>
              <Text style={[styles.timelineDate, { color: colors.primaryForeground, opacity: 0.85 }]}>
                {formatUzDate(plan.goalDate)}
              </Text>
            </View>
            <View style={styles.timelineRight}>
              <Feather name="calendar" size={28} color={colors.primaryForeground} />
              <Text style={[styles.timelineSpeed, { color: colors.primaryForeground }]}>
                {Math.abs(plan.weeklyDeltaKg).toFixed(1)} kg/hafta
              </Text>
            </View>
          </View>
        ) : null}

        {/* Profile summary */}
        <View
          style={[
            styles.summaryCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.summaryTitle, { color: colors.text }]}>
            Hisob-kitob asoslari
          </Text>
          <SummaryRow label="Yosh" value={`${plan.ageYears} yosh`} />
          <SummaryRow label="Jinsi" value={profile.gender === "ayol" ? "Ayol" : "Erkak"} />
          <SummaryRow label="Bo'y" value={`${profile.height ?? "—"} sm`} />
          <SummaryRow label="Hozirgi vazn" value={`${profile.currentWeight ?? "—"} kg`} />
          {!isMaintain && (
            <SummaryRow
              label="Maqsad vazn"
              value={`${profile.targetWeight ?? "—"} kg`}
            />
          )}
          <SummaryRow
            label="Haftalik sur'at"
            value={
              isMaintain
                ? "Saqlash"
                : `${(profile.speedKgPerWeek ?? 0).toFixed(1)} kg/hafta`
            }
          />
          <SummaryRow
            label="Faollik darajasi"
            value="Yengil (1.375)"
            last
          />
        </View>

        <Text style={[styles.disclaimer, { color: colors.mutedForeground }]}>
          Reja Mifflin-St Jeor formulasi va sizning ma'lumotlaringiz asosida{"\n"}
          shaxsiy hisoblangan. Kerak bo'lsa, ilovada o'zgartirishingiz mumkin.
        </Text>
      </ScrollView>

      <View
        style={[
          styles.footer,
          { paddingBottom: insets.bottom + 16, backgroundColor: colors.background },
        ]}
      >
        <Pressable
          onPress={() => router.push("/onboarding/premium")}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>Keyingi</Text>
        </Pressable>
      </View>

      {/* Info Modal */}
      <Modal
        visible={activeInfo !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setActiveInfo(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setActiveInfo(null)}>
          <Pressable
            style={[styles.modalSheet, { backgroundColor: colors.card }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            <Text style={styles.modalEmoji}>{activeInfo?.emoji}</Text>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{activeInfo?.title}</Text>
            <Text style={[styles.modalDesc, { color: colors.mutedForeground }]}>
              {activeInfo?.description}
            </Text>
            {activeInfo?.formula && (
              <View style={[styles.formulaBox, { backgroundColor: colors.secondary }]}>
                <Text style={[styles.formulaLabel, { color: colors.mutedForeground }]}>Formula</Text>
                <Text style={[styles.formulaVal, { color: colors.text }]}>{activeInfo.formula}</Text>
              </View>
            )}
            <View style={styles.tipsWrap}>
              <Text style={[styles.tipsTitle, { color: colors.text }]}>Foydali ma'lumotlar</Text>
              {activeInfo?.tips.map((tip, i) => (
                <View key={i} style={styles.tipRow}>
                  <View style={[styles.tipDot, { backgroundColor: colors.primary }]} />
                  <Text style={[styles.tipText, { color: colors.mutedForeground }]}>{tip}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity
              onPress={() => setActiveInfo(null)}
              style={[styles.modalClose, { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.modalCloseText, { color: colors.primaryForeground }]}>
                Yopish
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function StatCard({
  icon, iconBg, iconColor, label, value, unit, sub, onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  unit: string;
  sub: string;
  onPress?: () => void;
}) {
  const colors = useColors();
  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      style={[
        styles.statCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.statCardHeader}>
        <View style={[styles.statIcon, { backgroundColor: iconBg }]}>
          <Feather name={icon} size={16} color={iconColor} />
        </View>
        {onPress && (
          <View style={[styles.infoChip, { backgroundColor: colors.secondary }]}>
            <Feather name="info" size={11} color={colors.mutedForeground} />
          </View>
        )}
      </View>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <View style={styles.statValueRow}>
        <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
        {unit ? (
          <Text style={[styles.statUnit, { color: colors.mutedForeground }]}>{unit}</Text>
        ) : null}
      </View>
      <Text style={[styles.statSub, { color: colors.mutedForeground }]}>{sub}</Text>
    </TouchableOpacity>
  );
}

function SummaryRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.summaryRow,
        !last && { borderBottomWidth: 1, borderBottomColor: colors.border },
      ]}
    >
      <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.summaryValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, alignItems: "center" },
  checkCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    lineHeight: 32,
    marginBottom: 6,
  },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 10 },
  targetBadge: {
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 20,
    marginBottom: 18,
  },
  targetText: { fontSize: 16, fontFamily: "Inter_700Bold" },

  heroCard: {
    width: "100%",
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  heroHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  heroTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  heroSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  formulaPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  formulaText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  macroRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-start",
    marginTop: 4,
  },

  statsGrid: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 14,
  },
  statCard: {
    width: "48%",
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  statLabel: { fontSize: 11, fontFamily: "Inter_500Medium", letterSpacing: 0.4 },
  statValueRow: { flexDirection: "row", alignItems: "baseline", gap: 4, marginTop: 2 },
  statValue: { fontSize: 22, fontFamily: "Inter_700Bold" },
  statUnit: { fontSize: 11, fontFamily: "Inter_500Medium" },
  statSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },

  timelineCard: {
    width: "100%",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  timelineLeft: { flex: 1 },
  timelineLabel: { fontSize: 11, fontFamily: "Inter_500Medium", letterSpacing: 0.4 },
  timelineValue: { fontSize: 24, fontFamily: "Inter_700Bold", marginTop: 2 },
  timelineDate: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  timelineRight: { alignItems: "center", gap: 6 },
  timelineSpeed: { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  summaryCard: {
    width: "100%",
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  summaryTitle: { fontSize: 14, fontFamily: "Inter_700Bold", marginBottom: 8 },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  summaryLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  summaryValue: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  disclaimer: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginTop: 4,
    lineHeight: 16,
  },
  statCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 2,
  },
  infoChip: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 36,
    gap: 12,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 8,
  },
  modalEmoji: { fontSize: 40, textAlign: "center" },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", textAlign: "center" },
  modalDesc: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 21 },
  formulaBox: { borderRadius: 12, padding: 12, gap: 4 },
  formulaLabel: { fontSize: 11, fontFamily: "Inter_500Medium", letterSpacing: 0.4 },
  formulaVal: { fontSize: 13, fontFamily: "Inter_600SemiBold", lineHeight: 18 },
  tipsWrap: { gap: 8 },
  tipsTitle: { fontSize: 14, fontFamily: "Inter_700Bold", marginBottom: 2 },
  tipRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  tipDot: { width: 6, height: 6, borderRadius: 3, marginTop: 6 },
  tipText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  modalClose: {
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  modalCloseText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  warnCard: {
    width: "100%",
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
    marginBottom: 14,
    gap: 10,
  },
  warnRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  warnIcon: { fontSize: 22 },
  warnTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  warnDesc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  warnBox: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    alignItems: "center",
  },
  warnFormula: { fontSize: 13, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  warnHint: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },

  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  button: { height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  buttonText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
