import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import { useColors } from "@/hooks/useColors";

interface MealRingProps {
  value: number;
  goal: number;
  label: string;
  time: string;
  size?: number;
}

export function MealRing({ value, goal, label, time, size = 86 }: MealRingProps) {
  const colors = useColors();
  const stroke = 7;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const safeGoal = Math.max(goal, 1);
  const pct = Math.min(value / safeGoal, 1);
  const offset = c - c * pct;
  const over = value > safeGoal;
  const overColor = colors.destructive ?? "#DC2626";

  const gradId = `mg-${label.replace(/\s+/g, "")}`;

  return (
    <View style={styles.wrap}>
      <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={colors.accent} />
              <Stop offset="100%" stopColor={colors.primary} />
            </LinearGradient>
          </Defs>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={over ? `${overColor}30` : colors.border}
            strokeWidth={stroke}
            fill="transparent"
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={over ? overColor : `url(#${gradId})`}
            strokeWidth={stroke}
            fill="transparent"
            strokeDasharray={`${c} ${c}`}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
        <View style={styles.center}>
          <Text style={[styles.value, { color: over ? overColor : colors.text }]}>
            {Math.round(value)}
          </Text>
          <Text style={[styles.unit, { color: colors.mutedForeground }]}>
            / {Math.round(safeGoal)}
          </Text>
        </View>
      </View>
      <Text style={[styles.label, { color: colors.text }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.time, { color: colors.mutedForeground }]}>{time}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: 4, flex: 1, minWidth: 86 },
  center: { alignItems: "center" },
  value: { fontSize: 18, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  unit: { fontSize: 9, fontFamily: "Inter_500Medium", marginTop: -2 },
  label: { fontSize: 11, fontFamily: "Inter_600SemiBold", marginTop: 4 },
  time: { fontSize: 10, fontFamily: "Inter_500Medium" },
});
