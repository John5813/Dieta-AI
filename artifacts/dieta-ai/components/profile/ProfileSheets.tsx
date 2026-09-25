import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useColors } from "@/hooks/useColors";

type IconName = keyof typeof Feather.glyphMap;

export const MONTHS_UZ = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
];

function parseNum(text: string): number {
  return parseFloat(text.replace(",", ".").replace(/\s/g, ""));
}

/** Bottom sheet shell shared by every profile editor. */
function Sheet({
  visible,
  onClose,
  icon,
  title,
  desc,
  children,
  onSave,
  saveDisabled,
}: {
  visible: boolean;
  onClose: () => void;
  icon: IconName;
  title: string;
  desc?: string;
  children: React.ReactNode;
  /** Omit for pickers that save on tap. */
  onSave?: () => void;
  saveDisabled?: boolean;
}) {
  const colors = useColors();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={0} style={s.flex1}>
        <Pressable style={s.backdrop} onPress={onClose}>
          <Pressable style={[s.sheet, { backgroundColor: colors.card }]} onPress={() => {}}>
            <View style={[s.handle, { backgroundColor: colors.border }]} />
            <View style={s.header}>
              <View style={[s.icon, { backgroundColor: colors.primary }]}>
                <Feather name={icon} size={20} color="#FFFFFF" />
              </View>
              <View style={s.flex1}>
                <Text style={[s.title, { color: colors.text }]}>{title}</Text>
                {desc ? <Text style={[s.desc, { color: colors.mutedForeground }]}>{desc}</Text> : null}
              </View>
            </View>

            {children}

            {onSave ? (
              <Pressable
                onPress={() => {
                  if (!saveDisabled) onSave();
                }}
                disabled={saveDisabled}
                style={({ pressed }) => [
                  s.saveBtn,
                  {
                    backgroundColor: saveDisabled ? colors.mutedForeground : colors.primary,
                    opacity: pressed && !saveDisabled ? 0.85 : 1,
                  },
                ]}
              >
                <Feather name="check" size={20} color="#FFFFFF" />
                <Text style={s.saveText}>Saqlash</Text>
              </Pressable>
            ) : null}

            <TouchableOpacity onPress={onClose} style={s.cancelBtn}>
              <Text style={[s.cancelText, { color: colors.mutedForeground }]}>Bekor qilish</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function TextSheet({
  visible,
  onClose,
  icon,
  title,
  desc,
  initial,
  placeholder,
  maxLength = 30,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  icon: IconName;
  title: string;
  desc?: string;
  initial?: string;
  placeholder?: string;
  maxLength?: number;
  onSave: (value: string) => void;
}) {
  const colors = useColors();
  const [text, setText] = useState("");
  useEffect(() => {
    if (visible) setText(initial ?? "");
  }, [visible, initial]);
  const value = text.trim();
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      icon={icon}
      title={title}
      desc={desc}
      onSave={() => onSave(value)}
      saveDisabled={value.length === 0}
    >
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        maxLength={maxLength}
        autoFocus
        autoCapitalize="words"
        style={[s.textInput, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
      />
    </Sheet>
  );
}

export function NumberSheet({
  visible,
  onClose,
  icon,
  title,
  desc,
  unit,
  min,
  max,
  initial,
  integer,
  hint,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  icon: IconName;
  title: string;
  desc?: string;
  unit: string;
  min: number;
  max: number;
  initial?: number;
  integer?: boolean;
  /** Extra line under the field for a valid value, e.g. what the change means. */
  hint?: (value: number) => string | null;
  onSave: (value: number) => void;
}) {
  const colors = useColors();
  const [text, setText] = useState("");
  useEffect(() => {
    if (visible) setText(initial ? String(initial) : "");
  }, [visible, initial]);
  const raw = parseNum(text);
  const num = integer ? Math.round(raw) : Math.round(raw * 10) / 10;
  const valid = Number.isFinite(num) && num >= min && num <= max;
  const hintText = valid && hint ? hint(num) : null;
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      icon={icon}
      title={title}
      desc={desc}
      onSave={() => onSave(num)}
      saveDisabled={!valid}
    >
      <View style={[s.numField, { backgroundColor: colors.input, borderColor: colors.border }]}>
        <TextInput
          value={text}
          onChangeText={setText}
          keyboardType={integer ? "number-pad" : "decimal-pad"}
          placeholder="0"
          placeholderTextColor={colors.mutedForeground}
          style={[s.numInput, { color: colors.text }]}
          autoFocus
          selectTextOnFocus
        />
        <Text style={[s.unitText, { color: colors.mutedForeground }]}>{unit}</Text>
      </View>
      {!valid && text.length > 0 ? (
        <Text style={s.warnText}>
          {min} va {max} {unit} orasida kiriting
        </Text>
      ) : hintText ? (
        <Text style={[s.hintText, { color: colors.mutedForeground }]}>{hintText}</Text>
      ) : null}
    </Sheet>
  );
}

export interface ChoiceOption<T> {
  value: T;
  label: string;
  desc?: string;
  icon?: IconName;
}

export function ChoiceSheet<T extends string | number>({
  visible,
  onClose,
  icon,
  title,
  desc,
  options,
  current,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  icon: IconName;
  title: string;
  desc?: string;
  options: ChoiceOption<T>[];
  current?: T;
  onSelect: (value: T) => void;
}) {
  const colors = useColors();
  const [local, setLocal] = useState<T | undefined>(current);
  useEffect(() => {
    if (visible) setLocal(current);
  }, [visible, current]);
  return (
    <Sheet visible={visible} onClose={onClose} icon={icon} title={title} desc={desc}>
      <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {options.map((opt) => {
          const selected = opt.value === local;
          return (
            <Pressable
              key={String(opt.value)}
              onPress={() => {
                setLocal(opt.value);
                // Let the tick show before the sheet closes.
                setTimeout(() => onSelect(opt.value), 150);
              }}
              style={({ pressed }) => [
                s.optionRow,
                {
                  backgroundColor: selected ? colors.secondary : colors.background,
                  borderColor: selected ? colors.primary : colors.border,
                  borderWidth: selected ? 2 : 1,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              {opt.icon ? (
                <View style={[s.optionIcon, { backgroundColor: selected ? colors.primary : colors.secondary }]}>
                  <Feather name={opt.icon} size={18} color={selected ? "#FFFFFF" : colors.primary} />
                </View>
              ) : null}
              <View style={s.flex1}>
                <Text style={[s.optionLabel, { color: colors.text }]}>{opt.label}</Text>
                {opt.desc ? (
                  <Text style={[s.optionDesc, { color: colors.mutedForeground }]}>{opt.desc}</Text>
                ) : null}
              </View>
              {selected && <Feather name="check-circle" size={22} color={colors.primary} />}
            </Pressable>
          );
        })}
      </ScrollView>
    </Sheet>
  );
}

export type BirthDate = { month: number; day: number; year: number };

export function BirthDateSheet({
  visible,
  onClose,
  initial,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  initial?: BirthDate;
  onSave: (value: BirthDate) => void;
}) {
  const colors = useColors();
  const [month, setMonth] = useState(0);
  const [dayText, setDayText] = useState("");
  const [yearText, setYearText] = useState("");
  useEffect(() => {
    if (!visible) return;
    setMonth(initial?.month ?? 0);
    setDayText(initial ? String(initial.day) : "");
    setYearText(initial ? String(initial.year) : "");
  }, [visible, initial]);

  const day = parseInt(dayText, 10);
  const year = parseInt(yearText, 10);
  const thisYear = new Date().getFullYear();
  const daysInMonth = Number.isFinite(year) ? new Date(year, month + 1, 0).getDate() : 31;
  const yearOk = Number.isFinite(year) && year >= thisYear - 90 && year <= thisYear - 10;
  const dayOk = Number.isFinite(day) && day >= 1 && day <= daysInMonth;
  const valid = yearOk && dayOk;
  const error =
    yearText.length === 4 && !yearOk
      ? `Yil ${thisYear - 90} va ${thisYear - 10} orasida bo'lishi kerak`
      : dayText.length > 0 && !dayOk
        ? `${MONTHS_UZ[month]} oyida 1–${daysInMonth} kun bor`
        : null;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      icon="calendar"
      title="Tug'ilgan sana"
      desc="Yoshingiz kunlik kaloriya normasini hisoblashda ishlatiladi."
      onSave={() => onSave({ month, day, year })}
      saveDisabled={!valid}
    >
      <View style={s.monthGrid}>
        {MONTHS_UZ.map((m, i) => {
          const selected = i === month;
          return (
            <Pressable
              key={m}
              onPress={() => setMonth(i)}
              style={[
                s.monthChip,
                {
                  backgroundColor: selected ? colors.primary : colors.background,
                  borderColor: selected ? colors.primary : colors.border,
                },
              ]}
            >
              <Text style={[s.monthText, { color: selected ? "#FFFFFF" : colors.text }]}>{m}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={s.dateRow}>
        <View style={s.flex1}>
          <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Kun</Text>
          <TextInput
            value={dayText}
            onChangeText={(t) => setDayText(t.replace(/\D/g, "").slice(0, 2))}
            keyboardType="number-pad"
            placeholder="15"
            placeholderTextColor={colors.mutedForeground}
            style={[s.textInput, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
          />
        </View>
        <View style={{ flex: 1.4 }}>
          <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Yil</Text>
          <TextInput
            value={yearText}
            onChangeText={(t) => setYearText(t.replace(/\D/g, "").slice(0, 4))}
            keyboardType="number-pad"
            placeholder="1995"
            placeholderTextColor={colors.mutedForeground}
            style={[s.textInput, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
          />
        </View>
      </View>
      {error ? <Text style={s.warnText}>{error}</Text> : null}
    </Sheet>
  );
}

export function CaloriesSheet({
  visible,
  onClose,
  autoCalories,
  current,
  manual,
  minCalories,
  onSave,
  onUseAuto,
}: {
  visible: boolean;
  onClose: () => void;
  /** What the plan calculator recommends right now. */
  autoCalories: number;
  current?: number;
  manual: boolean;
  minCalories: number;
  onSave: (value: number) => void;
  onUseAuto: () => void;
}) {
  const colors = useColors();
  const [text, setText] = useState("");
  useEffect(() => {
    if (visible) setText(String(current ?? autoCalories));
  }, [visible, current, autoCalories]);
  const num = Math.round(parseNum(text));
  const valid = Number.isFinite(num) && num >= 1000 && num <= 5000;
  const belowSafe = valid && num < minCalories;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      icon="zap"
      title="Kunlik kaloriya"
      desc="Shifokor yoki murabbiy boshqa norma bergan bo'lsa, o'zingiz kiriting. Makrolar shu raqamdan hisoblanadi."
      onSave={() => onSave(num)}
      saveDisabled={!valid}
    >
      <View style={[s.numField, { backgroundColor: colors.input, borderColor: colors.border }]}>
        <TextInput
          value={text}
          onChangeText={setText}
          keyboardType="number-pad"
          placeholder={String(autoCalories)}
          placeholderTextColor={colors.mutedForeground}
          style={[s.numInput, { color: colors.text }]}
          autoFocus
          selectTextOnFocus
        />
        <Text style={[s.unitText, { color: colors.mutedForeground }]}>kkal</Text>
      </View>
      {!valid && text.length > 0 ? (
        <Text style={s.warnText}>1000 va 5000 kkal orasida kiriting</Text>
      ) : belowSafe ? (
        <Text style={s.cautionText}>
          Bu vazningiz uchun xavfsiz minimumdan ({minCalories} kkal) past. Shifokor nazoratisiz tavsiya
          etilmaydi.
        </Text>
      ) : null}

      <Pressable
        onPress={onUseAuto}
        style={({ pressed }) => [
          s.autoRow,
          {
            backgroundColor: manual ? colors.background : colors.secondary,
            borderColor: manual ? colors.border : colors.primary,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <Feather name="cpu" size={18} color={colors.primary} />
        <View style={s.flex1}>
          <Text style={[s.optionLabel, { color: colors.text, fontSize: 14 }]}>
            Avtomatik: {autoCalories} kkal
          </Text>
          <Text style={[s.optionDesc, { color: colors.mutedForeground }]}>
            {manual
              ? "Vazn, bo'y, yosh va faollikka qarab hisoblashga qaytish"
              : "Hozir shu ishlatilmoqda — vazn o'zgarsa o'zi yangilanadi"}
          </Text>
        </View>
        {!manual && <Feather name="check-circle" size={20} color={colors.primary} />}
      </Pressable>
    </Sheet>
  );
}

const s = StyleSheet.create({
  flex1: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: "rgba(15,25,10,0.55)", justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "web" ? 110 : 100,
    gap: 14,
  },
  handle: { width: 44, height: 5, borderRadius: 3, alignSelf: "center", marginBottom: 6 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  icon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 18, fontFamily: "Inter_700Bold" },
  desc: { fontSize: 12.5, fontFamily: "Inter_400Regular", lineHeight: 17, marginTop: 2 },
  textInput: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
  numField: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 18,
    height: 64,
  },
  numInput: { flex: 1, minWidth: 0, fontSize: 28, fontFamily: "Inter_700Bold", paddingVertical: 0 },
  unitText: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  warnText: { fontSize: 12.5, fontFamily: "Inter_500Medium", color: "#DC2626" },
  cautionText: { fontSize: 12.5, fontFamily: "Inter_500Medium", color: "#B45309", lineHeight: 17 },
  hintText: { fontSize: 12.5, fontFamily: "Inter_500Medium", lineHeight: 17 },
  saveBtn: {
    flexDirection: "row",
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
  },
  saveText: { color: "#FFFFFF", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  cancelBtn: { alignSelf: "center", paddingVertical: 6 },
  cancelText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  optionRow: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 14, gap: 12 },
  optionIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  optionLabel: { fontSize: 16, fontFamily: "Inter_700Bold" },
  optionDesc: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  monthGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  monthChip: {
    width: "31.5%",
    flexGrow: 1,
    alignItems: "center",
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
  },
  monthText: { fontSize: 13.5, fontFamily: "Inter_600SemiBold" },
  dateRow: { flexDirection: "row", gap: 10 },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 6 },
  autoRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, borderWidth: 1.5 },
});
