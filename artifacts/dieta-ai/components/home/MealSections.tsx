import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/components/i18n/Text";
import type { DiaryEntry } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { entryMeal, MEAL_INFO, MEAL_ORDER, type MealType } from "@/lib/meals";
import { tr } from "@/lib/i18n";

/** The day's diary split into breakfast / lunch / dinner / snacks. */
export function MealSections({
  entries,
  yesterdayEntries,
  canRepeat,
  onEdit,
  onDelete,
  onAddToMeal,
  onRepeat,
}: {
  entries: DiaryEntry[];
  /** The previous day's entries, offered as "repeat" for an empty meal. */
  yesterdayEntries: DiaryEntry[];
  canRepeat: boolean;
  onEdit: (e: DiaryEntry) => void;
  onDelete: (e: DiaryEntry) => void;
  onAddToMeal: (meal: MealType) => void;
  onRepeat: (meal: MealType, from: DiaryEntry[]) => void;
}) {
  const colors = useColors();
  return (
    <View style={styles.wrap}>
      {MEAL_ORDER.map((meal) => {
        const list = entries.filter((e) => entryMeal(e) === meal);
        const total = list.reduce((s, e) => s + (Number.isFinite(e.cal) ? e.cal : 0), 0);
        const prev = canRepeat && list.length === 0 ? yesterdayEntries.filter((e) => entryMeal(e) === meal) : [];
        const prevCal = prev.reduce((s, e) => s + e.cal, 0);
        const info = MEAL_INFO[meal];
        return (
          <View key={meal} style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.head}>
              <Text style={styles.headEmoji}>{info.emoji}</Text>
              <View style={styles.flex1}>
                <Text style={[styles.headTitle, { color: colors.text }]}>{info.label}</Text>
                <Text style={[styles.headSub, { color: colors.mutedForeground }]}>
                  {list.length > 0 ? tr("{0} ta · {1} kkal", list.length, total) : "Hali qo'shilmagan"}
                </Text>
              </View>
              <Pressable
                onPress={() => onAddToMeal(meal)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`${info.label}ga qo'shish`}
                style={({ pressed }) => [styles.addBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
              >
                <Feather name="plus" size={18} color="#FFFFFF" />
              </Pressable>
            </View>

            {list.map((e) => (
              <Pressable
                key={e.id}
                onPress={() => onEdit(e)}
                onLongPress={() => onDelete(e)}
                delayLongPress={400}
                accessibilityRole="button"
                accessibilityLabel={`${e.name}, ${e.cal} kaloriya`}
                accessibilityHint="Tahrirlash uchun bosing, o'chirish uchun bosib turing"
                style={({ pressed }) => [styles.entry, { borderTopColor: colors.border, opacity: pressed ? 0.85 : 1 }]}
              >
                {e.imageUri ? (
                  <Image
                    source={{ uri: e.imageUri }}
                    style={styles.thumb}
                    contentFit="cover"
                    transition={120}
                    cachePolicy="memory-disk"
                  />
                ) : (
                  <View style={[styles.icon, { backgroundColor: colors.secondary }]}>
                    {e.emoji ? (
                      <Text style={styles.iconEmoji}>{e.emoji}</Text>
                    ) : (
                      <Feather
                        name={
                          e.source === "camera"
                            ? "camera"
                            : e.source === "gallery"
                              ? "image"
                              : e.source === "plan"
                                ? "calendar"
                                : e.source === "catalog"
                                  ? "book-open"
                                  : "edit-3"
                        }
                        size={16}
                        color={colors.primary}
                      />
                    )}
                  </View>
                )}
                <View style={styles.flex1}>
                  <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                    {e.name}
                  </Text>
                  <Text style={[styles.meta, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {e.time}
                    {e.portion ? ` · ${e.portion}` : ""} · {e.protein}g B · {e.carbs}g U · {e.fat}g Y
                  </Text>
                </View>
                <Text style={[styles.cal, { color: colors.primary }]}>{e.cal}</Text>
                <Pressable
                  onPress={() => onDelete(e)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="O'chirish"
                  style={({ pressed }) => [styles.deleteBtn, { opacity: pressed ? 0.5 : 1 }]}
                >
                  <Feather name="trash-2" size={15} color={colors.destructive} />
                </Pressable>
              </Pressable>
            ))}

            {prev.length > 0 ? (
              <Pressable
                onPress={() => onRepeat(meal, prev)}
                style={({ pressed }) => [
                  styles.repeat,
                  { borderColor: colors.border, backgroundColor: colors.background, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <Feather name="rotate-ccw" size={14} color={colors.primary} />
                <Text style={[styles.repeatText, { color: colors.primary }]} numberOfLines={1}>
                  Kechagidek: {prev.map((e) => e.name).join(", ")} · {prevCal} kkal
                </Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  wrap: { gap: 10 },
  section: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
  head: { flexDirection: "row", alignItems: "center", gap: 10 },
  headEmoji: { fontSize: 22 },
  headTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  headSub: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 1 },
  addBtn: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  entry: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    marginTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  iconEmoji: { fontSize: 19 },
  thumb: { width: 38, height: 38, borderRadius: 9, backgroundColor: "#0001" },
  name: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  meta: { fontSize: 11.5, fontFamily: "Inter_400Regular", marginTop: 2 },
  cal: { fontSize: 14, fontFamily: "Inter_700Bold" },
  deleteBtn: { padding: 4, borderRadius: 8 },
  repeat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  repeatText: { flex: 1, fontSize: 12.5, fontFamily: "Inter_600SemiBold" },
});
