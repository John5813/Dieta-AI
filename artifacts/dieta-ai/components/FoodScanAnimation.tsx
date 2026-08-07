import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, ImageSourcePropType, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

interface Props {
  width: number;
  height: number;
}

interface FoodItem {
  name: string;
  image: ImageSourcePropType;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

const FOODS: FoodItem[] = [
  { name: "Osh (palov)",     image: require("../assets/images/food_plov.webp"),  calories: 540, protein: 28, fat: 22, carbs: 62 },
  { name: "Somsa",           image: require("../assets/images/food_somsa.webp"), calories: 360, protein: 12, fat: 18, carbs: 36 },
  { name: "Olma",            image: require("../assets/images/food_apple.webp"), calories: 95,  protein: 1,  fat: 0,  carbs: 25 },
  { name: "Non (lepyoshka)", image: require("../assets/images/food_non.webp"),   calories: 270, protein: 9,  fat: 1,  carbs: 56 },
];

export function FoodScanAnimation({ width, height }: Props) {
  const colors = useColors();
  const [foodIdx, setFoodIdx] = useState(0);

  const scan = useRef(new Animated.Value(0)).current;
  const flash = useRef(new Animated.Value(0)).current;
  const dish = useRef(new Animated.Value(0)).current;
  const phonePulse = useRef(new Animated.Value(0)).current;
  const macroAnims = useRef([0, 1, 2, 3].map(() => new Animated.Value(0))).current;
  const calorieReveal = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(phonePulse, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(phonePulse, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    ).start();
  }, [phonePulse]);

