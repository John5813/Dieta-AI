import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

interface Props {
  size: number;
}

const DIETITIAN = require("../assets/images/dietitian.webp");

const GOALS = [
  "Sog'lom vazn",
  "Kunlik kaloriya",
  "Muvozanatli ovqat",
  "Doimiy natija",
];

export function DietitianAnimation({ size }: Props) {
  const colors = useColors();
  const [cycle, setCycle] = useState(0);
  const breathing = useRef(new Animated.Value(0)).current;
  const goalAnims = useRef(GOALS.map(() => new Animated.Value(0))).current;
  const penWiggle = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(breathing, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breathing, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    ).start();
  }, [breathing]);

  useEffect(() => {
    let cancelled = false;
    const seq = Animated.sequence([
      ...goalAnims.flatMap((a) => [
        Animated.parallel([
          Animated.spring(a, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(penWiggle, { toValue: 1, duration: 200, useNativeDriver: true }),
            Animated.timing(penWiggle, { toValue: -1, duration: 200, useNativeDriver: true }),
            Animated.timing(penWiggle, { toValue: 0, duration: 200, useNativeDriver: true }),
          ]),
        ]),
        Animated.delay(450),
      ]),
      Animated.delay(1500),
      Animated.parallel(
        goalAnims.map((a) => Animated.timing(a, { toValue: 0, duration: 350, useNativeDriver: true })),
      ),
      Animated.delay(300),
    ]);
    seq.start(({ finished }) => {
      if (finished && !cancelled) setCycle((c) => c + 1);
    });
    return () => {
      cancelled = true;
      goalAnims.forEach((a) => a.stopAnimation());
      penWiggle.stopAnimation();
    };
  }, [cycle, goalAnims, penWiggle]);

  const breatheY = breathing.interpolate({ inputRange: [0, 1], outputRange: [0, -4] });
  const penRotate = penWiggle.interpolate({ inputRange: [-1, 1], outputRange: ["-8deg", "8deg"] });

  const avatarSize = size * 0.62;
  const clipboardW = size * 0.5;
  const clipboardH = size * 0.62;

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      {/* soft background glow */}
      <View style={[styles.glow, { backgroundColor: colors.secondary, width: size * 0.85, height: size * 0.85 }]} />

      {/* dietitian avatar */}
      <Animated.View style={[styles.avatarWrap, { transform: [{ translateY: breatheY }] }]}>
        <Image
          source={DIETITIAN}
          style={{ width: avatarSize, height: avatarSize }}
          resizeMode="contain"
        />
      </Animated.View>

      {/* clipboard with goals */}
      <View
        style={[
          styles.clipboard,
          {
            width: clipboardW,
            height: clipboardH,
            backgroundColor: "#FFFFFF",
            borderColor: colors.border,
          },
        ]}
      >
        <View style={[styles.clip, { backgroundColor: "#8B6F47" }]} />
        <View style={[styles.clipShadow]} />

        <View style={styles.paper}>
          <Text style={[styles.paperTitle, { color: colors.primary }]}>Maqsadlar</Text>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {GOALS.map((g, i) => {
            const a = goalAnims[i];
            const opacity = a;
            const tx = a.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] });
            return (
              <Animated.View
                key={g}
                style={[styles.goalRow, { opacity, transform: [{ translateX: tx }] }]}
              >
                <View style={[styles.checkBox, { backgroundColor: colors.primary }]}>
                  <Feather name="check" size={9} color="#FFFFFF" />
                </View>
                <Text style={[styles.goalText, { color: colors.text }]} numberOfLines={1}>
                  {g}
                </Text>
              </Animated.View>
            );
          })}
        </View>

        {/* pen */}
        <Animated.View
          style={[
            styles.pen,
            {
              transform: [{ rotate: penRotate }],
            },
          ]}
        >
          <View style={[styles.penBody, { backgroundColor: colors.primary }]} />
          <View style={[styles.penTip, { borderTopColor: colors.text }]} />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center", position: "relative" },
  glow: {
    position: "absolute",
    borderRadius: 999,
    opacity: 0.5,
  },
  avatarWrap: {
    position: "absolute",
    top: 0,
    left: "8%",
    alignItems: "center",
    justifyContent: "center",
  },
  clipboard: {
    position: "absolute",
    right: 0,
    bottom: 0,
    borderRadius: 12,
    borderWidth: 1,
    padding: 8,
    paddingTop: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
  clip: {
    position: "absolute",
    top: -6,
    alignSelf: "center",
    width: 36,
    height: 14,
    borderRadius: 4,
  },
  clipShadow: {
    position: "absolute",
    top: 6,
    alignSelf: "center",
    width: 30,
    height: 4,
    backgroundColor: "rgba(0,0,0,0.1)",
    borderRadius: 2,
  },
  paper: { flex: 1, paddingHorizontal: 4, paddingTop: 4 },
  paperTitle: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  divider: { height: 1, marginVertical: 6 },
  goalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginVertical: 4,
  },
  checkBox: {
    width: 14,
    height: 14,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  goalText: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    flex: 1,
  },
  pen: {
    position: "absolute",
    right: -10,
    bottom: 30,
    width: 40,
    height: 6,
    transform: [{ rotate: "0deg" }],
  },
  penBody: {
    position: "absolute",
    left: 6,
    width: 30,
    height: 6,
    borderRadius: 3,
  },
  penTip: {
    position: "absolute",
    left: 0,
    width: 0,
    height: 0,
    borderTopWidth: 3,
    borderBottomWidth: 3,
    borderRightWidth: 8,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
    borderRightColor: "#222",
  },
});
