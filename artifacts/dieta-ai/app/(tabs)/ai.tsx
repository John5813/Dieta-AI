import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  KeyboardAvoidingView,
  useKeyboardState,
} from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";

interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
}

function cleanMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/gs, "$1")
    .replace(/\*(.+?)\*/gs, "$1")
    .replace(/__(.+?)__/gs, "$1")
    .replace(/_(.+?)_/gs, "$1")
    .replace(/`{1,3}([^`]*)`{1,3}/g, "$1")
    .replace(/^[-*_]{3,}\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const SUGGESTIONS = [
  "Bugun nima yeyishim kerak?",
  "Palovning kaloriyasi qancha?",
  "Vazn yo'qotish uchun maslahat",
  "Oqsil ko'p taomlar ro'yxati",
];

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "https://dietaai-lexhk.ondigitalocean.app";

export default function AiScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const scrollRef = useRef<ScrollView | null>(null);
  const { profile, entries, todayKey, yesterdayKey } = useApp();

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      const userMsg: ChatMsg = {
        id: `u-${Date.now()}`,
        role: "user",
        content: trimmed,
      };
      const next = [...messages, userMsg];
      setMessages(next);
      setInput("");
      setError(null);
      setLoading(true);

      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }

      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 50);

      try {
        const age = profile.birthDate
          ? new Date().getFullYear() - profile.birthDate.year
          : undefined;
        const todayItems = entries
          .filter((e) => e.date === todayKey)
          .map((e) => ({
            name: e.name,
            cal: e.cal,
            protein: e.protein,
            carbs: e.carbs,
            fat: e.fat,
            time: e.time,
          }));
        const yItems = entries
          .filter((e) => e.date === yesterdayKey)
          .map((e) => ({
            name: e.name,
            cal: e.cal,
            protein: e.protein,
            carbs: e.carbs,
            fat: e.fat,
            time: e.time,
          }));
        const res = await fetch(`${API_BASE}/api/ai/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: next.map((m) => ({ role: m.role, content: m.content })),
            userContext: {
              gender: profile.gender,
              age,
              heightCm: profile.height,
              currentWeight: profile.currentWeight,
              targetWeight: profile.targetWeight,
              goal: profile.goal,
              dailyCalories: profile.dailyCalories,
              dailyProtein: profile.protein,
              dailyCarbs: profile.carbs,
              dailyFat: profile.fat,
              mealsPerDay: profile.mealsPerDay,
            },
            diary: {
              todayDate: todayKey,
              yesterdayDate: yesterdayKey,
              today: todayItems,
              yesterday: yItems,
            },
          }),
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const json = await res.json() as { reply: string };
        setMessages((prev) => [
          ...prev,
          { id: `a-${Date.now()}`, role: "assistant", content: json.reply },
        ]);
        setTimeout(() => {
          scrollRef.current?.scrollToEnd({ animated: true });
        }, 50);
      } catch {
        setError("Javob olishda xatolik yuz berdi. Qaytadan urinib ko'ring.");
      } finally {
        setLoading(false);
      }
    },
    [messages, loading, profile, entries, todayKey, yesterdayKey],
  );

  const clear = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  const isEmpty = messages.length === 0;

  const keyboardVisible = useKeyboardState((s) => s.isVisible);
  // Tab bar balandligi: _layout.tsx dagi 64 + Math.max(insets.bottom, 14) bilan bir xil
  const TAB_BAR_HEIGHT = 64 + Math.max(insets.bottom, 14);
  // Klaviatura ochilganda tab-bar paddingi kerak emas (KAV uni o'rnini bosadi)
  const inputBottomPad =
    Platform.OS === "web"
      ? 90
      : keyboardVisible
        ? 8
        : TAB_BAR_HEIGHT;

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior="padding"
      keyboardVerticalOffset={0}
    >
      <View style={[styles.header, { paddingTop: topPad + 8, borderColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <View style={[styles.headerIcon, { backgroundColor: colors.primary }]}>
            <Feather name="message-circle" size={18} color="#FFFFFF" />
          </View>
          <View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>AI suhbati</Text>
            <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
              Dieta yordamchisi
            </Text>
          </View>
        </View>
        {messages.length > 0 ? (
          <Pressable
            onPress={clear}
            style={({ pressed }) => [
              styles.clearBtn,
              { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Feather name="trash-2" size={14} color={colors.mutedForeground} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          isEmpty ? { flex: 1, justifyContent: "center" } : null,
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {isEmpty ? (
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.secondary }]}>
              <Feather name="zap" size={28} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              Salom! Men sizning dieta yordamchingizman
            </Text>
            <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
              Ovqatlanish, kaloriya va sog'lom turmush haqida har qanday savol bering
            </Text>
            <View style={styles.suggestions}>
              {SUGGESTIONS.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => { void send(s); }}
                  style={({ pressed }) => [
                    styles.suggestion,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <Feather name="message-square" size={14} color={colors.primary} />
                  <Text style={[styles.suggestionText, { color: colors.text }]} numberOfLines={2}>
                    {s}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          messages.map((m) => (
            <View
              key={m.id}
              style={[
                styles.bubbleRow,
                m.role === "user" ? styles.bubbleRowEnd : styles.bubbleRowStart,
              ]}
            >
              {m.role === "assistant" ? (
                <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                  <Feather name="zap" size={14} color="#FFFFFF" />
                </View>
              ) : null}
              <View
                style={[
                  styles.bubble,
                  m.role === "user"
                    ? { backgroundColor: colors.primary, borderBottomRightRadius: 4 }
                    : {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                        borderWidth: 1,
                        borderBottomLeftRadius: 4,
                      },
                ]}
              >
                <Text
                  style={[
                    styles.bubbleText,
                    { color: m.role === "user" ? "#FFFFFF" : colors.text },
                  ]}
                >
                  {m.role === "assistant" ? cleanMarkdown(m.content) : m.content}
                </Text>
              </View>
            </View>
          ))
        )}

        {loading ? (
          <View style={[styles.bubbleRow, styles.bubbleRowStart]}>
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              <Feather name="zap" size={14} color="#FFFFFF" />
            </View>
            <View
              style={[
                styles.bubble,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderBottomLeftRadius: 4,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                },
              ]}
            >
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.bubbleText, { color: colors.mutedForeground }]}>
                O'ylayapman...
              </Text>
            </View>
          </View>
        ) : null}

        {error ? (
          <View style={[styles.errorBox, { backgroundColor: "#FEE2E2", borderColor: "#FCA5A5" }]}>
            <Feather name="alert-circle" size={16} color="#DC2626" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>

      <View
        style={[
          styles.inputBar,
          {
            backgroundColor: colors.background,
            borderColor: colors.border,
            paddingBottom: inputBottomPad,
          },
        ]}
      >
        <View
          style={[
            styles.inputWrap,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Savolingizni yozing..."
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { color: colors.text }]}
            multiline
            maxLength={2000}
            editable={!loading}
            onSubmitEditing={() => { void send(input); }}
            returnKeyType="send"
          />
          <Pressable
            onPress={() => { void send(input); }}
            disabled={loading || input.trim().length === 0}
            style={({ pressed }) => [
              styles.sendBtn,
              {
                backgroundColor:
                  input.trim().length > 0 && !loading ? colors.primary : colors.mutedForeground,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Feather name="send" size={18} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  headerSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  clearBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 10, paddingBottom: 20 },
  empty: { alignItems: "center", gap: 10, paddingHorizontal: 12 },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  emptySub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 19,
    maxWidth: 300,
    marginBottom: 14,
  },
  suggestions: { width: "100%", gap: 8, marginTop: 4 },
  suggestion: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  suggestionText: { fontSize: 13.5, fontFamily: "Inter_500Medium", flex: 1 },
  bubbleRow: { flexDirection: "row", gap: 8, alignItems: "flex-end" },
  bubbleRowStart: { justifyContent: "flex-start" },
  bubbleRowEnd: { justifyContent: "flex-end" },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: "80%",
  },
  bubbleText: { fontSize: 14.5, fontFamily: "Inter_400Regular", lineHeight: 20 },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  errorText: { color: "#991B1B", fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 },
  inputBar: {
    paddingHorizontal: 14,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "flex-end",
    borderWidth: 1,
    borderRadius: 24,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
    gap: 8,
    minHeight: 48,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    paddingTop: Platform.OS === "ios" ? 8 : 4,
    paddingBottom: 6,
    maxHeight: 120,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
});
