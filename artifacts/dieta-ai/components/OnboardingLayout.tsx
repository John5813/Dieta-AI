import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ProgressBar } from "./ProgressBar";
import { useColors } from "@/hooks/useColors";

interface OnboardingLayoutProps {
  step: number;
  total: number;
  title: string;
  subtitle?: string;
  buttonText?: string;
  buttonDisabled?: boolean;
  onNext: () => void;
  onBack?: () => void;
  children: React.ReactNode;
  scrollable?: boolean;
}

export function OnboardingLayout({
  step,
  total,
  title,
  subtitle,
  buttonText = "Keyingi",
  buttonDisabled = false,
  onNext,
  onBack,
  children,
  scrollable = false,
}: OnboardingLayoutProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const Content = scrollable ? ScrollView : View;

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 12, backgroundColor: colors.background },
        ]}
      >
        {onBack !== undefined ? (
          <Pressable
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.5 }]}
            onPress={onBack}
            hitSlop={16}
            testID="back-button"
          >
            <Feather name="arrow-left" size={24} color={colors.text} />
          </Pressable>
        ) : (
          <View style={styles.backBtn} />
        )}
        <View style={styles.progressWrap}>
          <ProgressBar current={step} total={total} />
        </View>
      </View>

      <Content
        style={styles.body}
        contentContainerStyle={scrollable ? styles.scrollContent : undefined}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{subtitle}</Text>
        ) : null}
        {children}
      </Content>

      <View
        style={[
          styles.footer,
          { paddingBottom: insets.bottom + 16, backgroundColor: colors.background },
        ]}
      >
        <Pressable
          testID="next-button"
          onPress={onNext}
          disabled={buttonDisabled}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: buttonDisabled ? colors.mutedForeground : colors.primary },
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>
            {buttonText}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
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
    zIndex: 10,
    elevation: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: -8,
  },
  progressWrap: { flex: 1 },
  body: { flex: 1, paddingHorizontal: 24 },
  scrollContent: { paddingBottom: 20 },
  title: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    marginTop: 20,
    marginBottom: 8,
    lineHeight: 34,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
    marginBottom: 24,
  },
  footer: { paddingHorizontal: 24, paddingTop: 12 },
  button: {
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPressed: { opacity: 0.85 },
  buttonText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
});
