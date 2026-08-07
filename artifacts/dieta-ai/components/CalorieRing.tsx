import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import { useColors } from "@/hooks/useColors";

interface CalorieRingProps {
  value: number;
  goal: number;
  label?: string;
  size?: number;
}

export function CalorieRing({
  value,
  goal,
  label,
  size = 220,
}: CalorieRingProps) {
  const colors = useColors();
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const safeValue = Number.isFinite(value) ? value : 0;
  const safeGoal = Number.isFinite(goal) && goal > 0 ? goal : 1;
  const remaining = safeGoal - safeValue;
  const over = remaining < 0;
  const pct = Math.min(safeValue / safeGoal, 1);
  const offset = c - c * pct;

  const overshoot = Math.min(Math.max(safeValue - safeGoal, 0) / safeGoal, 1);
  const overOffset = c - c * overshoot;

  const overColor = colors.destructive ?? "#DC2626";
  const displayLabel = label ?? (over ? "Ortib ketdi" : "Qolgan kaloriyalar");

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={colors.accent} />
            <Stop offset="100%" stopColor={colors.primary} />
          </LinearGradient>
          <LinearGradient id="overGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#F59E0B" />
            <Stop offset="100%" stopColor={overColor} />
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
          stroke={over ? overColor : "url(#grad)"}
          strokeWidth={stroke}
          fill="transparent"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        {over && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="url(#overGrad)"
            strokeWidth={stroke}
            fill="transparent"
            strokeDasharray={`${c} ${c}`}
            strokeDashoffset={overOffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            opacity={0.85}
          />
        )}
      </Svg>
      <View style={styles.center}>
        <Text
          style={[
            styles.value,
            { color: over ? overColor : colors.text, fontSize: Math.round(size * 0.22) },
          ]}
          adjustsFontSizeToFit
          numberOfLines={1}
        >
          {(over ? "−" : "") +
            Math.abs(remaining).toLocaleString("ru-RU").replace(/,/g, " ")}
        </Text>
        <Text
          style={[
            styles.label,
            { color: over ? overColor : colors.mutedForeground },
          ]}
        >
          {displayLabel}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
  center: { alignItems: "center" },
  value: { fontFamily: "Inter_700Bold", letterSpacing: -1 },
  label: { fontSize: 14, fontFamily: "Inter_500Medium", marginTop: -4 },
});
