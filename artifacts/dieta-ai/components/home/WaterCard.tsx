import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/components/i18n/Text";
import { useTracker } from "@/context/TrackerContext";
import { useColors, useTint } from "@/hooks/useColors";
import { tr } from "@/lib/i18n";

const GLASS_ML = 250;
const WATER = "#2563EB";

function fmtL(ml: number): string {
  return ml >= 1000 ? `${(ml / 1000).toFixed(ml % 1000 === 0 ? 0 : 2).replace(/0$/, "")} L` : tr("{0} ml", ml);
}

/** Glass-by-glass water log for one day. */
export function WaterCard({ dateKey, goalMl }: { dateKey: string; goalMl: number }) {
  const colors = useColors();
  const tint = useTint();
  const { waterByDate, addWater } = useTracker();
  const drunk = waterByDate[dateKey] ?? 0;
  const glassesGoal = Math.min(12, Math.max(4, Math.round(goalMl / GLASS_ML)));
  const filled = Math.floor(drunk / GLASS_ML);
  const pct = Math.min(1, drunk / Math.max(goalMl, 1));
  const done = drunk >= goalMl;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.head}>
        <View style={[styles.icon, { backgroundColor: tint("#DBEAFE", WATER) }]}>
          <Feather name="droplet" size={18} color={WATER} />
        </View>
        <View style={styles.flex1}>
          <Text style={[styles.title, { color: colors.text }]}>Suv</Text>
          <Text style={[styles.sub, { color: done ? "#16A34A" : colors.mutedForeground }]}>
            {done ? tr("Kunlik me'yor bajarildi · {0}", fmtL(drunk)) : `${fmtL(drunk)} / ${fmtL(goalMl)}`}
          </Text>
        </View>
        <Pressable
          onPress={() => addWater(-GLASS_ML, dateKey)}
          disabled={drunk <= 0}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Bir stakan olib tashlash"
          style={({ pressed }) => [
            styles.btn,
            { borderColor: colors.border, opacity: drunk <= 0 ? 0.35 : pressed ? 0.7 : 1 },
          ]}
        >
          <Feather name="minus" size={18} color={WATER} />
        </Pressable>
        <Pressable
          onPress={() => addWater(GLASS_ML, dateKey)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Bir stakan suv qo'shish"
          style={({ pressed }) => [styles.btn, styles.btnPrimary, { opacity: pressed ? 0.8 : 1 }]}
        >
          <Feather name="plus" size={18} color="#FFFFFF" />
        </Pressable>
      </View>

      <View style={styles.glasses}>
        {Array.from({ length: glassesGoal }, (_, i) => (
          <Pressable
            key={i}
            // Tapping a glass fills up to it; tapping the last full one empties it.
            onPress={() => addWater((i + 1 === filled ? i : i + 1) * GLASS_ML - drunk, dateKey)}
            hitSlop={2}
            accessibilityLabel={`${i + 1} stakan`}
          >
            <MaterialCommunityIcons
              name={i < filled ? "cup-water" : "cup-outline"}
              size={22}
              color={i < filled ? WATER : colors.border}
            />
          </Pressable>
        ))}
      </View>

      <View style={[styles.track, { backgroundColor: tint("#DBEAFE", WATER) }]}>
        <View style={[styles.fill, { width: `${pct * 100}%` }]} />
      </View>
      <Text style={[styles.hint, { color: colors.mutedForeground }]}>1 stakan = {GLASS_ML} ml</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  card: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 10, marginBottom: 12 },
  head: { flexDirection: "row", alignItems: "center", gap: 10 },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 15, fontFamily: "Inter_700Bold" },
  sub: { fontSize: 12.5, fontFamily: "Inter_500Medium", marginTop: 1 },
  btn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimary: { backgroundColor: WATER, borderColor: WATER },
  glasses: { flexDirection: "row", justifyContent: "space-between" },
  track: { height: 6, borderRadius: 3, overflow: "hidden" },
  fill: { height: 6, borderRadius: 3, backgroundColor: WATER },
  hint: { fontSize: 11, fontFamily: "Inter_400Regular" },
});
