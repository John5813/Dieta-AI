import { router } from "expo-router";
import React from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { OnboardingLayout } from "@/components/OnboardingLayout";
import { useColors } from "@/hooks/useColors";

const { width } = Dimensions.get("window");
const chartW = Math.min(width - 80, 360);
const chartH = 200;
const padX = 20;
const padY = 24;
const innerW = chartW - padX * 2;
const innerH = chartH - padY * 2;

function smoothPath(points: { x: number; y: number }[]) {
  if (points.length < 2) return "";
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const cx = (p0.x + p1.x) / 2;
    d += ` Q ${cx} ${p0.y}, ${cx} ${(p0.y + p1.y) / 2} T ${p1.x} ${p1.y}`;
  }
  return d;
}

function ComparisonChart() {
  const colors = useColors();

  const startX = padX;
  const startY = padY + 20;

  const ourRaw = [
    { x: 0.0, y: 0.05 },
    { x: 0.2, y: 0.18 },
    { x: 0.4, y: 0.38 },
    { x: 0.6, y: 0.6 },
    { x: 0.8, y: 0.78 },
    { x: 1.0, y: 0.92 },
  ];

  const otherRaw = [
    { x: 0.0, y: 0.05 },
    { x: 0.15, y: 0.25 },
    { x: 0.3, y: 0.4 },
    { x: 0.45, y: 0.3 },
    { x: 0.6, y: 0.18 },
    { x: 0.8, y: 0.1 },
    { x: 1.0, y: 0.06 },
  ];

  const our = ourRaw.map((p) => ({ x: padX + p.x * innerW, y: padY + p.y * innerH }));
  const other = otherRaw.map((p) => ({ x: padX + p.x * innerW, y: padY + p.y * innerH }));

  return (
    <View style={[styles.chartWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Svg width={chartW} height={chartH}>
        <Defs>
          <LinearGradient id="ourFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={colors.primary} stopOpacity="0.25" />
            <Stop offset="100%" stopColor={colors.primary} stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {[0.25, 0.5, 0.75].map((p) => (
          <Path
            key={p}
            d={`M ${padX} ${padY + innerH * p} L ${chartW - padX} ${padY + innerH * p}`}
            stroke={colors.border}
            strokeWidth={1}
            strokeDasharray="3,4"
          />
        ))}

        <Path
          d={`${smoothPath(our)} L ${our[our.length - 1].x} ${chartH - padY} L ${our[0].x} ${chartH - padY} Z`}
          fill="url(#ourFill)"
        />

        <Path
          d={smoothPath(other)}
          stroke={colors.chartRed}
          strokeWidth={3}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <Path
          d={smoothPath(our)}
          stroke={colors.primary}
          strokeWidth={3.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <Circle cx={startX} cy={startY} r={6} fill={colors.card} stroke={colors.text} strokeWidth={2.5} />
        <Circle cx={our[our.length - 1].x} cy={our[our.length - 1].y} r={6} fill={colors.primary} stroke="#fff" strokeWidth={2} />
        <Circle cx={other[other.length - 1].x} cy={other[other.length - 1].y} r={6} fill={colors.chartRed} stroke="#fff" strokeWidth={2} />
      </Svg>

      <View style={[styles.startLabel, { backgroundColor: colors.text }]}>
        <Text style={styles.startLabelText}>Boshlanish</Text>
      </View>

      <View style={[styles.endLabelOur, { backgroundColor: colors.primary }]}>
        <Text style={styles.endLabelText}>Bir Burda</Text>
      </View>

      <View style={[styles.endLabelOther, { backgroundColor: colors.chartRed }]}>
        <Text style={styles.endLabelText}>Boshqa ilovalar</Text>
      </View>

      <View style={styles.xAxis}>
        <Text style={[styles.axisLabel, { color: colors.mutedForeground }]}>1-Oy</Text>
        <Text style={[styles.axisLabel, { color: colors.mutedForeground }]}>3-Oy</Text>
        <Text style={[styles.axisLabel, { color: colors.mutedForeground }]}>6-Oy</Text>
      </View>

      <View style={styles.yAxis}>
        <Text style={[styles.axisLabel, { color: colors.mutedForeground, transform: [{ rotate: "-90deg" }] }]}>
          Natija
        </Text>
      </View>
    </View>
  );
}

export default function ComparisonScreen() {
  const colors = useColors();
  return (
    <OnboardingLayout
      step={4}
      total={18}
      title="Bir Burda va boshqa ilovalarni farqi"
      onNext={() => router.push("/onboarding/birthdate")}
      onBack={() => router.back()}
    >
      <ComparisonChart />
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
          <Text style={[styles.legendText, { color: colors.text }]}>
            Bir Burda — barqaror o'sish
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.chartRed }]} />
          <Text style={[styles.legendText, { color: colors.text }]}>
            Boshqa ilovalar — qaytib tushadi
          </Text>
        </View>
      </View>
      <Text style={[styles.description, { color: colors.mutedForeground }]}>
        Boshqa ilovalarda foydalanuvchilar boshida tez ozadi, lekin 2-3 oy o'tgach eski vazniga
        qaytib qoladi. Bir Burda esa ozganingizdan keyin natijani ushlab turishga yordam beradi.
      </Text>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  chartWrap: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginTop: 8,
    marginBottom: 16,
    alignItems: "center",
    position: "relative",
  },
  startLabel: {
    position: "absolute",
    top: 24,
    left: 22,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  startLabelText: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: "#fff" },
  endLabelOur: {
    position: "absolute",
    bottom: 60,
    right: 18,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  endLabelOther: {
    position: "absolute",
    top: 36,
    right: 18,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  endLabelText: { fontSize: 11, fontFamily: "Inter_700Bold", color: "#fff" },
  xAxis: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: chartW - 40,
    marginTop: 4,
  },
  yAxis: { position: "absolute", left: -4, top: chartH / 2 - 24 },
  axisLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },
  legendRow: { gap: 8, marginBottom: 16 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  description: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
});
