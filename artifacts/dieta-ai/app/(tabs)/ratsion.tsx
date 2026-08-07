import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { SuccessToast } from "@/components/SuccessToast";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "https://dietaai-lexhk.ondigitalocean.app";

type DietKey = "national" | "diet" | "vegetarian" | "sport";
interface PlanMeal {
  meal: string;
  name: string;
  emoji: string;
  portion: string;
  cal: number;
  protein: number;
  carbs: number;
  fat: number;
  ingredients?: string[];
  tips?: string;
}
interface PlanResponse {
  national: PlanMeal[];
  diet: PlanMeal[];
  vegetarian: PlanMeal[];
  sport: PlanMeal[];
}
const DIET_TABS: { key: DietKey; label: string; emoji: string }[] = [
  { key: "national", label: "Milliy", emoji: "🍚" },
  { key: "diet", label: "Dietik", emoji: "🥗" },
  { key: "vegetarian", label: "Vegetarian", emoji: "🥦" },
  { key: "sport", label: "Sport", emoji: "💪" },
];

function MealDetailModal({
  meal,
  visible,
  onClose,
  onAdd,
  colors,
}: {
  meal: PlanMeal | null;
  visible: boolean;
  onClose: () => void;
  onAdd: (m: PlanMeal) => void;
  colors: ReturnType<typeof useColors>;
}) {
  const insets = useSafeAreaInsets();
  if (!meal) return null;
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={detailStyles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            detailStyles.sheet,
            {
              backgroundColor: colors.card,
              paddingBottom: Math.max(insets.bottom + 16, 28),
            },
          ]}
          onPress={() => {}}
        >
          <View style={[detailStyles.handle, { backgroundColor: colors.border }]} />

          <View style={detailStyles.emojiWrap}>
            <View style={[detailStyles.emojiCircle, { backgroundColor: colors.secondary }]}>
              <Text style={detailStyles.emoji}>{meal.emoji}</Text>
            </View>
            <View style={[detailStyles.mealTypeTag, { backgroundColor: colors.secondary }]}>
              <Text style={[detailStyles.mealTypeText, { color: colors.primary }]}>
                {meal.meal.toUpperCase()}
              </Text>
            </View>
          </View>

          <Text style={[detailStyles.name, { color: colors.text }]}>{meal.name}</Text>
          <Text style={[detailStyles.portion, { color: colors.mutedForeground }]}>{meal.portion}</Text>

          <View style={[detailStyles.macroCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <View style={detailStyles.macroItem}>
              <Text style={[detailStyles.macroVal, { color: colors.primary }]}>{meal.cal}</Text>
              <Text style={[detailStyles.macroLabel, { color: colors.mutedForeground }]}>kkal</Text>
            </View>
            <View style={[detailStyles.macroDivider, { backgroundColor: colors.border }]} />
            <View style={detailStyles.macroItem}>
              <Text style={[detailStyles.macroVal, { color: "#EF4444" }]}>{meal.protein}g</Text>
              <Text style={[detailStyles.macroLabel, { color: colors.mutedForeground }]}>Oqsil</Text>
            </View>
            <View style={[detailStyles.macroDivider, { backgroundColor: colors.border }]} />
            <View style={detailStyles.macroItem}>
              <Text style={[detailStyles.macroVal, { color: colors.accent }]}>{meal.carbs}g</Text>
              <Text style={[detailStyles.macroLabel, { color: colors.mutedForeground }]}>Uglevod</Text>
            </View>
            <View style={[detailStyles.macroDivider, { backgroundColor: colors.border }]} />
            <View style={detailStyles.macroItem}>
              <Text style={[detailStyles.macroVal, { color: "#3B82F6" }]}>{meal.fat}g</Text>
              <Text style={[detailStyles.macroLabel, { color: colors.mutedForeground }]}>Yog'</Text>
            </View>
          </View>

          {meal.ingredients && meal.ingredients.length > 0 ? (
            <View style={detailStyles.section}>
              <View style={detailStyles.sectionHeader}>
                <Feather name="list" size={15} color={colors.primary} />
                <Text style={[detailStyles.sectionTitle, { color: colors.text }]}>Tarkibi</Text>
              </View>
              <View style={[detailStyles.ingredientBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                {meal.ingredients.map((ing, i) => (
                  <View key={i} style={detailStyles.ingredientRow}>
                    <View style={[detailStyles.dot, { backgroundColor: colors.primary }]} />
                    <Text style={[detailStyles.ingredientText, { color: colors.text }]}>{ing}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {meal.tips ? (
            <View style={detailStyles.section}>
              <View style={detailStyles.sectionHeader}>
                <Feather name="info" size={15} color={colors.primary} />
                <Text style={[detailStyles.sectionTitle, { color: colors.text }]}>Tayyorlash</Text>
              </View>
              <View style={[detailStyles.tipsBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Text style={[detailStyles.tipsText, { color: colors.text }]}>{meal.tips}</Text>
              </View>
            </View>
          ) : null}

          <View style={detailStyles.btnRow}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                detailStyles.closeBtn,
                { backgroundColor: colors.secondary, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={[detailStyles.closeBtnText, { color: colors.text }]}>Yopish</Text>
            </Pressable>
            <Pressable
              onPress={() => { onAdd(meal); onClose(); }}
              style={({ pressed }) => [
                detailStyles.addBtn,
                { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Feather name="plus" size={16} color="#FFFFFF" />
              <Text style={detailStyles.addBtnText}>Kundalikka qo'shish</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function RatsionScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, addEntries } = useApp();

  const [activeDiet, setActiveDiet] = useState<DietKey>("national");
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState<PlanMeal | null>(null);
  // Bitta taomni almashtirilayotganini ko'rsatish uchun (per-meal spinner)
  const [regenIdx, setRegenIdx] = useState<number | null>(null);
  const lastKeyRef = useRef<string>("");
  // Yaqinda berilgan taom nomlari (har 4 ratsion uchun alohida) — keyingi
  // generatsiyada AI shu nomlardan qaytarmasin.
  const recentNamesRef = useRef<Record<DietKey, string[]>>({
    national: [],
    diet: [],
    vegetarian: [],
    sport: [],
  });

  const RECENT_KEY = "ratsion_recent_names";
  const MAX_RECENT = 12; // har ratsion turi uchun saqlanadigan maksimum

  const pushRecentNames = (names: Partial<Record<DietKey, string[]>>) => {
    const merged = { ...recentNamesRef.current };
    for (const k of Object.keys(names) as DietKey[]) {
      const incoming = (names[k] ?? []).filter((s) => s && s.trim().length > 0);
      if (incoming.length === 0) continue;
      // Yangi nomlar oldinga, eskilari orqada — duplikatlar olib tashlanadi.
      const combined = [...incoming, ...merged[k]];
      const seen = new Set<string>();
      const dedup: string[] = [];
      for (const n of combined) {
        const key = n.toLowerCase().trim();
        if (seen.has(key)) continue;
        seen.add(key);
        dedup.push(n);
        if (dedup.length >= MAX_RECENT) break;
      }
      merged[k] = dedup;
    }
    recentNamesRef.current = merged;
    AsyncStorage.setItem(RECENT_KEY, JSON.stringify(merged)).catch(() => {});
  };

  useEffect(() => {
    (async () => {
      try {
        const recRaw = await AsyncStorage.getItem(RECENT_KEY);
        if (recRaw) {
          const obj = JSON.parse(recRaw) as Partial<Record<DietKey, string[]>>;
          recentNamesRef.current = {
            national: Array.isArray(obj.national) ? obj.national.slice(0, MAX_RECENT) : [],
            diet: Array.isArray(obj.diet) ? obj.diet.slice(0, MAX_RECENT) : [],
            vegetarian: Array.isArray(obj.vegetarian) ? obj.vegetarian.slice(0, MAX_RECENT) : [],
            sport: Array.isArray(obj.sport) ? obj.sport.slice(0, MAX_RECENT) : [],
          };
        }
      } catch {}
      try {
        const cached = await AsyncStorage.getItem("ratsion_plan");
        if (cached) {
          const obj = JSON.parse(cached) as { profileKey: string; plan: PlanResponse };
          if (obj && obj.plan) {
            const allMeals = [
              ...(obj.plan.national ?? []),
              ...(obj.plan.diet ?? []),
              ...(obj.plan.vegetarian ?? []),
              ...(obj.plan.sport ?? []),
            ];
            const hasValidCals = allMeals.some(
              (m) => Number.isFinite(m.cal) && m.cal > 0
            );
            if (hasValidCals) {
              setPlan(obj.plan);
              lastKeyRef.current = obj.profileKey ?? "";
            } else {
              await AsyncStorage.removeItem("ratsion_plan");
            }
          }
        }
      } catch {}
      setHydrated(true);
    })();
  }, []);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 100 : insets.bottom + 90;

  const profileKey = useMemo(() => {
    return [
      profile.gender ?? "",
      profile.currentWeight ?? "",
      profile.targetWeight ?? "",
      profile.speedKgPerWeek ?? "",
      profile.goal ?? "",
      profile.dailyCalories ?? "",
      profile.protein ?? "",
      profile.mealsPerDay ?? "",
    ].join("|");
  }, [profile]);

  const buildProfilePayload = () => {
    const age = profile.birthDate
      ? new Date().getFullYear() - profile.birthDate.year
      : undefined;
    return {
      gender: profile.gender,
      age,
      heightCm: profile.height,
      currentWeight: profile.currentWeight,
      targetWeight: profile.targetWeight,
      speedKgPerWeek: profile.speedKgPerWeek,
      goal: profile.goal,
      dailyCalories: profile.dailyCalories,
      protein: profile.protein,
      carbs: profile.carbs,
      fat: profile.fat,
      mealsPerDay: profile.mealsPerDay,
    };
  };

  const fetchPlan = async (regenerate = false) => {
    setLoading(true);
    setError(null);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 60_000);
    try {
      // Yangi reja so'ralganda — har bir ratsion turi bo'yicha oxirgi 3 ta
      // taom nomini AI'ga yuboramiz, takrorlanmasin uchun.
      const excludeNames: string[] = [];
      if (regenerate) {
        for (const k of ["national", "diet", "vegetarian", "sport"] as DietKey[]) {
          excludeNames.push(...recentNamesRef.current[k].slice(0, 3));
        }
      }
      const res = await fetch(`${API_BASE}/api/ai/meal-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: buildProfilePayload(),
          regenerate,
          excludeNames,
        }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as PlanResponse;
      setPlan(data);
      lastKeyRef.current = profileKey;
      // Yangi reja taomlarini "recent" ro'yxatga qo'shish
      pushRecentNames({
        national: (data.national ?? []).map((m) => m.name),
        diet: (data.diet ?? []).map((m) => m.name),
        vegetarian: (data.vegetarian ?? []).map((m) => m.name),
        sport: (data.sport ?? []).map((m) => m.name),
      });
      AsyncStorage.setItem(
        "ratsion_plan",
        JSON.stringify({ profileKey, plan: data }),
      ).catch(() => {});
    } catch (err) {
      const isAbort = (err as { name?: string })?.name === "AbortError";
      setError(
        isAbort
          ? "AI javob bermadi (vaqt tugadi). Qaytadan urining."
          : "Ovqat rejasi tuzilmadi. Qaytadan urining.",
      );
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  };

  const handleRegenerate = () => {
    AsyncStorage.removeItem("ratsion_plan").catch(() => {});
    lastKeyRef.current = "";
    fetchPlan(true);
  };

  // Bitta taomni butunlay boshqasi bilan almashtirish — ratsion turi va
  // ovqat vaqtini saqlab, kaloriyasi shu atrofida bo'lgan boshqa taom
  // qaytariladi.
  const regenerateOneMeal = async (idx: number) => {
    if (!plan) return;
    const current = plan[activeDiet]?.[idx];
    if (!current) return;
    setRegenIdx(idx);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 35_000);
    try {
      const exclude = [
        current.name,
        ...recentNamesRef.current[activeDiet].slice(0, 5),
      ];
      const res = await fetch(`${API_BASE}/api/ai/meal-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: buildProfilePayload(),
          alternativeFor: current.name,
          dietKey: activeDiet,
          mealLabel: current.meal,
          targetCal: current.cal,
          excludeNames: exclude,
        }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { meal?: PlanMeal };
      if (!data?.meal) throw new Error("empty");

      const newMeals = [...plan[activeDiet]];
      newMeals[idx] = data.meal;
      const newPlan: PlanResponse = { ...plan, [activeDiet]: newMeals };
      setPlan(newPlan);
      pushRecentNames({ [activeDiet]: [data.meal.name] });
      AsyncStorage.setItem(
        "ratsion_plan",
        JSON.stringify({ profileKey, plan: newPlan }),
      ).catch(() => {});
    } catch {
      setToast({ visible: true, message: "Almashtirib bo'lmadi. Qayta urining." });
    } finally {
      clearTimeout(timer);
      setRegenIdx(null);
    }
  };

  useEffect(() => {
    if (!hydrated) return;
    if (plan && lastKeyRef.current === profileKey) return;
    fetchPlan(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileKey, hydrated]);

  const handleAddMeal = (m: PlanMeal) => {
    addEntries([
      {
        name: m.name,
        cal: m.cal,
        protein: m.protein,
        carbs: m.carbs,
        fat: m.fat,
        source: "plan",
      },
    ]);
    setToast({
      visible: true,
      message: `${m.name} qo'shildi · +${Math.round(m.cal)} kkal`,
    });
  };

  const [toast, setToast] = useState<{ visible: boolean; message: string }>({
    visible: false,
    message: "",
  });

  const meals = plan ? plan[activeDiet] : [];
  const totalCal = meals.reduce((s, m) => s + (Number.isFinite(m.cal) ? m.cal : 0), 0);
  const totalProtein = meals.reduce((s, m) => s + (Number.isFinite(m.protein) ? m.protein : 0), 0);
  const totalCarbs = meals.reduce((s, m) => s + (Number.isFinite(m.carbs) ? m.carbs : 0), 0);
  const totalFat = meals.reduce((s, m) => s + (Number.isFinite(m.fat) ? m.fat : 0), 0);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: topPad + 8,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.text }]}>Sizning ovqat rejangiz</Text>
            <Text
              style={[styles.subtitle, { color: colors.mutedForeground }]}
              numberOfLines={1}
            >
              Profilingiz bo'yicha AI tomonidan tuzildi
            </Text>
          </View>
          <Pressable
            onPress={handleRegenerate}
            hitSlop={10}
            disabled={loading}
            accessibilityLabel="Yangi reja tuzish"
            style={({ pressed }) => [
              styles.refreshBtn,
              {
                backgroundColor: colors.primary,
                opacity: loading ? 0.5 : pressed ? 0.7 : 1,
              },
            ]}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : (
              <Feather name="refresh-cw" size={18} color={colors.primaryForeground} />
            )}
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingTop: 12 }}
        >
          {DIET_TABS.map((d) => {
            const active = activeDiet === d.key;
            return (
              <Pressable
                key={d.key}
                onPress={() => setActiveDiet(d.key)}
                style={({ pressed }) => [
                  styles.dietChip,
                  {
                    backgroundColor: active ? colors.primary : colors.secondary,
                    borderColor: active ? colors.primary : colors.border,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Text style={{ fontSize: 14 }}>{d.emoji}</Text>
                <Text
                  style={{
                    fontSize: 13,
                    fontFamily: active ? "Inter_600SemiBold" : "Inter_500Medium",
                    color: active ? colors.primaryForeground : colors.text,
                  }}
                >
                  {d.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.centerText, { color: colors.mutedForeground }]}>
              AI sizning profilingiz bo'yicha ovqat rejasini tuzmoqda...
            </Text>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Feather name="alert-circle" size={36} color={colors.destructive} />
            <Text style={[styles.centerText, { color: colors.destructive }]}>{error}</Text>
            <Pressable
              onPress={() => fetchPlan(false)}
              style={({ pressed }) => [
                styles.retryBtn,
                { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text
                style={{ color: colors.primaryForeground, fontSize: 14, fontFamily: "Inter_600SemiBold" }}
              >
                Qayta urinish
              </Text>
            </Pressable>
          </View>
        ) : meals.length === 0 ? (
          <View style={styles.center}>
            <Text style={[styles.centerText, { color: colors.mutedForeground }]}>
              Bu ovqat rejasi uchun taomlar topilmadi
            </Text>
          </View>
        ) : (
          <>
            <View
              style={[
                styles.summary,
                { backgroundColor: colors.secondary, borderColor: colors.border },
              ]}
            >
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Jami</Text>
                <Text style={[styles.summaryVal, { color: colors.primary }]}>{totalCal}</Text>
                <Text style={[styles.summaryUnit, { color: colors.mutedForeground }]}>kkal</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>B</Text>
                <Text style={[styles.summaryVal, { color: colors.chartRed }]}>{totalProtein}g</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>U</Text>
                <Text style={[styles.summaryVal, { color: colors.accent }]}>{totalCarbs}g</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Y</Text>
                <Text style={[styles.summaryVal, { color: "#3B82F6" }]}>{totalFat}g</Text>
              </View>
            </View>

            {meals.map((m, idx) => (
              <Pressable
                key={`${m.meal}-${idx}`}
                onPress={() => setSelectedMeal(m)}
                style={({ pressed }) => [
                  styles.meal,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    opacity: pressed ? 0.92 : 1,
                  },
                ]}
              >
                <Text style={[styles.mealLabel, { color: colors.primary }]}>{m.meal}</Text>
                <View style={styles.mealRow}>
                  <View style={[styles.mealIcon, { backgroundColor: colors.secondary }]}>
                    <Text style={{ fontSize: 22 }}>{m.emoji}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.mealName, { color: colors.text }]}>{m.name}</Text>
                    <Text style={[styles.mealPortion, { color: colors.mutedForeground }]}>
                      {m.portion}{Number.isFinite(m.cal) && m.cal > 0 ? ` · ${m.cal} kkal` : ""}
                    </Text>
                    <View style={styles.macroRow}>
                      <Text style={[styles.macroTag, { color: colors.chartRed }]}>
                        B: {m.protein}g
                      </Text>
                      <Text style={[styles.macroTag, { color: colors.accent }]}>
                        U: {m.carbs}g
                      </Text>
                      <Text style={[styles.macroTag, { color: "#3B82F6" }]}>Y: {m.fat}g</Text>
                    </View>
                  </View>
                  <View style={styles.cardActions}>
                    <Pressable
                      onPress={(e) => { e.stopPropagation(); regenerateOneMeal(idx); }}
                      hitSlop={6}
                      disabled={regenIdx !== null}
                      accessibilityLabel="Bu taomni almashtirish"
                      style={({ pressed }) => [
                        styles.swapBtn,
                        {
                          backgroundColor: colors.secondary,
                          borderColor: colors.border,
                          opacity: regenIdx !== null && regenIdx !== idx
                            ? 0.4
                            : pressed
                              ? 0.7
                              : 1,
                        },
                      ]}
                    >
                      {regenIdx === idx ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <Feather name="refresh-cw" size={16} color={colors.primary} />
                      )}
                    </Pressable>
                    <Pressable
                      onPress={(e) => { e.stopPropagation(); handleAddMeal(m); }}
                      hitSlop={6}
                      style={({ pressed }) => [
                        styles.addBtn,
                        { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
                      ]}
                    >
                      <Feather name="plus" size={20} color={colors.primaryForeground} />
                    </Pressable>
                  </View>
                </View>
              </Pressable>
            ))}
          </>
        )}
      </ScrollView>

      <MealDetailModal
        meal={selectedMeal}
        visible={selectedMeal !== null}
        onClose={() => setSelectedMeal(null)}
        onAdd={handleAddMeal}
        colors={colors}
      />

      <SuccessToast
        visible={toast.visible}
        message={toast.message}
        onHide={() => setToast({ visible: false, message: "" })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { fontSize: 20, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  dietChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
  },
  center: { alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 16 },
  centerText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
    paddingHorizontal: 20,
  },
  retryBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 18,
    marginTop: 6,
  },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryDivider: { width: 1, height: 32, backgroundColor: "rgba(0,0,0,0.08)" },
  summaryLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },
  summaryVal: { fontSize: 17, fontFamily: "Inter_700Bold", marginTop: 2 },
  summaryUnit: { fontSize: 10, fontFamily: "Inter_400Regular" },
  meal: { borderRadius: 14, borderWidth: 1.5, padding: 12, marginBottom: 10 },
  mealLabel: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  mealRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  mealIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  mealName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  mealPortion: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  macroRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  macroTag: { fontSize: 11, fontFamily: "Inter_500Medium" },
  cardActions: { flexDirection: "column", alignItems: "center", gap: 8 },
  swapBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});

const detailStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: "90%",
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  emojiWrap: {
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  emojiCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  emoji: { fontSize: 36 },
  mealTypeTag: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  mealTypeText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.8,
  },
  name: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    marginBottom: 4,
  },
  portion: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginBottom: 16,
  },
  macroCard: {
    flexDirection: "row",
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
    gap: 4,
  },
  macroItem: { flex: 1, alignItems: "center", gap: 2 },
  macroVal: { fontSize: 18, fontFamily: "Inter_700Bold" },
  macroLabel: { fontSize: 10, fontFamily: "Inter_500Medium" },
  macroDivider: { width: 1, marginHorizontal: 4 },
  section: { marginBottom: 14 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  ingredientBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 6,
  },
  ingredientRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  ingredientText: {
    fontSize: 13.5,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  tipsBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  tipsText: {
    fontSize: 13.5,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  btnRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
  },
  closeBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  addBtn: {
    flex: 2,
    height: 48,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  addBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
});
