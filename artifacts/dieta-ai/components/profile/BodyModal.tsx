import { Feather } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Text, TextInput } from "@/components/i18n/Text";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import { useTracker, type BodyMeasurement, type ProgressPhoto } from "@/context/TrackerContext";
import { useColors } from "@/hooks/useColors";
import { confirmAction } from "@/lib/confirm";
import { formatDateKeyUz, todayStr } from "@/lib/date";
import { tr } from "@/lib/i18n";

type Field = Exclude<keyof BodyMeasurement, "date">;

const FIELDS: Array<{ key: Field; label: string; hint: string }> = [
  { key: "waist", label: "Bel", hint: "Kindik ustidan" },
  { key: "hips", label: "Dumba", hint: "Eng keng joyidan" },
  { key: "chest", label: "Ko'krak", hint: "Ko'krak uchidan" },
  { key: "arm", label: "Qo'l", hint: "Bilakning eng yo'g'on joyi" },
  { key: "thigh", label: "Son", hint: "Sonning eng yo'g'on joyi" },
  { key: "neck", label: "Bo'yin", hint: "Kekirdak ostidan" },
];

function fmt(n: number): string {
  return String(Math.round(n * 10) / 10);
}

async function persistPhoto(uri: string): Promise<string> {
  const dir = FileSystem.documentDirectory;
  if (!dir) return uri;
  const folder = `${dir}progress_photos/`;
  await FileSystem.makeDirectoryAsync(folder, { intermediates: true }).catch(() => undefined);
  const dest = `${folder}p-${Date.now()}.jpg`;
  await FileSystem.copyAsync({ from: uri, to: dest });
  return dest;
}

