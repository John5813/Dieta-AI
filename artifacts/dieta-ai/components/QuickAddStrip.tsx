import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { SavedFood } from "@/context/TrackerContext";
import { useColors } from "@/hooks/useColors";

export type QuickTab = "recent" | "favorites" | "mine";

const TAB_LABEL: Record<QuickTab, string> = {
  recent: "Oxirgilar",
  favorites: "Sevimlilar",
  mine: "Mening taomlarim",
};

const EMPTY_TEXT: Record<QuickTab, string> = {
  recent: "Qo'shgan ovqatlaringiz shu yerda chiqadi.",
  favorites: "Ovqatni tahrirlash oynasida ⭐ bosib sevimliga qo'shing.",
  mine: "O'z taomingiz yoki retseptingizni yarating — bir bosishda qo'shiladi.",
};

/** One-tap add from recent, favorite and user-made foods. */
export function QuickAddStrip({
  recent,
  favorites,
  mine,
  isFavorite,
  onToggleFavorite,
  onAdd,
  onCreateMine,
}: {
  recent: SavedFood[];
  favorites: SavedFood[];
  mine: SavedFood[];
  isFavorite: (name: string) => boolean;
  onToggleFavorite: (food: SavedFood) => void;
  onAdd: (food: SavedFood) => void;
  onCreateMine?: () => void;
}) {
  const colors = useColors();
  const [tab, setTab] = useState<QuickTab>(recent.length > 0 ? "recent" : favorites.length > 0 ? "favorites" : "mine");
  const list = tab === "recent" ? recent : tab === "favorites" ? favorites : mine;

  return (
    <View style={styles.wrap}>
      <View style={styles.tabs}>
        {(Object.keys(TAB_LABEL) as QuickTab[]).map((t) => {
          const on = t === tab;
          return (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              style={[styles.tab, on && { borderBottomColor: colors.primary }]}
            >
              <Text style={[styles.tabText, { color: on ? colors.primary : colors.mutedForeground }]}>
                {TAB_LABEL[t]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {tab === "mine" && onCreateMine ? (
          <Pressable
            onPress={onCreateMine}
            style={({ pressed }) => [
              styles.card,
              styles.createCard,
              { borderColor: colors.primary, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Feather name="plus-circle" size={22} color={colors.primary} />
            <Text style={[styles.createText, { color: colors.primary }]}>Yangi taom yoki retsept</Text>
          </Pressable>
        ) : null}
        {list.length === 0 && !(tab === "mine" && onCreateMine) ? (
          <Text style={[styles.empty, { color: colors.mutedForeground }]}>{EMPTY_TEXT[tab]}</Text>
        ) : null}
        {list.map((f) => {
          const fav = isFavorite(f.name);
          return (
            <Pressable
              key={f.id}
              onPress={() => onAdd(f)}
              accessibilityRole="button"
              accessibilityLabel={`${f.name}, ${f.cal} kkal — qo'shish`}
              style={({ pressed }) => [
                styles.card,
                { backgroundColor: colors.background, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <View style={styles.cardTop}>
                <Text style={styles.emoji}>{f.emoji ?? "🍽️"}</Text>
                <Pressable
                  onPress={() => onToggleFavorite(f)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={fav ? "Sevimlilardan olib tashlash" : "Sevimliga qo'shish"}
                >
                  <Feather name="star" size={15} color={fav ? "#F59E0B" : colors.border} />
                </Pressable>
              </View>
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>
                {f.name}
              </Text>
              <View style={styles.cardBottom}>
                <Text style={[styles.cal, { color: colors.primary }]}>{f.cal} kkal</Text>
                <View style={[styles.plus, { backgroundColor: colors.primary }]}>
                  <Feather name="plus" size={13} color="#FFFFFF" />
                </View>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  tabs: { flexDirection: "row", gap: 14 },
  tab: { paddingBottom: 4, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  row: { gap: 8, paddingRight: 8, alignItems: "stretch" },
  card: { width: 128, borderRadius: 14, borderWidth: 1, padding: 10, gap: 4 },
  createCard: { alignItems: "center", justifyContent: "center", borderStyle: "dashed", gap: 6 },
  createText: { fontSize: 12.5, fontFamily: "Inter_700Bold", textAlign: "center" },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  emoji: { fontSize: 22 },
  name: { fontSize: 12.5, fontFamily: "Inter_600SemiBold", minHeight: 32 },
  cardBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cal: { fontSize: 12.5, fontFamily: "Inter_700Bold" },
  plus: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  empty: { fontSize: 12.5, fontFamily: "Inter_400Regular", paddingVertical: 14, maxWidth: 300 },
});
