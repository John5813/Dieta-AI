import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useColors } from "@/hooks/useColors";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface Props {
  value: number;
  unit?: string;
  label: string;
  color: string;
  size?: number;
  pct?: number;
  delay?: number;
}

export function MacroDonut({
  value,
  unit = "g",
  label,
  color,
  size = 88,
  pct = 100,
  delay = 0,
}: Props) {
  const colors = useColors();
  const stroke = 7;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: pct / 100,
      duration: 900,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [anim, pct, delay]);

  const dashOffset = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [c, 0],
  });

  return (
    <View style={[styles.wrap, { width: size + 16 }]}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={colors.border}
            strokeWidth={stroke}
            fill="transparent"
            opacity={0.4}
          />
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            fill="transparent"
            strokeDasharray={`${c} ${c}`}
            strokeDashoffset={dashOffset as unknown as number}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
        <View style={styles.center}>
          <Text style={[styles.value, { color: colors.text }]}>
            {value}
            <Text style={[styles.unit, { color: colors.mutedForeground }]}>{unit}</Text>
          </Text>
          <Text style={[styles.pct, { color }]}>{pct}%</Text>
        </View>
      </View>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: 8 },
  center: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  value: { fontSize: 16, fontFamily: "Inter_700Bold" },
  unit: { fontSize: 10, fontFamily: "Inter_500Medium" },
  pct: { fontSize: 10, fontFamily: "Inter_600SemiBold", marginTop: -2 },
  label: { fontSize: 12, fontFamily: "Inter_500Medium" },
});
