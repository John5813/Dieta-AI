import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import {
  CATEGORIES,
  FOOD_DB,
  type FoodCategory,
  type FoodItem,
} from "@/lib/foodDatabase";

type Tab = "all" | FoodCategory;

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

export default function FoodScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, addEntries } = useApp();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [added, setAdded] = useState<string[]>([]);
  const [selected, setSelected] = useState<FoodItem | null>(null);
  const [planOpen, setPlanOpen] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 100 : insets.bottom + 80;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FOOD_DB.filter((f) => {
      if (tab !== "all" && f.category !== tab) return false;
      if (!q) return true;
      return f.name.toLowerCase().includes(q);
    });
  }, [query, tab]);

  const toggleAdd = (id: string) => {
    setAdded((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const confirmAddSelected = () => {
    const items = FOOD_DB.filter((f) => added.includes(f.id));
    if (items.length === 0) return;
    addEntries(
      items.map((it) => ({
        name: it.name,
        cal: it.cal,
        protein: it.protein,
        carbs: it.carbs,
        fat: it.fat,
        source: "catalog" as const,
      })),
    );
    setAdded([]);
    setSelected(null);
  };

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
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.text }]}>Ovqatlar</Text>
          <Pressable
            onPress={() => setPlanOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="AI ovqat rejasi"
            style={({ pressed }) => [
              styles.aiPlanBtn,
              {
                backgroundColor: colors.primary,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <MaterialCommunityIcons
              name="silverware-fork-knife"
              size={18}
              color={colors.primaryForeground}
            />
            <Text style={[styles.aiPlanText, { color: colors.primaryForeground }]}>
              AI Ovqat rejasi
            </Text>
          </Pressable>
        </View>

        <View
          style={[
            styles.searchBar,
            { backgroundColor: colors.input, borderColor: colors.border },
          ]}
        >
          <Feather name="search" size={18} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Taom yoki ichimlik qidiring..."
            placeholderTextColor={colors.mutedForeground}
            value={query}
            onChangeText={setQuery}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery("")}>
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsRow}
        >
          <CategoryChip
            label="Hammasi"
            emoji="🍽️"
            active={tab === "all"}
            onPress={() => setTab("all")}
            colors={colors}
          />
          {CATEGORIES.map((c) => (
            <CategoryChip
              key={c.id}
              label={c.label}
              emoji={c.emoji}
              active={tab === c.id}
              onPress={() => setTab(c.id)}
              colors={colors}
            />
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: bottomPad + (added.length > 0 ? 80 : 0),
          paddingTop: 12,
        }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const isAdded = added.includes(item.id);
          return (
            <Pressable
              onPress={() => setSelected(item)}
              style={({ pressed }) => [
                styles.foodCard,
                {
                  backgroundColor: colors.card,
                  borderColor: isAdded ? colors.primary : colors.border,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <View
                style={[
                  styles.foodIcon,
                  { backgroundColor: colors.secondary },
                ]}
              >
                <Text style={styles.foodEmoji}>{item.emoji}</Text>
              </View>
              <View style={styles.foodDetails}>
                <Text
                  style={[styles.foodName, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
                <Text
                  style={[styles.foodPortion, { color: colors.mutedForeground }]}
                  numberOfLines={1}
                >
                  {item.portion} · {item.cal} kal
                </Text>
                <View style={styles.macroRow}>
                  <Text style={[styles.macroTag, { color: colors.chartRed }]}>
                    B: {item.protein}g
                  </Text>
                  <Text style={[styles.macroTag, { color: colors.accent }]}>
                    U: {item.carbs}g
                  </Text>
                  <Text style={[styles.macroTag, { color: "#3B82F6" }]}>
                    Y: {item.fat}g
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  toggleAdd(item.id);
                }}
                hitSlop={6}
                style={({ pressed }) => [
                  styles.addBtn,
                  {
                    backgroundColor: isAdded ? colors.primary : colors.secondary,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Feather
                  name={isAdded ? "check" : "plus"}
                  size={20}
                  color={isAdded ? colors.primaryForeground : colors.primary}
                />
              </Pressable>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="search" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Hech narsa topilmadi
            </Text>
          </View>
        }
      />

      {selected ? (
        <DetailSheet
          item={selected}
          isAdded={added.includes(selected.id)}
          onToggle={() => {
            toggleAdd(selected.id);
          }}
          onClose={() => setSelected(null)}
          colors={colors}
        />
      ) : null}

      {added.length > 0 && (
        <View
          style={[
            styles.confirmBar,
            {
              bottom: insets.bottom + (Platform.OS === "web" ? 92 : 76),
              backgroundColor: colors.background,
              borderTopColor: colors.border,
              paddingHorizontal: 20,
            },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.confirmCount, { color: colors.text }]}>
              {added.length} ta tanlandi
            </Text>
            <Text style={[styles.confirmHint, { color: colors.mutedForeground }]}>
              Bugungi kunlik diary ga qo'shing
            </Text>
          </View>
          <Pressable
            onPress={confirmAddSelected}
            style={({ pressed }) => [
              styles.confirmGoBtn,
              { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Feather name="check" size={18} color={colors.primaryForeground} />
            <Text
              style={[styles.confirmGoText, { color: colors.primaryForeground }]}
            >
              Qo'shish
            </Text>
          </Pressable>
        </View>
      )}

      <MealPlanModal
        visible={planOpen}
        onClose={() => setPlanOpen(false)}
        profile={profile}
        colors={colors}
        onAddMeal={(m) =>
          addEntries([
            {
              name: m.name,
              cal: m.cal,
              protein: m.protein,
              carbs: m.carbs,
              fat: m.fat,
              source: "plan",
            },
          ])
        }
      />
    </View>
  );
}

function CategoryChip({
  label,
  emoji,
  active,
  onPress,
  colors,
}: {
  label: string;
  emoji: string;
  active: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: active ? colors.primary : colors.secondary,
          borderColor: active ? colors.primary : colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Text style={styles.chipEmoji}>{emoji}</Text>
      <Text
        style={[
          styles.chipLabel,
          {
            color: active ? colors.primaryForeground : colors.text,
            fontFamily: active ? "Inter_600SemiBold" : "Inter_500Medium",
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function DetailSheet({
  item,
  isAdded,
  onToggle,
  onClose,
  colors,
}: {
  item: FoodItem;
  isAdded: boolean;
  onToggle: () => void;
  onClose: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <Pressable style={styles.backdrop} onPress={onClose}>
      <Pressable style={[styles.sheet, { backgroundColor: colors.card }]} onPress={() => {}}>
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
        <View style={styles.detailHead}>
          <View style={[styles.detailIcon, { backgroundColor: colors.secondary }]}>
            <Text style={styles.detailEmoji}>{item.emoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.detailName, { color: colors.text }]}>{item.name}</Text>
            <Text style={[styles.detailPortion, { color: colors.mutedForeground }]}>
              {item.portion}
            </Text>
          </View>
        </View>

        <View style={[styles.calBlock, { backgroundColor: colors.secondary }]}>
          <Text style={[styles.calValue, { color: colors.primary }]}>{item.cal}</Text>
          <Text style={[styles.calLabel, { color: colors.mutedForeground }]}>kkal</Text>
        </View>

        <View style={styles.macroBlocks}>
          <MacroBlock label="Oqsil" value={item.protein} color={colors.chartRed} />
          <MacroBlock label="Uglevod" value={item.carbs} color={colors.accent} />
          <MacroBlock label="Yog'" value={item.fat} color="#3B82F6" />
        </View>

        <Pressable
          onPress={() => {
            onToggle();
            onClose();
          }}
          style={({ pressed }) => [
            styles.confirmBtn,
            {
              backgroundColor: isAdded ? colors.destructive : colors.primary,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Feather
            name={isAdded ? "x" : "check"}
            size={20}
            color="#FFFFFF"
          />
          <Text style={styles.confirmText}>
            {isAdded ? "Tanlovdan olib tashlash" : "Tanlash"}
          </Text>
        </Pressable>

        <Pressable onPress={onClose} style={styles.cancelBtn}>
          <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>
            Bekor
          </Text>
        </Pressable>
      </Pressable>
    </Pressable>
  );
}

function MacroBlock({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <View style={[styles.macroBlock, { borderColor: color }]}>
      <Text style={[styles.macroBlockValue, { color }]}>{value}g</Text>
      <Text style={styles.macroBlockLabel}>{label}</Text>
    </View>
  );
}

function MealPlanModal({
  visible,
  onClose,
  profile,
  colors,
  onAddMeal,
}: {
  visible: boolean;
  onClose: () => void;
  profile: ReturnType<typeof useApp>["profile"];
  colors: ReturnType<typeof useColors>;
  onAddMeal: (m: PlanMeal) => void;
}) {
  const insets = useSafeAreaInsets();
  const [activeDiet, setActiveDiet] = useState<DietKey>("national");
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastKeyRef = useRef<string>("");

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

  const fetchPlan = async () => {
    setLoading(true);
    setError(null);
    try {
      const age = profile.birthDate
        ? new Date().getFullYear() - profile.birthDate.year
        : undefined;
      const res = await fetch(`${API_BASE}/api/ai/meal-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: {
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
          },
        }),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as PlanResponse;
      setPlan(data);
      lastKeyRef.current = profileKey;
    } catch {
      setError("Ovqat rejasi tuzilmadi. Qaytadan urining.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!visible) return;
    if (plan && lastKeyRef.current === profileKey) return;
    fetchPlan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, profileKey]);

  if (!visible) return null;

  const meals = plan ? plan[activeDiet] : [];
  const totalCal = meals.reduce((s, m) => s + (Number.isFinite(m.cal) ? m.cal : 0), 0);
  const totalProtein = meals.reduce((s, m) => s + (Number.isFinite(m.protein) ? m.protein : 0), 0);
  const totalCarbs = meals.reduce((s, m) => s + (Number.isFinite(m.carbs) ? m.carbs : 0), 0);
  const totalFat = meals.reduce((s, m) => s + (Number.isFinite(m.fat) ? m.fat : 0), 0);

  return (
    <View style={styles.planRoot}>
      <View
        style={[
          styles.planHeader,
          {
            paddingTop: (Platform.OS === "web" ? 16 : insets.top) + 8,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Pressable onPress={onClose} hitSlop={10} style={styles.planClose}>
          <Feather name="x" size={24} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.planTitle, { color: colors.text }]}>
            Sizning kunlik ovqat rejangiz
          </Text>
          <Text
            style={[styles.planSub, { color: colors.mutedForeground }]}
            numberOfLines={1}
          >
            Holatingiz bo'yicha AI tomonidan tuzildi
          </Text>
        </View>
        <Pressable
          onPress={fetchPlan}
          hitSlop={10}
          style={({ pressed }) => [
            styles.planRefresh,
            { backgroundColor: colors.secondary, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Feather name="refresh-cw" size={18} color={colors.primary} />
        </Pressable>
      </View>

      <View
        style={{
          backgroundColor: colors.background,
          paddingVertical: 8,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}
        >
          {DIET_TABS.map((d) => (
            <CategoryChip
              key={d.key}
              label={d.label}
              emoji={d.emoji}
              active={activeDiet === d.key}
              onPress={() => setActiveDiet(d.key)}
              colors={colors}
            />
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{
          padding: 20,
          paddingBottom: insets.bottom + 32,
        }}
      >
        {loading ? (
          <View style={styles.planLoading}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.planLoadText, { color: colors.mutedForeground }]}>
              AI sizning profilingiz bo'yicha ovqat rejasini tuzmoqda...
            </Text>
          </View>
        ) : error ? (
          <View style={styles.planLoading}>
            <Feather name="alert-circle" size={36} color={colors.destructive} />
            <Text style={[styles.planLoadText, { color: colors.destructive }]}>
              {error}
            </Text>
            <Pressable
              onPress={fetchPlan}
              style={({ pressed }) => [
                styles.retryBtn,
                { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={[styles.retryText, { color: colors.primaryForeground }]}>
                Qayta urinish
              </Text>
            </Pressable>
          </View>
        ) : meals.length === 0 ? (
          <View style={styles.planLoading}>
            <Text style={[styles.planLoadText, { color: colors.mutedForeground }]}>
              Bu ovqat rejasi uchun taomlar topilmadi
            </Text>
          </View>
        ) : (
          <>
            <View
              style={[
                styles.planSummary,
                { backgroundColor: colors.secondary, borderColor: colors.border },
              ]}
            >
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>
                  Jami
                </Text>
                <Text style={[styles.summaryVal, { color: colors.primary }]}>
                  {totalCal}
                </Text>
                <Text style={[styles.summaryUnit, { color: colors.mutedForeground }]}>
                  kkal
                </Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>
                  B
                </Text>
                <Text style={[styles.summaryVal, { color: colors.chartRed }]}>
                  {totalProtein}g
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>
                  U
                </Text>
                <Text style={[styles.summaryVal, { color: colors.accent }]}>
                  {totalCarbs}g
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>
                  Y
                </Text>
                <Text style={[styles.summaryVal, { color: "#3B82F6" }]}>
                  {totalFat}g
                </Text>
              </View>
            </View>

            {meals.map((m, idx) => (
              <View
                key={`${m.meal}-${idx}`}
                style={[
                  styles.planMeal,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.planMealLabel, { color: colors.primary }]}>
                  {m.meal}
                </Text>
                <View style={styles.planMealRow}>
                  <View
                    style={[styles.planMealIcon, { backgroundColor: colors.secondary }]}
                  >
                    <Text style={styles.planMealEmoji}>{m.emoji}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.planMealName, { color: colors.text }]}>
                      {m.name}
                    </Text>
                    <Text
                      style={[
                        styles.planMealPortion,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      {m.portion} · {m.cal} kkal
                    </Text>
                    <View style={styles.macroRow}>
                      <Text style={[styles.macroTag, { color: colors.chartRed }]}>
                        B: {m.protein}g
                      </Text>
                      <Text style={[styles.macroTag, { color: colors.accent }]}>
                        U: {m.carbs}g
                      </Text>
                      <Text style={[styles.macroTag, { color: "#3B82F6" }]}>
                        Y: {m.fat}g
                      </Text>
                    </View>
                  </View>
                  <Pressable
                    onPress={() => onAddMeal(m)}
                    hitSlop={6}
                    style={({ pressed }) => [
                      styles.addBtn,
                      { backgroundColor: colors.secondary, opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    <Feather name="plus" size={18} color={colors.primary} />
                  </Pressable>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 8, borderBottomWidth: 1 },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  title: { fontSize: 22, fontFamily: "Inter_700Bold" },
  aiPlanBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
  },
  aiPlanText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    marginBottom: 10,
  },
  searchInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  tabsRow: { gap: 8, paddingVertical: 4, paddingRight: 12 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
  },
  chipEmoji: { fontSize: 14 },
  chipLabel: { fontSize: 13 },
  foodCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 12,
    marginBottom: 10,
    gap: 12,
  },
  foodIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  foodEmoji: { fontSize: 22 },
  foodDetails: { flex: 1 },
  foodName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  foodPortion: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  macroRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  macroTag: { fontSize: 11, fontFamily: "Inter_500Medium" },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: { alignItems: "center", gap: 12, paddingTop: 80 },
  emptyText: { fontSize: 16, fontFamily: "Inter_400Regular" },

  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,25,10,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "web" ? 110 : 100,
    gap: 14,
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: 6,
  },
  detailHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  detailIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  detailEmoji: { fontSize: 30 },
  detailName: { fontSize: 19, fontFamily: "Inter_700Bold" },
  detailPortion: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  calBlock: {
    borderRadius: 18,
    alignItems: "center",
    paddingVertical: 18,
    gap: 2,
  },
  calValue: { fontSize: 36, fontFamily: "Inter_700Bold" },
  calLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  macroBlocks: { flexDirection: "row", gap: 8 },
  macroBlock: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 2,
  },
  macroBlockValue: { fontSize: 17, fontFamily: "Inter_700Bold" },
  macroBlockLabel: { fontSize: 11, fontFamily: "Inter_500Medium", color: "#666" },
  confirmBtn: {
    flexDirection: "row",
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
  },
  confirmText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  cancelBtn: { alignSelf: "center", paddingVertical: 8 },
  cancelText: { fontSize: 14, fontFamily: "Inter_500Medium" },

  confirmBar: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  confirmCount: { fontSize: 15, fontFamily: "Inter_700Bold" },
  confirmHint: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  confirmGoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    height: 44,
    borderRadius: 22,
  },
  confirmGoText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },

  planRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
  planHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  planClose: { padding: 4 },
  planTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  planSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  planRefresh: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  planLoading: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    gap: 16,
  },
  planLoadText: {
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
  retryText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  planSummary: {
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
  planMeal: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 12,
    marginBottom: 10,
  },
  planMealLabel: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  planMealRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  planMealIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  planMealEmoji: { fontSize: 22 },
  planMealName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  planMealPortion: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
});
