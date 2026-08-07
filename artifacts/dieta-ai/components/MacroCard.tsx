import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

interface MacroCardProps {
  emoji: string;
  value: number;
  unit: string;
  label: string;
  consumed: number;
  goal: number;
  color: string;
}

export function MacroCard({
  emoji,
  value,
  unit,
  label,
  consumed,
  goal,
  color,
}: MacroCardProps) {
  const colors = useColors();
  const over = consumed > goal;
  const overBy = Math.max(consumed - goal, 0);
  const overColor = colors.destructive ?? "#DC2626";
  const pct = over
    ? 1
    : Math.min(consumed / Math.max(goal, 1), 1);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: over ? overColor : colors.border,
          borderWidth: over ? 1.5 : 1,
        },
      ]}
    >
      <View style={styles.row}>
        <Text style={styles.emoji}>{over ? "⚠️" : emoji}</Text>
        <Text
          style={[
            styles.value,
            { color: over ? overColor : colors.text },
          ]}
        >
          {over ? `+${overBy}` : value}
          {unit}
        </Text>
      </View>
      <Text
        style={[
          styles.label,
          { color: over ? overColor : colors.mutedForeground },
          over && { fontFamily: "Inter_600SemiBold" },
        ]}
        numberOfLines={1}
      >
        {over ? "normadan oshdi" : label}
      </Text>
      <View style={[styles.track, { backgroundColor: colors.border }]}>
        <View
          style={[
            styles.fill,
            {
              backgroundColor: over ? overColor : color,
              width: `${pct * 100}%`,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 18,
    padding: 12,
    gap: 6,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  emoji: { fontSize: 16 },
  value: { fontSize: 16, fontFamily: "Inter_700Bold" },
  label: { fontSize: 11, fontFamily: "Inter_400Regular" },
  track: { height: 4, borderRadius: 2, overflow: "hidden", marginTop: 2 },
  fill: { height: "100%", borderRadius: 2 },
});
