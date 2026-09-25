import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { DiaryEntry, DiaryEntryPatch } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { confirmAction } from "@/lib/confirm";

const MULTIPLIERS = [0.5, 0.75, 1, 1.25, 1.5, 2];

function fmtMult(m: number): string {
  return Number.isInteger(m) ? String(m) : String(Math.round(m * 100) / 100);
}

function parseNonNegInt(s: string, max: number): number | null {
  const n = Number.parseInt(s.replace(/\s/g, ""), 10);
  return Number.isFinite(n) && n >= 0 && n <= max ? n : null;
}

interface Props {
  visible: boolean;
  entry: DiaryEntry | null;
  onClose: () => void;
  onSave: (patch: DiaryEntryPatch) => void;
  onDelete: () => void;
}

export function EditEntryModal({ visible, entry, onClose, onSave, onDelete }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [mult, setMult] = useState(1);
  const [cal, setCal] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");

  useEffect(() => {
    if (!visible || !entry) return;
    setName(entry.name);
    setMult(1);
    setCal(String(entry.cal));
    setProtein(String(entry.protein));
    setCarbs(String(entry.carbs));
    setFat(String(entry.fat));
  }, [visible, entry]);

  if (!entry) return null;

  const applyMult = (m: number) => {
    setMult(m);
    setCal(String(Math.round(entry.cal * m)));
    setProtein(String(Math.round(entry.protein * m)));
    setCarbs(String(Math.round(entry.carbs * m)));
    setFat(String(Math.round(entry.fat * m)));
  };

  const calN = parseNonNegInt(cal, 10000);
  const proteinN = parseNonNegInt(protein, 1000);
  const carbsN = parseNonNegInt(carbs, 1000);
  const fatN = parseNonNegInt(fat, 1000);
  const valid =
    name.trim().length > 0 && calN !== null && proteinN !== null && carbsN !== null && fatN !== null;

  const handleSave = () => {
    if (!valid) return;
    const patch: DiaryEntryPatch = {
      name: name.trim(),
      cal: calN!,
      protein: proteinN!,
      carbs: carbsN!,
      fat: fatN!,
    };
    if (mult !== 1) {
      const base = (entry.portion ?? "porsiya").replace(/^[\d.]+×\s*/, "");
      patch.portion = `${fmtMult(mult)}× ${base}`;
    }
    onSave(patch);
  };

  const confirmDelete = async () => {
    const ok = await confirmAction({
      title: "Yozuvni o'chirish",
      message: `"${entry.name}" yozuvini o'chirmoqchimisiz?`,
      confirmText: "O'chirish",
      destructive: true,
    });
    if (ok) onDelete();
  };

  const numField = (
    label: string,
    value: string,
    setValue: (v: string) => void,
    unit: string,
  ) => (
    <View style={styles.numCell}>
      <Text style={[styles.numLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <View style={[styles.numBox, { backgroundColor: colors.input, borderColor: colors.border }]}>
        <TextInput
          value={value}
          onChangeText={(v) => {
            setValue(v);
            setMult(1);
          }}
          keyboardType="number-pad"
          selectTextOnFocus
          style={[styles.numInput, { color: colors.text }]}
        />
        <Text style={[styles.numUnit, { color: colors.mutedForeground }]}>{unit}</Text>
      </View>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={0} style={styles.flex1}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable
            style={[
              styles.sheet,
              { backgroundColor: colors.card, paddingBottom: Math.max(insets.bottom, 12) + 16 },
            ]}
            onPress={() => {}}
          >
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={styles.header}>
                <View style={[styles.headIcon, { backgroundColor: colors.primary }]}>
                  {entry.emoji ? (
                    <Text style={styles.headEmoji}>{entry.emoji}</Text>
                  ) : (
                    <Feather name="edit-2" size={20} color="#FFFFFF" />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.title, { color: colors.text }]}>Yozuvni tahrirlash</Text>
                  <Text style={[styles.desc, { color: colors.mutedForeground }]}>
                    {entry.time}
                    {entry.portion ? ` · ${entry.portion}` : ""}
                  </Text>
                </View>
              </View>

              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Nomi</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                style={[
                  styles.nameInput,
                  { backgroundColor: colors.input, borderColor: colors.border, color: colors.text },
                ]}
              />

              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
                Porsiya (asl miqdorga nisbatan)
              </Text>
              <View style={styles.chips}>
                {MULTIPLIERS.map((m) => {
                  const active = m === mult;
                  return (
                    <Pressable
                      key={m}
                      onPress={() => applyMult(m)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: active ? colors.primary : colors.secondary,
                          borderColor: active ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text style={[styles.chipText, { color: active ? "#FFFFFF" : colors.text }]}>
                        {fmtMult(m)}×
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.grid}>
                {numField("Kaloriya", cal, setCal, "kkal")}
                {numField("Oqsil", protein, setProtein, "g")}
                {numField("Uglevod", carbs, setCarbs, "g")}
                {numField("Yog'", fat, setFat, "g")}
              </View>

              {!valid ? (
                <Text style={styles.warn}>Nom kiriting va raqamlarni to'g'ri yozing.</Text>
              ) : null}

              <Pressable
                onPress={handleSave}
                disabled={!valid}
                style={({ pressed }) => [
                  styles.saveBtn,
                  {
                    backgroundColor: valid ? colors.primary : colors.mutedForeground,
                    opacity: pressed && valid ? 0.85 : 1,
                  },
                ]}
              >
                <Feather name="check" size={20} color="#FFFFFF" />
                <Text style={styles.saveText}>Saqlash</Text>
              </Pressable>

              <View style={styles.footerRow}>
                <TouchableOpacity onPress={confirmDelete} style={styles.footerBtn}>
                  <Feather name="trash-2" size={15} color={colors.destructive} />
                  <Text style={[styles.footerText, { color: colors.destructive }]}>O'chirish</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={onClose} style={styles.footerBtn}>
                  <Text style={[styles.footerText, { color: colors.mutedForeground }]}>Bekor qilish</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: "rgba(15,25,10,0.55)", justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    paddingHorizontal: 20,
    maxHeight: "90%",
  },
  handle: { width: 44, height: 5, borderRadius: 3, alignSelf: "center", marginBottom: 12 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
  headIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  headEmoji: { fontSize: 22 },
  title: { fontSize: 18, fontFamily: "Inter_700Bold" },
  desc: { fontSize: 12.5, fontFamily: "Inter_400Regular", marginTop: 2 },
  sectionLabel: { fontSize: 12.5, fontFamily: "Inter_600SemiBold", marginTop: 14, marginBottom: 6 },
  nameInput: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, borderWidth: 1 },
  chipText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 14 },
  numCell: { flexBasis: "47%", flexGrow: 1 },
  numLabel: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 4 },
  numBox: {
    flexDirection: "row",
    alignItems: "center",
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 12,
  },
  numInput: { flex: 1, fontSize: 18, fontFamily: "Inter_700Bold", paddingVertical: 0 },
  numUnit: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  warn: { fontSize: 12.5, fontFamily: "Inter_500Medium", color: "#DC2626", marginTop: 10 },
  saveBtn: {
    flexDirection: "row",
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 18,
  },
  saveText: { color: "#FFFFFF", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  footerRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  footerBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 4 },
  footerText: { fontSize: 14, fontFamily: "Inter_500Medium" },
});
