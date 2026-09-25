import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "@/components/i18n/Text";
import { useColors } from "@/hooks/useColors";
import type { WeeklyReport } from "@/lib/insights";
import { tr } from "@/lib/i18n";

function Cell({ label, value, sub }: { label: string; value: string; sub?: string }) {
  const colors = useColors();
  return (
    <View style={[styles.cell, { backgroundColor: colors.background }]}>
      <Text style={[styles.cellValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.cellLabel, { color: colors.mutedForeground }]}>{label}</Text>
      {sub ? <Text style={[styles.cellSub, { color: colors.mutedForeground }]}>{sub}</Text> : null}
    </View>
  );
}

/** Last-7-days summary with a few concrete tips. */
export function WeeklyReportCard({ report, goalCal }: { report: WeeklyReport; goalCal: number }) {
  const colors = useColors();
  const w = report.weightChange;
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.primary }]}>
      <View style={styles.head}>
        <View style={[styles.icon, { backgroundColor: colors.secondary }]}>
          <Feather name="file-text" size={18} color={colors.primary} />
        </View>
        <View style={styles.flex1}>
          <Text style={[styles.title, { color: colors.text }]}>Haftalik hisobot</Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>Oxirgi 7 kun · {report.daysLogged} kun yozilgan</Text>
        </View>
      </View>
      <View style={styles.grid}>
        <Cell label="O'rtacha kkal" value={report.avgCal ? String(report.avgCal) : "—"} sub={tr("me'yor {0}", goalCal)} />
        <Cell label="Me'yorda" value={tr("{0} kun", report.daysOnTarget)} sub={report.daysOver ? tr("{0} kun oshgan", report.daysOver) : undefined} />
        <Cell
          label="Vazn"
          value={w == null ? "—" : tr("{0}{1} kg", w > 0 ? "+" : "", w)}
          sub={w == null ? "2 ta o'lchov kerak" : undefined}
        />
        <Cell label="O'rtacha oqsil" value={report.avgProtein ? `${report.avgProtein} g` : "—"} />
        <Cell label="Suv" value={report.avgWaterMl ? `${(report.avgWaterMl / 1000).toFixed(1)} L` : "—"} sub="kuniga" />
        <Cell label="Qadam" value={report.avgSteps ? report.avgSteps.toLocaleString("ru-RU") : "—"} sub="kuniga" />
      </View>
      {report.topFood && report.topFood.count > 1 ? (
        <Text style={[styles.line, { color: colors.text }]}>
          Eng ko'p: <Text style={styles.bold}>{report.topFood.name}</Text> ({report.topFood.count} marta)
        </Text>
      ) : null}
      {report.tips.map((t) => (
        <View key={t} style={[styles.tip, { backgroundColor: colors.secondary }]}>
          <Feather name="zap" size={13} color={colors.primary} />
          <Text style={[styles.tipText, { color: colors.text }]}>{t}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  card: { borderRadius: 18, borderWidth: 1.5, padding: 16, gap: 10, marginBottom: 16 },
  head: { flexDirection: "row", alignItems: "center", gap: 10 },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 16, fontFamily: "Inter_700Bold" },
  sub: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 1 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  cell: { width: "31.5%", flexGrow: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 8, alignItems: "center" },
  cellValue: { fontSize: 15, fontFamily: "Inter_700Bold" },
  cellLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", marginTop: 2, textAlign: "center" },
  cellSub: { fontSize: 10, fontFamily: "Inter_400Regular", textAlign: "center" },
  line: { fontSize: 13, fontFamily: "Inter_500Medium" },
  bold: { fontFamily: "Inter_700Bold" },
  tip: { flexDirection: "row", gap: 8, alignItems: "flex-start", borderRadius: 10, padding: 10 },
  tipText: { flex: 1, fontSize: 12.5, fontFamily: "Inter_500Medium", lineHeight: 17 },
});
