import React from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "@/components/i18n/Text";
import type { DiaryEntry } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

// WHO daily limits: under 50 g of free sugar and under 5 g of salt.
const SUGAR_LIMIT_G = 50;
const SALT_LIMIT_G = 5;

function Meter({ label, value, limit, unit, color }: { label: string; value: number; limit: number; unit: string; color: string }) {
  const colors = useColors();
  const over = value > limit;
  const pct = Math.min(1, value / limit);
  return (
    <View style={styles.meter}>
      <View style={styles.meterHead}>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
        <Text style={[styles.value, { color: over ? "#DC2626" : colors.text }]}>
          {value % 1 === 0 ? value : value.toFixed(1)} / {limit} {unit}
        </Text>
      </View>
      <View style={[styles.track, { backgroundColor: colors.secondary }]}>
        <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: over ? "#DC2626" : color }]} />
      </View>
    </View>
  );
}

/** Day's sugar and salt against WHO limits, counted from entries that have the data. */
export function SugarSaltRow({ entries }: { entries: DiaryEntry[] }) {
  const colors = useColors();
  const withSugar = entries.filter((e) => e.sugar != null);
  const withSodium = entries.filter((e) => e.sodiumMg != null);
  if (withSugar.length === 0 && withSodium.length === 0) return null;
  const sugar = withSugar.reduce((s, e) => s + (e.sugar ?? 0), 0);
  const saltG = Math.round((withSodium.reduce((s, e) => s + (e.sodiumMg ?? 0), 0) * 2.5) / 100) / 10;
  const partial = withSugar.length < entries.length || withSodium.length < entries.length;
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.row}>
        <Meter label="🍬 Qand" value={sugar} limit={SUGAR_LIMIT_G} unit="g" color="#EC4899" />
        <Meter label="🧂 Tuz" value={saltG} limit={SALT_LIMIT_G} unit="g" color="#64748B" />
      </View>
      {partial ? (
        <Text style={[styles.note, { color: colors.mutedForeground }]}>
          Faqat qand/tuz miqdori ma'lum bo'lgan ovqatlar hisoblandi (AI tahlil va shtrix-kod).
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 8, marginBottom: 12 },
  row: { flexDirection: "row", gap: 16 },
  meter: { flex: 1, gap: 6 },
  meterHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  label: { fontSize: 12.5, fontFamily: "Inter_600SemiBold" },
  value: { fontSize: 12.5, fontFamily: "Inter_700Bold" },
  track: { height: 6, borderRadius: 3, overflow: "hidden" },
  fill: { height: 6, borderRadius: 3 },
  note: { fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 15 },
});
