import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Tabs, useRouter } from "expo-router";
import React, { useEffect } from "react";
import { Platform, Pressable, StyleSheet, View, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { useTranslation } from "@/hooks/useTranslation";

function CameraTabButton({ onPress, bottomPad }: { onPress: () => void; bottomPad: number }) {
  return (
    <View style={[styles.cameraOuter, { paddingBottom: bottomPad }]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Ovqat qo'shish"
        style={({ pressed }) => [
          styles.cameraPressable,
          {
            opacity: pressed ? 0.88 : 1,
            transform: [{ scale: pressed ? 0.91 : 1 }],
          },
        ]}
      >
        <View style={styles.cameraRing}>
          <LinearGradient
            colors={["#3CB371", "#2D8A2D", "#1E5C1E"]}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={styles.cameraGrad}
          >
            <Feather name="camera" size={27} color="#FFFFFF" />
          </LinearGradient>
        </View>
      </Pressable>
    </View>
  );
}

export default function TabLayout() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const { setAddFoodModalVisible, subscription, canScan } = useApp();
  const { t } = useTranslation();
  const router = useRouter();
  const isDark = colorScheme === "dark";

  // Trial tugagach yoki obuna yo'q bo'lsa premium ekraniga yo'naltirish
  useEffect(() => {
    if (subscription.status === "active") return;
    const result = canScan();
    if (!result.allowed && (result.reason === "trial_expired" || result.reason === "locked")) {
      router.replace("/onboarding/premium" as never);
    }
  }, [subscription.status, subscription.trialStartedAt]);

  // Tab bar pastroqqa tushiriladi: native va web bir xil ko'rinadi.
  // Bottom inset (home indicator) hisobga olinadi va qo'shimcha 14px joy beriladi.
  const bottomPad = Math.max(insets.bottom, 14);
  const tabBarHeight = 64 + bottomPad;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: "#9BAF8E",
        headerShown: false,
        tabBarLabelStyle: {
          fontSize: 10,
          fontFamily: "Inter_500Medium",
          marginTop: -2,
        },
        tabBarItemStyle: {
          paddingTop: 8,
          paddingBottom: bottomPad,
        },
        tabBarStyle: {
          position: "absolute",
          backgroundColor: "transparent",
          borderTopWidth: 0,
          elevation: 0,
          height: tabBarHeight,
          paddingTop: 0,
          paddingBottom: 0,
        },
        tabBarBackground: () => (
          <View
            style={[
              StyleSheet.absoluteFill,
              styles.tabBarBg,
              { backgroundColor: isDark ? "#1A1A1A" : "#FFFFFF" },
            ]}
          />
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Bosh sahifa",
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
              <Feather name="home" size={20} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="ai"
        options={{
          title: "Suniy intellekt",
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
              <Feather name="cpu" size={20} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="food"
        options={{
          title: "",
          tabBarLabel: () => null,
          tabBarIcon: () => null,
          tabBarButton: () => (
            <CameraTabButton
              onPress={() => setAddFoodModalVisible(true)}
              bottomPad={bottomPad}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="ratsion"
        options={{
          title: "Ovqatlanish rejasi",
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
              <Feather name="bar-chart-2" size={20} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
              <Feather name="user" size={20} color={color} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarBg: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 12,
    overflow: "hidden",
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapActive: {
    backgroundColor: "#2C5F1A14",
  },
  cameraOuter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  cameraPressable: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: -6,
  },
  cameraRing: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2D8A2D",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 10,
    padding: 3,
  },
  cameraGrad: {
    width: "100%",
    height: "100%",
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
});
