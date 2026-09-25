import React from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "@/components/i18n/Text";
import { useColors } from "@/hooks/useColors";
import type { Achievement } from "@/lib/insights";

/** Earned badges in color, locked ones greyed with their progress. */
export function AchievementsGrid({ badges }: { badges: Achievement[] }) {
  const colors = useColors();
  const earned = badges.filter((b) => b.current >= b.target).length;
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.head}>
        <Text style={[styles.title, { color: colors.text }]}>Yutuqlar</Text>
        <Text style={[styles.count, { color: colors.primary }]}>
          {earned} / {badges.length}
        </Text>
      </View>
      <View style={styles.grid}>
        {badges.map((b) => {
          const done = b.current >= b.target;
          const pct = Math.min(1, b.current / b.target);
          return (
            <View
              key={b.id}
              style={[
                styles.badge,
                { backgroundColor: done ? colors.secondary : colors.background, borderColor: done ? colors.primary : colors.border },
              ]}
            >
              <Text style={[styles.emoji, !done && styles.locked]}>{b.emoji}</Text>
              <Text style={[styles.badgeTitle, { color: done ? colors.text : colors.mutedForeground }]} numberOfLines={2}>
                {b.title}
              </Text>
              {done ? (
                <Text style={[styles.badgeSub, { color: colors.primary }]}>Olindi ✓</Text>
              ) : (
                <>
                  <View style={[styles.track, { backgroundColor: colors.border }]}>
                    <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: colors.primary }]} />
                  </View>
                  <Text style={[styles.badgeSub, { color: colors.mutedForeground }]} numberOfLines={2}>
                    {b.desc}
                  </Text>
                </>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 12, marginTop: 16 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 16, fontFamily: "Inter_700Bold" },
  count: { fontSize: 14, fontFamily: "Inter_700Bold" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  badge: { width: "31.5%", flexGrow: 1, borderRadius: 14, borderWidth: 1, padding: 10, alignItems: "center", gap: 4 },
  emoji: { fontSize: 26 },
  locked: { opacity: 0.35 },
  badgeTitle: { fontSize: 12, fontFamily: "Inter_700Bold", textAlign: "center", minHeight: 30 },
  badgeSub: { fontSize: 10, fontFamily: "Inter_500Medium", textAlign: "center" },
  track: { width: "100%", height: 4, borderRadius: 2, overflow: "hidden" },
  fill: { height: 4, borderRadius: 2 },
});
