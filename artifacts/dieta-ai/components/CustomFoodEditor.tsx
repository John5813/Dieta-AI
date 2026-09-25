import { Feather } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTracker, type CustomFood, type RecipeIngredient } from "@/context/TrackerContext";
import { useColors } from "@/hooks/useColors";
import { aiAnalyzeText } from "@/lib/api-client";
import { FOOD_DB } from "@/lib/foodDatabase";

const EMOJIS = ["🍲", "🍚", "🥗", "🍜", "🥟", "🍳", "🥘", "🍗", "🥩", "🐟", "🥞", "🍰", "🥤", "🍎"];

type Mode = "simple" | "recipe";

function num(text: string): number {
  const n = parseFloat(text.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}

function sum(list: RecipeIngredient[]) {
  return list.reduce(
    (t, i) => ({ cal: t.cal + i.cal, protein: t.protein + i.protein, carbs: t.carbs + i.carbs, fat: t.fat + i.fat }),
    { cal: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

/** Create or edit a user food: fixed numbers per portion, or a recipe built from ingredients. */
export function CustomFoodEditor({
  visible,
  food,
  onClose,
}: {
  visible: boolean;
  /** Existing food to edit; omit to create. */
  food?: CustomFood | null;
  onClose: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { saveCustomFood } = useTracker();

  const [mode, setMode] = useState<Mode>("simple");
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(EMOJIS[0]!);
  const [portion, setPortion] = useState("");
  const [cal, setCal] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [servings, setServings] = useState(1);
  const [ingText, setIngText] = useState("");
  const [ingBusy, setIngBusy] = useState(false);
  const [ingError, setIngError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setMode(food?.ingredients?.length ? "recipe" : "simple");
    setName(food?.name ?? "");
    setEmoji(food?.emoji ?? EMOJIS[0]!);
    setPortion(food?.portion ?? "");
    setCal(food ? String(food.cal) : "");
    setProtein(food ? String(food.protein) : "");
    setCarbs(food ? String(food.carbs) : "");
    setFat(food ? String(food.fat) : "");
    setIngredients(food?.ingredients ?? []);
    setServings(food?.servings ?? 1);
    setIngText("");
    setIngError(null);
  }, [visible, food]);

  // Catalog matches for what is being typed, so common items need no AI call.
  const matches = useMemo(() => {
    const q = ingText.trim().toLowerCase();
    if (q.length < 2) return [];
    return FOOD_DB.filter((f) => f.name.toLowerCase().includes(q)).slice(0, 4);
  }, [ingText]);

  const totals = sum(ingredients);
  const per = {
    cal: Math.round(totals.cal / servings),
    protein: Math.round(totals.protein / servings),
    carbs: Math.round(totals.carbs / servings),
    fat: Math.round(totals.fat / servings),
  };

  const simpleValid =
    [cal, protein, carbs, fat].every((v) => v.trim() === "" || Number.isFinite(num(v))) &&
    Number.isFinite(num(cal)) &&
    num(cal) > 0;
  const valid = name.trim().length > 0 && (mode === "simple" ? simpleValid : ingredients.length > 0);

  const addIngredientByAi = async () => {
    const text = ingText.trim();
    if (!text || ingBusy) return;
    setIngBusy(true);
    setIngError(null);
    try {
      const res = await aiAnalyzeText({ text });
      if (res.status !== "ok" || !res.calories) {
        setIngError(res.reason || "Aniqlab bo'lmadi. Masalan: \"200 g guruch\" deb yozing.");
        return;
      }
      setIngredients((prev) => [
        ...prev,
        {
          name: text,
          cal: Math.round(res.calories ?? 0),
          protein: Math.round(res.protein ?? 0),
          carbs: Math.round(res.carbs ?? 0),
          fat: Math.round(res.fat ?? 0),
        },
      ]);
      setIngText("");
    } catch {
      setIngError("Internet bilan bog'lanib bo'lmadi. Qaytadan urinib ko'ring.");
    } finally {
      setIngBusy(false);
    }
  };

  const save = () => {
    if (!valid) return;
    const base = { id: food?.id, name: name.trim(), emoji };
    if (mode === "simple") {
      saveCustomFood({
        ...base,
        portion: portion.trim() || "1 porsiya",
        cal: Math.round(num(cal)),
        protein: Math.round(num(protein) || 0),
        carbs: Math.round(num(carbs) || 0),
        fat: Math.round(num(fat) || 0),
      });
    } else {
      saveCustomFood({
        ...base,
        portion: portion.trim() || (servings > 1 ? `1 porsiya (1/${servings})` : "1 porsiya"),
        ...per,
        ingredients,
        servings,
      });
    }
    onClose();
  };

  const field = (label: string, value: string, set: (v: string) => void, unit: string) => (
    <View style={styles.cell}>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
      <View style={[styles.numBox, { backgroundColor: colors.input, borderColor: colors.border }]}>
        <TextInput
          value={value}
          onChangeText={set}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.numInput, { color: colors.text }]}
        />
        <Text style={[styles.unit, { color: colors.mutedForeground }]}>{unit}</Text>
      </View>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={[styles.flex1, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.header,
            { paddingTop: (Platform.OS === "web" ? 16 : insets.top) + 8, borderBottomColor: colors.border },
          ]}
        >
          <Pressable onPress={onClose} hitSlop={10} style={{ padding: 4 }}>
            <Feather name="x" size={24} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {food ? "Taomni tahrirlash" : "Yangi taom"}
          </Text>
          <View style={{ width: 32 }} />
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <View style={[styles.segment, { backgroundColor: colors.secondary }]}>
            {(["simple", "recipe"] as Mode[]).map((m) => {
              const on = m === mode;
              return (
                <Pressable
                  key={m}
                  onPress={() => setMode(m)}
                  style={[styles.segBtn, on && { backgroundColor: colors.card }]}
                >
                  <Text style={[styles.segText, { color: on ? colors.primary : colors.mutedForeground }]}>
                    {m === "simple" ? "Oddiy taom" : "Retsept (masalliqlardan)"}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.label, { color: colors.mutedForeground }]}>Nomi</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={mode === "recipe" ? "Masalan: Onamning palovi" : "Masalan: Ertalabki bo'tqa"}
            placeholderTextColor={colors.mutedForeground}
            maxLength={40}
            style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
          />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.emojiRow}>
            {EMOJIS.map((e) => (
              <Pressable
                key={e}
                onPress={() => setEmoji(e)}
                style={[
                  styles.emojiBtn,
                  { borderColor: e === emoji ? colors.primary : "transparent", backgroundColor: colors.card },
                ]}
              >
                <Text style={styles.emoji}>{e}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={[styles.label, { color: colors.mutedForeground }]}>Porsiya (ixtiyoriy)</Text>
          <TextInput
            value={portion}
            onChangeText={setPortion}
            placeholder={mode === "recipe" ? "1 likopcha" : "1 kosa (250 g)"}
            placeholderTextColor={colors.mutedForeground}
            maxLength={30}
            style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
          />

          {mode === "simple" ? (
            <>
              <Text style={[styles.section, { color: colors.text }]}>Bir porsiyadagi qiymat</Text>
              <View style={styles.grid}>
                {field("Kaloriya", cal, setCal, "kkal")}
                {field("Oqsil", protein, setProtein, "g")}
                {field("Uglevod", carbs, setCarbs, "g")}
                {field("Yog'", fat, setFat, "g")}
              </View>
            </>
          ) : (
            <>
              <Text style={[styles.section, { color: colors.text }]}>Masalliqlar</Text>
              <Text style={[styles.hint, { color: colors.mutedForeground }]}>
                Masalliq va miqdorini yozing — AI kaloriyasini hisoblaydi. Masalan: "500 g guruch", "300 g mol
                go'shti", "2 dona sabzi".
              </Text>
              <View style={styles.ingRow}>
                <TextInput
                  value={ingText}
                  onChangeText={setIngText}
                  onSubmitEditing={addIngredientByAi}
                  placeholder="Masalliq va miqdori"
                  placeholderTextColor={colors.mutedForeground}
                  returnKeyType="done"
                  style={[
                    styles.input,
                    styles.flex1,
                    { backgroundColor: colors.input, borderColor: colors.border, color: colors.text },
                  ]}
                />
                <Pressable
                  onPress={addIngredientByAi}
                  disabled={ingBusy || !ingText.trim()}
                  accessibilityLabel="Masalliqni qo'shish"
                  style={({ pressed }) => [
                    styles.ingAdd,
                    {
                      backgroundColor: ingText.trim() ? colors.primary : colors.mutedForeground,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  {ingBusy ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Feather name="plus" size={20} color="#FFFFFF" />
                  )}
                </Pressable>
              </View>
              {matches.map((m) => (
                <Pressable
                  key={m.id}
                  onPress={() => {
                    setIngredients((prev) => [
                      ...prev,
                      { name: `${m.name} (${m.portion})`, cal: m.cal, protein: m.protein, carbs: m.carbs, fat: m.fat },
                    ]);
                    setIngText("");
                  }}
                  style={[styles.match, { borderColor: colors.border, backgroundColor: colors.card }]}
                >
                  <Text style={styles.matchEmoji}>{m.emoji}</Text>
                  <Text style={[styles.matchName, { color: colors.text }]} numberOfLines={1}>
                    {m.name} · {m.portion}
                  </Text>
                  <Text style={[styles.matchCal, { color: colors.primary }]}>{m.cal} kkal</Text>
                </Pressable>
              ))}
              {ingError ? <Text style={styles.error}>{ingError}</Text> : null}

              {ingredients.map((ing, i) => (
                <View key={`${ing.name}-${i}`} style={[styles.ingItem, { borderColor: colors.border, backgroundColor: colors.card }]}>
                  <View style={styles.flex1}>
                    <Text style={[styles.ingName, { color: colors.text }]} numberOfLines={1}>
                      {ing.name}
                    </Text>
                    <Text style={[styles.ingMeta, { color: colors.mutedForeground }]}>
                      {ing.protein}g B · {ing.carbs}g U · {ing.fat}g Y
                    </Text>
                  </View>
                  <Text style={[styles.ingCal, { color: colors.primary }]}>{ing.cal} kkal</Text>
                  <Pressable
                    onPress={() => setIngredients((prev) => prev.filter((_, j) => j !== i))}
                    hitSlop={8}
                    accessibilityLabel="Masalliqni o'chirish"
                  >
                    <Feather name="x" size={18} color={colors.destructive} />
                  </Pressable>
                </View>
              ))}

              <View style={[styles.servings, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.flex1}>
                  <Text style={[styles.servTitle, { color: colors.text }]}>Necha porsiya chiqadi?</Text>
                  <Text style={[styles.hint, { color: colors.mutedForeground }]}>
                    Jami {Math.round(totals.cal)} kkal ÷ {servings}
                  </Text>
                </View>
                <Pressable
                  onPress={() => setServings((s) => Math.max(1, s - 1))}
                  style={[styles.step, { borderColor: colors.border }]}
                  accessibilityLabel="Kamaytirish"
                >
                  <Feather name="minus" size={18} color={colors.primary} />
                </Pressable>
                <Text style={[styles.servValue, { color: colors.text }]}>{servings}</Text>
                <Pressable
                  onPress={() => setServings((s) => Math.min(30, s + 1))}
                  style={[styles.step, { borderColor: colors.border }]}
                  accessibilityLabel="Ko'paytirish"
                >
                  <Feather name="plus" size={18} color={colors.primary} />
                </Pressable>
              </View>

              <View style={[styles.perBox, { backgroundColor: colors.secondary }]}>
                <Text style={[styles.perTitle, { color: colors.primary }]}>1 porsiya: {per.cal} kkal</Text>
                <Text style={[styles.hint, { color: colors.primary }]}>
                  {per.protein}g oqsil · {per.carbs}g uglevod · {per.fat}g yog'
                </Text>
              </View>
            </>
          )}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 8, borderTopColor: colors.border }]}>
          <Pressable
            onPress={save}
            disabled={!valid}
            style={({ pressed }) => [
              styles.saveBtn,
              { backgroundColor: valid ? colors.primary : colors.mutedForeground, opacity: pressed && valid ? 0.85 : 1 },
            ]}
          >
            <Feather name="check" size={20} color="#FFFFFF" />
            <Text style={styles.saveText}>Saqlash</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  body: { padding: 20, gap: 10, paddingBottom: 40 },
  segment: { flexDirection: "row", borderRadius: 14, padding: 4, marginBottom: 6 },
  segBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center" },
  segText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  label: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: -4 },
  section: { fontSize: 15, fontFamily: "Inter_700Bold", marginTop: 10 },
  hint: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  emojiRow: { gap: 6, paddingVertical: 2 },
  emojiBtn: { width: 42, height: 42, borderRadius: 12, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  emoji: { fontSize: 22 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  cell: { flexBasis: "46%", flexGrow: 1, gap: 8 },
  numBox: {
    flexDirection: "row",
    alignItems: "center",
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  numInput: { flex: 1, minWidth: 0, fontSize: 17, fontFamily: "Inter_700Bold", paddingVertical: 0 },
  unit: { fontSize: 13, fontFamily: "Inter_500Medium" },
  ingRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  ingAdd: { width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  match: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  matchEmoji: { fontSize: 18 },
  matchName: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium" },
  matchCal: { fontSize: 13, fontFamily: "Inter_700Bold" },
  error: { fontSize: 12.5, fontFamily: "Inter_500Medium", color: "#DC2626" },
  ingItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  ingName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  ingMeta: { fontSize: 11.5, fontFamily: "Inter_400Regular", marginTop: 2 },
  ingCal: { fontSize: 14, fontFamily: "Inter_700Bold" },
  servings: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 14, borderWidth: 1, padding: 12, marginTop: 6 },
  servTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  step: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  servValue: { fontSize: 18, fontFamily: "Inter_700Bold", minWidth: 24, textAlign: "center" },
  perBox: { borderRadius: 14, padding: 14, gap: 2 },
  perTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  footer: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  saveBtn: {
    flexDirection: "row",
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  saveText: { color: "#FFFFFF", fontSize: 16, fontFamily: "Inter_700Bold" },
});
