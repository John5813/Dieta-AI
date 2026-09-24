import { Feather } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { Alert, type LayoutChangeEvent, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";
import type { Goal, WeightEntry } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { formatDateKeyUz } from "@/lib/date";

const CHART_H = 150;
const PAD = { top: 14, right: 14, bottom: 22, left: 34 };
const MAX_POINTS = 60;
const GOOD = "#16A34A";
const AXIS_FONT = "Inter_500Medium";

function dayIndex(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

function fmtKg(n: number): string {
  return (Math.round(n * 10) / 10).toString();
}

interface Props {
  weightLog: WeightEntry[];
  targetWeight?: number;
  goal?: Goal;
  onAddWeight: () => void;
  onRemoveEntry?: (date: string) => void;
}

export function WeightProgressCard({ weightLog, targetWeight, goal, onAddWeight, onRemoveEntry }: Props) {
  const colors = useColors();
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  const points = useMemo(() => weightLog.slice(-MAX_POINTS), [weightLog]);
  const first = weightLog[0];
  const last = weightLog[weightLog.length - 1];

  const change = first && last ? last.kg - first.kg : 0;
  const changeIsGood =
    goal === "ozish" ? change <= 0 : goal === "oshirish" ? change >= 0 : Math.abs(change) <= 1;

  const hasTarget = !!targetWeight && goal !== "saqlash" && !!first;
  let progress = 0;
  let reached = false;
  if (hasTarget && first && last) {
    const total = targetWeight! - first.kg;
    const done = last.kg - first.kg;
    progress = total !== 0 ? Math.max(0, Math.min(1, done / total)) : 1;
    reached = goal === "ozish" ? last.kg <= targetWeight! : last.kg >= targetWeight!;
  }
  const remaining = hasTarget && last ? Math.abs(targetWeight! - last.kg) : 0;

  // ── Chart geometry ────────────────────────────────────────────────────
  const chart = useMemo(() => {
    if (width <= 0 || points.length < 2) return null;
    const kgs = points.map((p) => p.kg);
    if (hasTarget) kgs.push(targetWeight!);
    const minKg = Math.min(...kgs) - 0.5;
    const maxKg = Math.max(...kgs) + 0.5;
    const step = [1, 2, 5, 10, 20].find((s) => s * 3 >= maxKg - minKg) ?? 20;
    const lo = Math.floor(minKg / step) * step;
    const hi = Math.ceil(maxKg / step) * step;
    const tickValues: number[] = [];
    for (let v = hi; v >= lo; v -= step) tickValues.push(v);
    const x0 = dayIndex(points[0].date);
    const x1 = dayIndex(points[points.length - 1].date);
    const span = Math.max(1, x1 - x0);
    const plotW = width - PAD.left - PAD.right;
    const plotH = CHART_H - PAD.top - PAD.bottom;
    const sx = (key: string) => PAD.left + ((dayIndex(key) - x0) / span) * plotW;
    const sy = (kg: number) => PAD.top + (1 - (kg - lo) / (hi - lo)) * plotH;
    const xy = points.map((p) => ({ x: sx(p.date), y: sy(p.kg) }));
    const line = xy.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    const baseY = PAD.top + plotH;
    const area = `${line} L${xy[xy.length - 1].x.toFixed(1)},${baseY} L${xy[0].x.toFixed(1)},${baseY} Z`;
    return {
      xy,
      line,
      area,
      ticks: tickValues.map((v) => ({ v, y: sy(v) })),
      targetY: hasTarget ? sy(targetWeight!) : null,
      plotRight: PAD.left + plotW,
      baseY,
    };
  }, [width, points, hasTarget, targetWeight]);

  const activeIdx = selected !== null && selected < points.length ? selected : points.length - 1;
  const active = points[activeIdx];

  const pickAt = (x: number) => {
    if (!chart) return;
    let best = 0;
    let bestD = Infinity;
    chart.xy.forEach((p, i) => {
      const d = Math.abs(p.x - x);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    setSelected(best);
  };

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const recent = weightLog.slice(-5).reverse();

  const confirmRemove = (w: WeightEntry) => {
    if (!onRemoveEntry) return;
    Alert.alert("O'lchovni o'chirish", `${formatDateKeyUz(w.date)} · ${fmtKg(w.kg)} kg o'chirilsinmi?`, [
      { text: "Bekor qilish", style: "cancel" },
      {
        text: "O'chirish",
        style: "destructive",
        onPress: () => {
          setSelected(null);
          onRemoveEntry(w.date);
        },
      },
    ]);
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text }]}>Vazn dinamikasi</Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>
            {weightLog.length > 0 ? `${weightLog.length} ta o'lchov` : "Hali o'lchov yo'q"}
          </Text>
        </View>
        <Pressable
          onPress={onAddWeight}
          accessibilityRole="button"
          style={({ pressed }) => [styles.addBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
        >
          <Feather name="plus" size={16} color="#FFFFFF" />
          <Text style={styles.addText}>Vazn kiritish</Text>
        </Pressable>
      </View>

      {last ? (
        <View style={styles.tiles}>
          <View style={styles.tile}>
            <Text style={[styles.tileLabel, { color: colors.mutedForeground }]}>Hozirgi</Text>
            <Text style={[styles.tileValue, { color: colors.text }]}>{fmtKg(last.kg)} kg</Text>
          </View>
          <View style={styles.tile}>
            <Text style={[styles.tileLabel, { color: colors.mutedForeground }]}>Boshidan</Text>
            <View style={styles.deltaRow}>
              {change !== 0 ? (
                <Feather
                  name={change < 0 ? "arrow-down" : "arrow-up"}
                  size={14}
                  color={changeIsGood ? GOOD : colors.destructive}
                />
              ) : null}
              <Text style={[styles.tileValue, { color: change === 0 ? colors.text : changeIsGood ? GOOD : colors.destructive }]}>
                {change > 0 ? "+" : change < 0 ? "−" : ""}
                {fmtKg(Math.abs(change))} kg
              </Text>
            </View>
          </View>
          <View style={styles.tile}>
            <Text style={[styles.tileLabel, { color: colors.mutedForeground }]}>Maqsadgacha</Text>
            <Text style={[styles.tileValue, { color: colors.text }]}>
              {!hasTarget ? "—" : reached ? "Yetildi" : `${fmtKg(remaining)} kg`}
            </Text>
          </View>
        </View>
      ) : null}

      {hasTarget && last ? (
        <View style={styles.progressWrap}>
          <View style={[styles.track, { backgroundColor: colors.secondary }]}>
            <View
              style={[styles.fill, { width: `${Math.round(progress * 100)}%`, backgroundColor: colors.primary }]}
            />
          </View>
          <Text style={[styles.progressText, { color: colors.mutedForeground }]}>
            {reached
              ? `Maqsadga yetdingiz — ${fmtKg(targetWeight!)} kg`
              : `Maqsad ${fmtKg(targetWeight!)} kg · ${Math.round(progress * 100)}% bajarildi`}
          </Text>
        </View>
      ) : null}

      {points.length >= 2 ? (
        <View>
          {active ? (
            <Text style={[styles.readout, { color: colors.text }]}>
              {formatDateKeyUz(active.date)} ·{" "}
              <Text style={{ fontFamily: "Inter_700Bold" }}>{fmtKg(active.kg)} kg</Text>
            </Text>
          ) : null}
          <View
            onLayout={onLayout}
            style={{ height: CHART_H }}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={(e) => pickAt(e.nativeEvent.locationX)}
            onResponderMove={(e) => pickAt(e.nativeEvent.locationX)}
            onResponderTerminationRequest={() => true}
            accessible
            accessibilityLabel={`Vazn grafigi: ${fmtKg(points[0].kg)} kg dan ${fmtKg(points[points.length - 1].kg)} kg gacha`}
          >
            {chart ? (
              <Svg width={width} height={CHART_H}>
                {chart.ticks.map((t) => (
                  <React.Fragment key={t.v}>
                    <Line x1={PAD.left} x2={chart.plotRight} y1={t.y} y2={t.y} stroke={colors.border} strokeWidth={1} />
                    <SvgText x={PAD.left - 6} y={t.y + 4} fontSize={10} fontFamily={AXIS_FONT} fill={colors.mutedForeground} textAnchor="end">
                      {t.v}
                    </SvgText>
                  </React.Fragment>
                ))}
                {chart.targetY !== null ? (
                  <>
                    <Line
                      x1={PAD.left}
                      x2={chart.plotRight}
                      y1={chart.targetY}
                      y2={chart.targetY}
                      stroke={colors.accent}
                      strokeWidth={1.5}
                    />
                    <SvgText
                      x={chart.plotRight}
                      y={chart.targetY - 5}
                      fontSize={10} fontFamily={AXIS_FONT}
                      fill={colors.mutedForeground}
                      textAnchor="end"
                    >
                      Maqsad
                    </SvgText>
                  </>
                ) : null}
                <Path d={chart.area} fill={colors.primary} fillOpacity={0.1} />
                <Path d={chart.line} stroke={colors.primary} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
                {chart.xy[activeIdx] ? (
                  <>
                    {selected !== null ? (
                      <Line
                        x1={chart.xy[activeIdx].x}
                        x2={chart.xy[activeIdx].x}
                        y1={PAD.top}
                        y2={chart.baseY}
                        stroke={colors.mutedForeground}
                        strokeOpacity={0.4}
                        strokeWidth={1}
                      />
                    ) : null}
                    <Circle
                      cx={chart.xy[activeIdx].x}
                      cy={chart.xy[activeIdx].y}
                      r={5}
                      fill={colors.primary}
                      stroke={colors.card}
                      strokeWidth={2}
                    />
                  </>
                ) : null}
                <SvgText x={PAD.left} y={CHART_H - 6} fontSize={10} fontFamily={AXIS_FONT} fill={colors.mutedForeground} textAnchor="start">
                  {formatDateKeyUz(points[0].date)}
                </SvgText>
                <SvgText x={chart.plotRight} y={CHART_H - 6} fontSize={10} fontFamily={AXIS_FONT} fill={colors.mutedForeground} textAnchor="end">
                  {formatDateKeyUz(points[points.length - 1].date)}
                </SvgText>
              </Svg>
            ) : null}
          </View>
        </View>
      ) : (
        <View style={[styles.hint, { backgroundColor: colors.secondary }]}>
          <Feather name="trending-down" size={16} color={colors.primary} />
          <Text style={[styles.hintText, { color: colors.mutedForeground }]}>
            Grafik uchun kamida 2 ta o'lchov kerak. Haftada 1–2 marta, ertalab nahorga tortilib, vazningizni kiriting.
          </Text>
        </View>
      )}

      {onRemoveEntry && recent.length > 0 ? (
        <View style={styles.list}>
          {recent.map((w, i) => {
            const prev = recent[i + 1];
            const d = prev ? w.kg - prev.kg : 0;
            return (
              <View key={w.date} style={[styles.row, { borderTopColor: colors.border }]}>
                <Text style={[styles.rowDate, { color: colors.mutedForeground }]}>{formatDateKeyUz(w.date)}</Text>
                <Text style={[styles.rowKg, { color: colors.text }]}>{fmtKg(w.kg)} kg</Text>
                <Text style={[styles.rowDelta, { color: colors.mutedForeground }]}>
                  {prev && d !== 0 ? `${d > 0 ? "+" : "−"}${fmtKg(Math.abs(d))}` : ""}
                </Text>
                <Pressable
                  onPress={() => confirmRemove(w)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="O'lchovni o'chirish"
                  style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
                >
                  <Feather name="trash-2" size={14} color={colors.mutedForeground} />
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 12 },
  head: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { fontSize: 15, fontFamily: "Inter_700Bold" },
  sub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 },
  addText: { color: "#FFFFFF", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  tiles: { flexDirection: "row", gap: 8 },
  tile: { flex: 1 },
  tileLabel: { fontSize: 11.5, fontFamily: "Inter_500Medium" },
  tileValue: { fontSize: 17, fontFamily: "Inter_700Bold", marginTop: 2 },
  deltaRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  progressWrap: { gap: 6 },
  track: { height: 8, borderRadius: 4, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 4 },
  progressText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  readout: { fontSize: 12.5, fontFamily: "Inter_500Medium", marginBottom: 4 },
  hint: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 12 },
  hintText: { flex: 1, fontSize: 12.5, fontFamily: "Inter_400Regular", lineHeight: 18 },
  list: { marginTop: -2 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rowDate: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  rowKg: { fontSize: 13.5, fontFamily: "Inter_600SemiBold" },
  rowDelta: { width: 44, textAlign: "right", fontSize: 12, fontFamily: "Inter_500Medium" },
});
