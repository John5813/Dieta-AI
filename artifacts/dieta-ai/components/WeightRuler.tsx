import React, { useEffect, useRef } from "react";
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";

const { width } = Dimensions.get("window");
const TICK_SPACING = 12;
const RULER_W = width;

interface WeightRulerProps {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  unit?: string;
}

export function WeightRuler({ value, onChange, min = 30, max = 200, unit = "kg" }: WeightRulerProps) {
  const colors = useColors();
  const ref = useRef<ScrollView>(null);

  const ticks = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  useEffect(() => {
    if (ref.current) {
      const offset = (value - min) * TICK_SPACING;
      ref.current.scrollTo({ x: offset, animated: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const next = Math.min(max, Math.max(min, min + Math.round(x / TICK_SPACING)));
    if (next !== value) onChange(next);
  };

  return (
    <View style={styles.wrap}>
      <Text style={[styles.value, { color: colors.text }]}>
        {value} <Text style={[styles.unit, { color: colors.mutedForeground }]}>{unit}</Text>
      </Text>
      <View style={styles.rulerContainer}>
        <ScrollView
          ref={ref}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={TICK_SPACING}
          decelerationRate="fast"
          onScroll={handleScroll}
          scrollEventThrottle={16}
          contentContainerStyle={{
            paddingHorizontal: RULER_W / 2,
          }}
        >
          {ticks.map((kg) => {
            const isMajor = kg % 5 === 0;
            const isCurrent = kg === value;
            return (
              <View key={kg} style={styles.tickWrap}>
                <View
                  style={[
                    styles.tick,
                    {
                      height: isMajor ? 28 : 14,
                      backgroundColor: isCurrent
                        ? colors.primary
                        : isMajor
                        ? colors.text
                        : colors.mutedForeground,
                      opacity: isCurrent ? 1 : isMajor ? 0.6 : 0.4,
                    },
                  ]}
                />
                {isMajor && (
                  <Text style={[styles.tickLabel, { color: colors.mutedForeground }]}>{kg}</Text>
                )}
              </View>
            );
          })}
        </ScrollView>
        <View pointerEvents="none" style={[styles.indicator, { backgroundColor: colors.primary }]} />
        <View pointerEvents="none" style={styles.fadeLeft} />
        <View pointerEvents="none" style={styles.fadeRight} />
      </View>
      <Text style={[styles.hint, { color: colors.mutedForeground }]}>← suring →</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", marginTop: 16, width: "100%" },
  value: { fontSize: 56, fontFamily: "Inter_700Bold", letterSpacing: -1 },
  unit: { fontSize: 20, fontFamily: "Inter_500Medium" },
  rulerContainer: {
    width: RULER_W,
    height: 70,
    marginTop: 12,
    position: "relative",
    justifyContent: "center",
  },
  tickWrap: {
    width: TICK_SPACING,
    alignItems: "center",
    justifyContent: "flex-start",
    height: 50,
  },
  tick: { width: 2, borderRadius: 1, marginTop: 4 },
  tickLabel: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 4 },
  indicator: {
    position: "absolute",
    top: 0,
    left: RULER_W / 2 - 1.5,
    width: 3,
    height: 40,
    borderRadius: 2,
  },
  fadeLeft: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 60,
    backgroundColor: "transparent",
  },
  fadeRight: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 60,
    backgroundColor: "transparent",
  },
  hint: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 12 },
});