  useEffect(() => {
    let cancelled = false;
    const seq = Animated.sequence([
      // 1. Dish drops in (image is already mounted, just opacity+scale)
      Animated.timing(dish, { toValue: 1, duration: 500, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }),
      Animated.delay(400),
      // 2. Scan line sweeps top → bottom
      Animated.timing(scan, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      // 3. Flash
      Animated.sequence([
        Animated.timing(flash, { toValue: 1, duration: 80, useNativeDriver: true }),
        Animated.timing(flash, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]),
      // 4. Calorie number reveal
      Animated.spring(calorieReveal, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
      // 5. Macro cards slide in
      Animated.stagger(
        140,
        macroAnims.map((a) =>
          Animated.spring(a, { toValue: 1, friction: 6, tension: 70, useNativeDriver: true }),
        ),
      ),
      // 6. Hold for reading
      Animated.delay(2200),
      // 7. Reset
      Animated.parallel([
        ...macroAnims.map((a) =>
          Animated.timing(a, { toValue: 0, duration: 280, useNativeDriver: true }),
        ),
        Animated.timing(calorieReveal, { toValue: 0, duration: 280, useNativeDriver: true }),
        Animated.timing(scan, { toValue: 0, duration: 280, useNativeDriver: true }),
        Animated.timing(dish, { toValue: 0, duration: 380, useNativeDriver: true }),
      ]),
      Animated.delay(200),
    ]);
    seq.start(({ finished }) => {
      if (finished && !cancelled) {
        setFoodIdx((i) => (i + 1) % FOODS.length);
      }
    });
    return () => {
      cancelled = true;
      seq.stop();
      dish.stopAnimation();
      scan.stopAnimation();
      flash.stopAnimation();
      calorieReveal.stopAnimation();
      macroAnims.forEach((a) => a.stopAnimation());
    };
  }, [foodIdx, dish, scan, flash, calorieReveal, macroAnims]);

  const food = FOODS[foodIdx];

  const phoneW = Math.min(width * 0.55, 240);
  const phoneH = phoneW * 1.95;
  const dishSize = phoneW * 0.78;

  const macros = [
    { icon: "award" as const,   label: "Oqsil",   value: `${food.protein} g`, color: "#E53935", side: "left"  as const, top: "32%" },
    { icon: "droplet" as const, label: "Yog'",    value: `${food.fat} g`,     color: "#3B82F6", side: "right" as const, top: "52%" },
    { icon: "circle" as const,  label: "Uglevod", value: `${food.carbs} g`,   color: "#F59E0B", side: "left"  as const, top: "72%" },
    { icon: "zap" as const,     label: "Jami",    value: `${food.calories}`,  color: "#2C5F1A", side: "right" as const, top: "12%" },
  ];

  const scanY = scan.interpolate({ inputRange: [0, 1], outputRange: [40, phoneH - 70] });
  const scanGlow = scan.interpolate({ inputRange: [0, 0.1, 0.9, 1], outputRange: [0, 1, 1, 0] });
  const dishScale = dish.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });
  const pulseScale = phonePulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.015] });
  const calorieScale = calorieReveal.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });
  const calorieY = calorieReveal.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });

  return (
    <View style={[styles.wrap, { width, height }]}>
      {macros.map((m, i) => {
        const a = macroAnims[i];
        const scale = a.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });
        const tx = a.interpolate({
          inputRange: [0, 1],
          outputRange: [m.side === "left" ? 20 : -20, 0],
        });
        return (
          <Animated.View
            key={m.label}
            style={[
              styles.macroCard,
              m.side === "left" ? styles.macroLeft : styles.macroRight,
              { top: m.top as any, opacity: a, transform: [{ scale }, { translateX: tx }] },
            ]}
          >
            <View style={[styles.macroIcon, { backgroundColor: m.color }]}>
              <Feather name={m.icon} size={12} color="#FFFFFF" />
            </View>
            <View>
              <Text style={[styles.macroLabel, { color: colors.mutedForeground }]}>{m.label}</Text>
              <Text style={[styles.macroValue, { color: colors.text }]}>{m.value}</Text>
            </View>
          </Animated.View>
        );
      })}

      <Animated.View
        style={[
          styles.phone,
          { width: phoneW, height: phoneH, transform: [{ scale: pulseScale }] },
        ]}
      >
        <View style={styles.notch} />
        <View style={styles.screen}>
          {(["tl", "tr", "bl", "br"] as const).map((c) => (
            <View key={c} style={[styles.corner, styles[c]]} />
          ))}

          <View style={styles.gridV} />
          <View style={[styles.gridV, { left: "66%" }]} />
          <View style={styles.gridH} />
          <View style={[styles.gridH, { top: "66%" }]} />

          {/* Preload ALL food images stacked - active one fades in via opacity */}
          <Animated.View
            style={[
              StyleSheet.absoluteFillObject,
              styles.dishWrap,
              { opacity: dish, transform: [{ scale: dishScale }] },
            ]}
          >
            <View style={{ width: dishSize, height: dishSize }}>
              {FOODS.map((f, i) => (
                <Image
                  key={f.name}
                  source={f.image}
                  style={[
                    StyleSheet.absoluteFillObject,
                    { width: dishSize, height: dishSize, opacity: i === foodIdx ? 1 : 0 },
                  ]}
                  resizeMode="contain"
                />
              ))}
            </View>
          </Animated.View>

          {/* Big calorie number overlay */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.calorieOverlay,
              {
                opacity: calorieReveal,
                transform: [{ scale: calorieScale }, { translateY: calorieY }],
              },
            ]}
          >
            <Text style={styles.calorieNum}>{food.calories}</Text>
            <Text style={styles.calorieUnit}>kkal</Text>
          </Animated.View>

          <Animated.View
            pointerEvents="none"
            style={[styles.scanGlow, { opacity: scanGlow, transform: [{ translateY: scanY }] }]}
          />
          <Animated.View
            pointerEvents="none"
            style={[styles.scanLine, { transform: [{ translateY: scanY }] }]}
          />

          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFillObject,
              { backgroundColor: "#FFFFFF", opacity: flash },
            ]}
          />

          <View style={styles.aiBadge}>
            <Feather name="cpu" size={10} color="#FFFFFF" />
            <Text style={styles.aiText}>AI</Text>
          </View>

          <Animated.View
            style={[
              styles.nameBar,
              {
                opacity: calorieReveal,
                transform: [
                  {
                    translateY: calorieReveal.interpolate({
                      inputRange: [0, 1],
                      outputRange: [12, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Feather name="check-circle" size={12} color="#5BA82E" />
            <Text style={styles.nameText}>{food.name}</Text>
          </Animated.View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center", position: "relative" },

  phone: {
    backgroundColor: "#1A1A1A",
    borderRadius: 36,
    padding: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
  },
  notch: {
    position: "absolute",
    top: 8,
    alignSelf: "center",
    left: "33%",
    right: "33%",
    height: 18,
    backgroundColor: "#0A0A0A",
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    zIndex: 3,
  },
  screen: {
    flex: 1,
    backgroundColor: "#0E1410",
    borderRadius: 30,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },

  corner: {
    position: "absolute",
    width: 22,
    height: 22,
    borderColor: "#5BA82E",
  },
  tl: { top: 38, left: 14, borderTopWidth: 2.5, borderLeftWidth: 2.5, borderTopLeftRadius: 6 },
  tr: { top: 38, right: 14, borderTopWidth: 2.5, borderRightWidth: 2.5, borderTopRightRadius: 6 },
  bl: { bottom: 50, left: 14, borderBottomWidth: 2.5, borderLeftWidth: 2.5, borderBottomLeftRadius: 6 },
  br: { bottom: 50, right: 14, borderBottomWidth: 2.5, borderRightWidth: 2.5, borderBottomRightRadius: 6 },

  gridV: {
    position: "absolute",
    width: 1,
    top: 38,
    bottom: 50,
    left: "33%",
    backgroundColor: "rgba(91, 168, 46, 0.12)",
  },
  gridH: {
    position: "absolute",
    height: 1,
    left: 14,
    right: 14,
    top: "33%",
    backgroundColor: "rgba(91, 168, 46, 0.12)",
  },

  dishWrap: { alignItems: "center", justifyContent: "center" },

  calorieOverlay: {
    position: "absolute",
    alignSelf: "center",
    bottom: "32%",
    backgroundColor: "rgba(44, 95, 26, 0.92)",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    zIndex: 6,
  },
  calorieNum: { fontSize: 28, fontFamily: "Inter_700Bold", color: "#FFFFFF", letterSpacing: -0.5 },
  calorieUnit: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#C7E5B8" },

  scanLine: {
    position: "absolute",
    left: 14,
    right: 14,
    top: 0,
    height: 2,
    backgroundColor: "#5BA82E",
    borderRadius: 1,
    shadowColor: "#5BA82E",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
  },
  scanGlow: {
    position: "absolute",
    left: 14,
    right: 14,
    top: -20,
    height: 40,
    backgroundColor: "rgba(91, 168, 46, 0.25)",
    borderRadius: 6,
  },

  aiBadge: {
    position: "absolute",
    top: 14,
    right: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#2C5F1A",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    zIndex: 4,
  },
  aiText: { color: "#FFFFFF", fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },

  nameBar: {
    position: "absolute",
    bottom: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  nameText: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#1A1A1A" },

  macroCard: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
    zIndex: 5,
  },
  macroLeft: { left: 0 },
  macroRight: { right: 0 },
  macroIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  macroLabel: { fontSize: 9, fontFamily: "Inter_500Medium" },
  macroValue: { fontSize: 12, fontFamily: "Inter_700Bold" },
});