/** Body measurements over time and before/after progress photos. */
export function BodyModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, weightLog } = useApp();
  const { measurements, saveMeasurement, removeMeasurement, photos, addPhoto, removePhoto } = useTracker();
  const [formOpen, setFormOpen] = useState(false);
  const [values, setValues] = useState<Partial<Record<Field, string>>>({});
  const [viewing, setViewing] = useState<ProgressPhoto | null>(null);

  const latest = measurements[measurements.length - 1];
  const first = measurements[0];

  useEffect(() => {
    if (!formOpen) return;
    // Only today's record pre-fills; older values show as placeholders so they aren't re-saved as new.
    const today = measurements.find((m) => m.date === todayStr());
    const init: Partial<Record<Field, string>> = {};
    for (const f of FIELDS) if (today?.[f.key] != null) init[f.key] = String(today[f.key]);
    setValues(init);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formOpen]);

  const parsed = FIELDS.map((f) => {
    const n = parseFloat((values[f.key] ?? "").replace(",", "."));
    return [f.key, Number.isFinite(n) && n >= 10 && n <= 250 ? n : undefined] as const;
  });
  const anyValue = parsed.some(([, v]) => v != null);
  const badInput = FIELDS.some((f) => (values[f.key] ?? "").trim() !== "" && parsed.find(([k]) => k === f.key)?.[1] == null);

  const save = () => {
    if (!anyValue || badInput) return;
    const m: BodyMeasurement = { date: todayStr() };
    for (const [k, v] of parsed) if (v != null) m[k] = v;
    saveMeasurement(m);
    setFormOpen(false);
  };

  const pickPhoto = async (source: "camera" | "gallery") => {
    try {
      const perm =
        source === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
      const r =
        source === "camera"
          ? await ImagePicker.launchCameraAsync({ quality: 0.6, mediaTypes: ImagePicker.MediaTypeOptions.Images })
          : await ImagePicker.launchImageLibraryAsync({ quality: 0.6, mediaTypes: ImagePicker.MediaTypeOptions.Images });
      if (r.canceled || !r.assets?.[0]?.uri) return;
      const uri = Platform.OS === "web" ? r.assets[0].uri : await persistPhoto(r.assets[0].uri);
      const today = todayStr();
      const w = [...weightLog].reverse().find((x) => x.date <= today)?.kg ?? profile.currentWeight;
      addPhoto({ date: today, uri, weight: w });
    } catch {}
  };

  const deletePhoto = async (p: ProgressPhoto) => {
    const ok = await confirmAction({
      title: "Suratni o'chirish",
      message: tr("{0} dagi surat o'chirilsinmi?", formatDateKeyUz(p.date)),
      confirmText: "O'chirish",
      destructive: true,
    });
    if (!ok) return;
    removePhoto(p.id);
    setViewing(null);
    if (p.uri.startsWith("file://")) FileSystem.deleteAsync(p.uri, { idempotent: true }).catch(() => {});
  };

  const waistToHeight = latest?.waist && profile.height ? latest.waist / profile.height : null;
  const firstPhoto = photos[0];
  const lastPhoto = photos.length > 1 ? photos[photos.length - 1] : null;

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
          <Text style={[styles.headerTitle, { color: colors.text }]}>Tana o'lchamlari</Text>
          <View style={{ width: 32 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: insets.bottom + 40 }}>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardHead}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>O'lchamlar (sm)</Text>
              <Pressable
                onPress={() => setFormOpen(true)}
                style={[styles.smallBtn, { backgroundColor: colors.primary }]}
              >
                <Feather name="plus" size={14} color="#FFFFFF" />
                <Text style={styles.smallBtnText}>O'lchash</Text>
              </Pressable>
            </View>
            {latest ? (
              <>
                <Text style={[styles.hint, { color: colors.mutedForeground }]}>
                  {formatDateKeyUz(latest.date)}
                  {first && first.date !== latest.date ? tr(" · {0} ga nisbatan", formatDateKeyUz(first.date)) : ""}
                </Text>
                <View style={styles.grid}>
                  {FIELDS.map((f) => {
                    const v = latest[f.key];
                    const start = measurements.find((m) => m[f.key] != null)?.[f.key];
                    const delta = v != null && start != null && first?.date !== latest.date ? v - start : null;
                    return (
                      <View key={f.key} style={[styles.cell, { backgroundColor: colors.background }]}>
                        <Text style={[styles.cellLabel, { color: colors.mutedForeground }]}>{f.label}</Text>
                        <Text style={[styles.cellValue, { color: colors.text }]}>{v != null ? fmt(v) : "—"}</Text>
                        {delta != null && Math.abs(delta) >= 0.1 ? (
                          <Text style={[styles.delta, { color: delta < 0 ? "#16A34A" : "#DC2626" }]}>
                            {delta > 0 ? "+" : ""}
                            {fmt(delta)}
                          </Text>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
                {waistToHeight ? (
                  <View style={[styles.insight, { backgroundColor: waistToHeight < 0.5 ? "#DCFCE7" : "#FEF3C7" }]}>
                    <Text style={[styles.insightText, { color: waistToHeight < 0.5 ? "#166534" : "#92400E" }]}>
                      Bel/bo'y nisbati: {waistToHeight.toFixed(2)} —{" "}
                      {waistToHeight < 0.5
                        ? "sog'lom oraliqda (0.5 dan kam)."
                        : "0.5 dan yuqori; qorin atrofidagi yog'ni kamaytirish tavsiya etiladi."}
                    </Text>
                  </View>
                ) : null}
              </>
            ) : (
              <Text style={[styles.hint, { color: colors.mutedForeground }]}>
                Tarozi har doim ham to'g'ri ko'rsatmaydi: mushak ortib, yog' kamaysa vazn o'zgarmasligi mumkin.
                Santimetr lenta bilan haftada bir marta o'lchab boring.
              </Text>
            )}
          </View>

          {measurements.length > 1 ? (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Tarix</Text>
              {[...measurements].reverse().map((m) => (
                <View key={m.date} style={[styles.histRow, { borderTopColor: colors.border }]}>
                  <Text style={[styles.histDate, { color: colors.text }]}>{formatDateKeyUz(m.date)}</Text>
                  <Text style={[styles.histVals, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {FIELDS.filter((f) => m[f.key] != null)
                      .map((f) => `${f.label} ${fmt(m[f.key]!)}`)
                      .join(" · ")}
                  </Text>
                  <Pressable onPress={() => removeMeasurement(m.date)} hitSlop={8} accessibilityLabel="O'chirish">
                    <Feather name="trash-2" size={14} color={colors.destructive} />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Progress suratlari</Text>
            {firstPhoto && lastPhoto ? (
              <View style={styles.compare}>
                {[firstPhoto, lastPhoto].map((p, i) => (
                  <Pressable key={p.id} onPress={() => setViewing(p)} style={styles.compareCell}>
                    <Image source={{ uri: p.uri }} style={styles.compareImg} contentFit="cover" />
                    <Text style={[styles.compareLabel, { color: colors.text }]}>
                      {i === 0 ? "Oldin" : "Hozir"} · {formatDateKeyUz(p.date)}
                    </Text>
                    {p.weight ? (
                      <Text style={[styles.hint, { color: colors.mutedForeground }]}>{fmt(p.weight)} kg</Text>
                    ) : null}
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text style={[styles.hint, { color: colors.mutedForeground }]}>
                Har 2–4 haftada bir xil joyda, bir xil kiyimda surat oling — o'zgarish ko'zga ko'rinadi. Suratlar faqat
                telefoningizda saqlanadi.
              </Text>
            )}
            {photos.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {photos.map((p) => (
                  <Pressable key={p.id} onPress={() => setViewing(p)}>
                    <Image source={{ uri: p.uri }} style={styles.thumb} contentFit="cover" />
                    <Text style={[styles.thumbDate, { color: colors.mutedForeground }]}>{formatDateKeyUz(p.date)}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
            <View style={styles.row}>
              {Platform.OS !== "web" ? (
                <Pressable onPress={() => pickPhoto("camera")} style={[styles.outlineBtn, { borderColor: colors.primary }]}>
                  <Feather name="camera" size={16} color={colors.primary} />
                  <Text style={[styles.outlineText, { color: colors.primary }]}>Suratga olish</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={() => pickPhoto("gallery")} style={[styles.outlineBtn, { borderColor: colors.primary }]}>
                <Feather name="image" size={16} color={colors.primary} />
                <Text style={[styles.outlineText, { color: colors.primary }]}>Galereyadan</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>

        {/* Measurement form */}
        <Modal visible={formOpen} transparent animationType="fade" onRequestClose={() => setFormOpen(false)}>
          <KeyboardAvoidingView behavior="padding" style={styles.flex1}>
            <Pressable style={styles.backdrop} onPress={() => setFormOpen(false)}>
              <Pressable style={[styles.sheet, { backgroundColor: colors.card }]} onPress={() => {}}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>Bugungi o'lchamlar (sm)</Text>
                <Text style={[styles.hint, { color: colors.mutedForeground }]}>
                  Faqat o'lchaganlaringizni kiriting — qolganini bo'sh qoldiring.
                </Text>
                <View style={styles.formGrid}>
                  {FIELDS.map((f) => (
                    <View key={f.key} style={styles.formCell}>
                      <Text style={[styles.cellLabel, { color: colors.text }]}>{f.label}</Text>
                      <TextInput
                        value={values[f.key] ?? ""}
                        onChangeText={(t) => setValues((v) => ({ ...v, [f.key]: t }))}
                        keyboardType="decimal-pad"
                        placeholder={latest?.[f.key] != null ? tr("Oldingi: {0}", fmt(latest[f.key]!)) : f.hint}
                        placeholderTextColor={colors.mutedForeground}
                        style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
                      />
                    </View>
                  ))}
                </View>
                {badInput ? <Text style={styles.error}>10–250 sm oralig'ida kiriting.</Text> : null}
                <Pressable
                  onPress={save}
                  disabled={!anyValue || badInput}
                  style={[
                    styles.primary,
                    { backgroundColor: anyValue && !badInput ? colors.primary : colors.mutedForeground },
                  ]}
                >
                  <Text style={styles.primaryText}>Saqlash</Text>
                </Pressable>
              </Pressable>
            </Pressable>
          </KeyboardAvoidingView>
        </Modal>

        {/* Photo viewer */}
        <Modal visible={viewing !== null} transparent animationType="fade" onRequestClose={() => setViewing(null)}>
          <View style={styles.viewer}>
            {viewing ? (
              <>
                <Image source={{ uri: viewing.uri }} style={styles.viewerImg} contentFit="contain" />
                <Text style={styles.viewerText}>
                  {formatDateKeyUz(viewing.date)}
                  {viewing.weight ? tr(" · {0} kg", fmt(viewing.weight)) : ""}
                </Text>
                <View style={styles.row}>
                  <Pressable onPress={() => deletePhoto(viewing)} style={[styles.outlineBtn, { borderColor: "#F87171" }]}>
                    <Feather name="trash-2" size={16} color="#F87171" />
                    <Text style={[styles.outlineText, { color: "#F87171" }]}>O'chirish</Text>
                  </Pressable>
                  <Pressable onPress={() => setViewing(null)} style={[styles.outlineBtn, { borderColor: "#FFFFFF" }]}>
                    <Text style={[styles.outlineText, { color: "#FFFFFF" }]}>Yopish</Text>
                  </Pressable>
                </View>
              </>
            ) : null}
          </View>
        </Modal>
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
  card: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 10 },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  hint: { fontSize: 12.5, fontFamily: "Inter_400Regular", lineHeight: 18 },
  smallBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16 },
  smallBtnText: { color: "#FFFFFF", fontSize: 13, fontFamily: "Inter_700Bold" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  cell: { width: "31.5%", flexGrow: 1, borderRadius: 12, padding: 10, alignItems: "center" },
  cellLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  cellValue: { fontSize: 18, fontFamily: "Inter_700Bold", marginTop: 2 },
  delta: { fontSize: 12, fontFamily: "Inter_700Bold" },
  insight: { borderRadius: 12, padding: 10 },
  insightText: { fontSize: 12.5, fontFamily: "Inter_600SemiBold", lineHeight: 17 },
  histRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
  histDate: { fontSize: 13, fontFamily: "Inter_600SemiBold", width: 92 },
  histVals: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular" },
  compare: { flexDirection: "row", gap: 10 },
  compareCell: { flex: 1, gap: 4 },
  compareImg: { width: "100%", aspectRatio: 3 / 4, borderRadius: 12, backgroundColor: "#0001" },
  compareLabel: { fontSize: 12.5, fontFamily: "Inter_700Bold" },
  thumb: { width: 72, height: 96, borderRadius: 10, backgroundColor: "#0001" },
  thumbDate: { fontSize: 10.5, fontFamily: "Inter_500Medium", marginTop: 2, textAlign: "center" },
  row: { flexDirection: "row", gap: 10 },
  outlineBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
  },
  outlineText: { fontSize: 14, fontFamily: "Inter_700Bold" },
  backdrop: { flex: 1, backgroundColor: "rgba(15,25,10,0.55)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 40, gap: 12 },
  formGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  formCell: { flexBasis: "46%", flexGrow: 1, gap: 6 },
  input: { height: 46, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, fontSize: 15, fontFamily: "Inter_600SemiBold" },
  error: { fontSize: 12.5, fontFamily: "Inter_500Medium", color: "#DC2626" },
  primary: { height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center" },
  primaryText: { color: "#FFFFFF", fontSize: 15.5, fontFamily: "Inter_700Bold" },
  viewer: { flex: 1, backgroundColor: "#000000EE", padding: 20, justifyContent: "center", gap: 14 },
  viewerImg: { width: "100%", height: "70%" },
  viewerText: { color: "#FFFFFF", fontSize: 14, fontFamily: "Inter_600SemiBold", textAlign: "center" },
});
