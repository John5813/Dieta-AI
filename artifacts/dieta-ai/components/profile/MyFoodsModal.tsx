import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "@/components/i18n/Text";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CustomFoodEditor } from "@/components/CustomFoodEditor";
import { useTracker, type CustomFood } from "@/context/TrackerContext";
import { useColors } from "@/hooks/useColors";
import { confirmAction } from "@/lib/confirm";
import { tr } from "@/lib/i18n";

/** Manage user-made foods/recipes and favorites. */
export function MyFoodsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { customFoods, removeCustomFood, favorites, toggleFavorite } = useTracker();
  const [editing, setEditing] = useState<CustomFood | null>(null);
  const [creating, setCreating] = useState(false);

  const remove = async (f: CustomFood) => {
    const ok = await confirmAction({
      title: "Taomni o'chirish",
      message: tr("\"{0}\" o'chirilsinmi? Kundalikdagi yozuvlar o'zgarmaydi.", f.name),
      confirmText: "O'chirish",
      destructive: true,
    });
    if (ok) removeCustomFood(f.id);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.header,
            { paddingTop: (Platform.OS === "web" ? 16 : insets.top) + 8, borderBottomColor: colors.border },
          ]}
        >
          <Pressable onPress={onClose} hitSlop={10} style={{ padding: 4 }}>
            <Feather name="x" size={24} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Mening taomlarim</Text>
          <Pressable onPress={() => setCreating(true)} hitSlop={10} accessibilityLabel="Yangi taom" style={{ padding: 4 }}>
            <Feather name="plus" size={24} color={colors.primary} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, gap: 8, paddingBottom: insets.bottom + 32 }}>
          <Text style={[styles.section, { color: colors.mutedForeground }]}>O'z taomlarim va retseptlarim</Text>
          {customFoods.length === 0 ? (
            <Pressable
              onPress={() => setCreating(true)}
              style={[styles.empty, { borderColor: colors.primary }]}
            >
              <Feather name="plus-circle" size={20} color={colors.primary} />
              <Text style={[styles.emptyText, { color: colors.primary }]}>
                Birinchi taom yoki retseptingizni yarating
              </Text>
            </Pressable>
          ) : (
            customFoods.map((f) => (
              <Pressable
                key={f.id}
                onPress={() => setEditing(f)}
                style={({ pressed }) => [
                  styles.row,
                  { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={styles.emoji}>{f.emoji ?? "🍽️"}</Text>
                <View style={styles.flex1}>
                  <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                    {f.name}
                  </Text>
                  <Text style={[styles.meta, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {f.ingredients?.length ? tr("Retsept · {0} masalliq · ", f.ingredients.length) : ""}
                    {f.portion ?? "1 porsiya"}
                  </Text>
                </View>
                <Text style={[styles.cal, { color: colors.primary }]}>{f.cal} kkal</Text>
                <Pressable onPress={() => remove(f)} hitSlop={8} accessibilityLabel="O'chirish">
                  <Feather name="trash-2" size={16} color={colors.destructive} />
                </Pressable>
              </Pressable>
            ))
          )}

          <Text style={[styles.section, { color: colors.mutedForeground, marginTop: 16 }]}>Sevimlilar</Text>
          {favorites.length === 0 ? (
            <Text style={[styles.meta, { color: colors.mutedForeground }]}>
              Kundalikdagi ovqatni bosib, ⭐ belgisi bilan sevimliga qo'shing.
            </Text>
          ) : (
            favorites.map((f) => (
              <View key={f.id} style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={styles.emoji}>{f.emoji ?? "🍽️"}</Text>
                <View style={styles.flex1}>
                  <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                    {f.name}
                  </Text>
                  <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                    {f.protein}g B · {f.carbs}g U · {f.fat}g Y
                  </Text>
                </View>
                <Text style={[styles.cal, { color: colors.primary }]}>{f.cal} kkal</Text>
                <Pressable onPress={() => toggleFavorite(f)} hitSlop={8} accessibilityLabel="Sevimlilardan olib tashlash">
                  <Feather name="star" size={17} color="#F59E0B" />
                </Pressable>
              </View>
            ))
          )}
        </ScrollView>

        <CustomFoodEditor
          visible={creating || editing !== null}
          food={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
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
  section: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  empty: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: 14,
    padding: 16,
  },
  emptyText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  row: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 14, borderWidth: 1, padding: 12 },
  emoji: { fontSize: 24 },
  name: { fontSize: 14.5, fontFamily: "Inter_600SemiBold" },
  meta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  cal: { fontSize: 14, fontFamily: "Inter_700Bold" },
});
