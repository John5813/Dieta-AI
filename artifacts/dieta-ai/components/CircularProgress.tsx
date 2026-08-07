import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

interface CircularProgressProps {
  value: number;
  label: string;
  unit?: string;
  color: string;
  size?: number;
}

export function CircularProgress({
  value,
  label,
  unit = "",
  color,
  size = 90,
}: CircularProgressProps) {
  const colors = useColors();
  const stroke = 8;
  const r = (size - stroke) / 2;

  return (
    <View style={[styles.wrap, { width: size + 24 }]}>
      <View
        style={[
          styles.circle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: color,
            borderWidth: stroke,
            backgroundColor: colors.card,
          },
        ]}
      >
        <Text style={[styles.value, { color: colors.text }]}>
          {value}
          {unit}
        </Text>
      </View>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: 8 },
  circle: { alignItems: "center", justifyContent: "center" },
  value: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  label: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
  },
});
