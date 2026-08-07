import { router } from "expo-router";
import React from "react";
import {
  Dimensions,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FoodScanAnimation } from "@/components/FoodScanAnimation";
import { ProgressBar } from "@/components/ProgressBar";
import { useColors } from "@/hooks/useColors";

const { width, height } = Dimensions.get("window");

export default function WelcomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.backBtn} />
        <View style={styles.progressWrap}>
          <ProgressBar current={1} total={18} />
        </View>
      </View>

      <View style={styles.imageWrap}>
        <FoodScanAnimation width={width * 0.92} height={width * 1.15} />
      </View>

      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>
          Kaloriyani oson{"\n"}hisoblash
        </Text>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          onPress={() => router.push("/onboarding/register")}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>
            Keyingi
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 12,
  },
  backBtn: { width: 32 },
  progressWrap: { flex: 1 },
  imageWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  imagePlaceholder: {
    width: width * 0.72,
    height: width * 0.9,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  phoneFrame: {
    width: width * 0.38,
    height: width * 0.68,
    borderRadius: 20,
    borderWidth: 3,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
  },
  phoneScreen: {
    flex: 1,
    width: "100%",
    borderRadius: 14,
    padding: 10,
    justifyContent: "center",
  },
  foodItem: { height: 48, borderRadius: 8, marginBottom: 6 },
  foodItem2: { height: 36, borderRadius: 8 },
  content: { paddingHorizontal: 24, paddingTop: 8 },
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    lineHeight: 36,
  },
  footer: { paddingHorizontal: 24, paddingTop: 16 },
  button: {
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
});
