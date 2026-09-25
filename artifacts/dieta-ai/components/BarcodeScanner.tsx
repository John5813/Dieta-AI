import { Feather } from "@expo/vector-icons";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import { Text, TextInput } from "@/components/i18n/Text";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { customFetch } from "@/lib/api-client";
import { tr } from "@/lib/i18n";

export interface BarcodeProduct {
  code: string;
  name: string;
  brand: string | null;
  unit: "g" | "ml";
  per100: { cal: number; protein: number; carbs: number; fat: number; sugar: number | null; sodiumMg: number | null };
  servingGrams: number | null;
}

export interface ScannedFood {
  name: string;
  cal: number;
  protein: number;
  carbs: number;
  fat: number;
  sugar?: number;
  sodiumMg?: number;
  portion: string;
}

type Phase =
  | { kind: "scan" }
  | { kind: "loading"; code: string }
  | { kind: "found"; product: BarcodeProduct }
  | { kind: "missing"; code: string }
  | { kind: "error"; code: string; message: string };

function num(t: string): number {
  const n = parseFloat(t.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}

/** Amount eaten × per-100 values. */
function scale(p: BarcodeProduct["per100"], grams: number) {
  const f = grams / 100;
  return {
    cal: Math.round(p.cal * f),
    protein: Math.round(p.protein * f),
    carbs: Math.round(p.carbs * f),
    fat: Math.round(p.fat * f),
    sugar: p.sugar != null ? Math.round(p.sugar * f) : undefined,
    sodiumMg: p.sodiumMg != null ? Math.round(p.sodiumMg * f) : undefined,
  };
}

/** Scan a packaged product's barcode, or type the code in, and log an amount of it. */
export function BarcodeScanner({
  visible,
  onClose,
  onAdd,
}: {
  visible: boolean;
  onClose: () => void;
  onAdd: (food: ScannedFood) => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<Phase>({ kind: "scan" });
  const [manualCode, setManualCode] = useState("");
  const [grams, setGrams] = useState("100");
  // Label form for products nobody has entered yet.
  const [fName, setFName] = useState("");
  const [fCal, setFCal] = useState("");
  const [fProtein, setFProtein] = useState("");
  const [fCarbs, setFCarbs] = useState("");
  const [fFat, setFFat] = useState("");
  const [share, setShare] = useState(true);
  const lastCode = useRef<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setPhase({ kind: "scan" });
    setManualCode("");
    setGrams("100");
    lastCode.current = null;
    if (Platform.OS !== "web" && permission && !permission.granted && permission.canAskAgain) {
      requestPermission().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const lookup = async (code: string) => {
    const clean = code.replace(/\D/g, "");
    if (clean.length < 8) return;
    setPhase({ kind: "loading", code: clean });
    try {
      const res = await customFetch<{ found: boolean; product?: BarcodeProduct }>(`/api/food/barcode/${clean}`);
      if (res.found && res.product) {
        setGrams(String(res.product.servingGrams ? Math.round(res.product.servingGrams) : 100));
        setPhase({ kind: "found", product: res.product });
      } else {
        setFName("");
        setFCal("");
        setFProtein("");
        setFCarbs("");
        setFFat("");
        setGrams("100");
        setPhase({ kind: "missing", code: clean });
      }
    } catch {
      setPhase({ kind: "error", code: clean, message: "Internet bilan bog'lanib bo'lmadi." });
    }
  };

  const onScanned = (r: BarcodeScanningResult) => {
    if (phase.kind !== "scan" || !r.data || r.data === lastCode.current) return;
    lastCode.current = r.data;
    void lookup(r.data);
  };

  const gramsN = num(grams);
  const unit = phase.kind === "found" ? phase.product.unit : "g";

  const addFound = (p: BarcodeProduct) => {
    if (!Number.isFinite(gramsN) || gramsN <= 0) return;
    const v = scale(p.per100, gramsN);
    onAdd({
      name: p.brand && !p.name.toLowerCase().includes(p.brand.toLowerCase()) ? `${p.name} (${p.brand})` : p.name,
      ...v,
      portion: `${Math.round(gramsN)} ${p.unit}`,
    });
  };

  const formValid =
    fName.trim().length > 0 &&
    Number.isFinite(num(fCal)) &&
    num(fCal) <= 900 &&
    [fProtein, fCarbs, fFat].every((v) => v.trim() === "" || (Number.isFinite(num(v)) && num(v) <= 100)) &&
    Number.isFinite(gramsN) &&
    gramsN > 0;

  const addMissing = (code: string) => {
    if (!formValid) return;
    const per100 = {
      cal: num(fCal),
      protein: num(fProtein) || 0,
      carbs: num(fCarbs) || 0,
      fat: num(fFat) || 0,
      sugar: null,
      sodiumMg: null,
    };
    if (share) {
      customFetch("/api/food/barcode", {
        method: "POST",
        body: JSON.stringify({ code, name: fName.trim(), per100 }),
      }).catch(() => {});
    }
    const v = scale(per100, gramsN);
    onAdd({ name: fName.trim(), ...v, portion: `${Math.round(gramsN)} g` });
  };

  const gramsField = (label: string) => (
    <View style={styles.gramsRow}>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
      <View style={[styles.gramsBox, { backgroundColor: colors.input, borderColor: colors.border }]}>
        <TextInput
          value={grams}
          onChangeText={setGrams}
          keyboardType="decimal-pad"
          style={[styles.gramsInput, { color: colors.text }]}
          selectTextOnFocus
        />
        <Text style={[styles.unit, { color: colors.mutedForeground }]}>{unit}</Text>
      </View>
    </View>
  );

  const labelField = (label: string, value: string, set: (v: string) => void, suffix: string) => (
    <View style={styles.cell}>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
      <View style={[styles.gramsBox, { backgroundColor: colors.input, borderColor: colors.border }]}>
        <TextInput
          value={value}
          onChangeText={set}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.gramsInput, { color: colors.text }]}
        />
        <Text style={[styles.unit, { color: colors.mutedForeground }]}>{suffix}</Text>
      </View>
    </View>
  );

  const canUseCamera = Platform.OS !== "web" && permission?.granted;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={[styles.root, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.header,
            { paddingTop: (Platform.OS === "web" ? 16 : insets.top) + 8, borderBottomColor: colors.border },
          ]}
        >
          <Pressable onPress={onClose} hitSlop={10} style={{ padding: 4 }}>
            <Feather name="x" size={24} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Shtrix-kod</Text>
          <View style={{ width: 32 }} />
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {phase.kind === "scan" ? (
            <>
              {canUseCamera ? (
                <View style={styles.cameraWrap}>
                  <CameraView
                    style={StyleSheet.absoluteFill}
                    facing="back"
                    barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e"] }}
                    onBarcodeScanned={onScanned}
                  />
                  <View style={styles.frame} pointerEvents="none" />
                </View>
              ) : (
                <View style={[styles.noCamera, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Feather name="camera-off" size={28} color={colors.mutedForeground} />
                  <Text style={[styles.hint, { color: colors.mutedForeground, textAlign: "center" }]}>
                    {Platform.OS === "web"
                      ? "Kamera orqali skanerlash faqat telefonda ishlaydi. Kodni pastda qo'lda kiriting."
                      : "Kameraga ruxsat berilmagan. Ruxsat bering yoki kodni qo'lda kiriting."}
                  </Text>
                  {Platform.OS !== "web" && permission && !permission.granted ? (
                    <Pressable
                      onPress={() => requestPermission()}
                      style={[styles.smallBtn, { backgroundColor: colors.primary }]}
                    >
                      <Text style={styles.smallBtnText}>Ruxsat berish</Text>
                    </Pressable>
                  ) : null}
                </View>
              )}
              <Text style={[styles.hint, { color: colors.mutedForeground }]}>
                Mahsulot qadog'idagi shtrix-kodni ramkaga to'g'rilang — avtomatik aniqlanadi.
              </Text>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Yoki kodni kiriting</Text>
              <View style={styles.manualRow}>
                <TextInput
                  value={manualCode}
                  onChangeText={(t) => setManualCode(t.replace(/\D/g, "").slice(0, 14))}
                  keyboardType="number-pad"
                  placeholder="4780000000000"
                  placeholderTextColor={colors.mutedForeground}
                  onSubmitEditing={() => lookup(manualCode)}
                  style={[
                    styles.input,
                    styles.flex1,
                    { backgroundColor: colors.input, borderColor: colors.border, color: colors.text },
                  ]}
                />
                <Pressable
                  onPress={() => lookup(manualCode)}
                  disabled={manualCode.length < 8}
                  accessibilityLabel="Kodni qidirish"
                  style={[
                    styles.searchBtn,
                    { backgroundColor: manualCode.length >= 8 ? colors.primary : colors.mutedForeground },
                  ]}
                >
                  <Feather name="search" size={20} color="#FFFFFF" />
                </Pressable>
              </View>
            </>
          ) : phase.kind === "loading" ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.hint, { color: colors.mutedForeground }]}>{phase.code} qidirilmoqda…</Text>
            </View>
          ) : phase.kind === "found" ? (
            (() => {
              const p = phase.product;
              const v = Number.isFinite(gramsN) ? scale(p.per100, gramsN) : null;
              return (
                <>
                  <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.name, { color: colors.text }]}>{p.name}</Text>
                    {p.brand ? <Text style={[styles.hint, { color: colors.mutedForeground }]}>{p.brand}</Text> : null}
                    <Text style={[styles.per100, { color: colors.mutedForeground }]}>
                      100 {p.unit}: {Math.round(p.per100.cal)} kkal · {p.per100.protein}g B · {p.per100.carbs}g U ·{" "}
                      {p.per100.fat}g Y
                      {p.per100.sugar != null ? tr(" · {0}g qand", p.per100.sugar) : ""}
                    </Text>
                  </View>
                  {gramsField(tr("Qancha iste'mol qildingiz ({0})", p.unit))}
                  <View style={styles.chips}>
                    {[p.servingGrams, 50, 100, 200, 330, 500]
                      .filter((g, i, a): g is number => g != null && g > 0 && a.indexOf(g) === i)
                      .map((g) => (
                        <Pressable
                          key={g}
                          onPress={() => setGrams(String(Math.round(g)))}
                          style={[
                            styles.chip,
                            {
                              backgroundColor: Math.round(gramsN) === Math.round(g) ? colors.primary : colors.secondary,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              { color: Math.round(gramsN) === Math.round(g) ? "#FFFFFF" : colors.text },
                            ]}
                          >
                            {g === p.servingGrams ? tr("1 porsiya ({0})", Math.round(g)) : Math.round(g)}
                          </Text>
                        </Pressable>
                      ))}
                  </View>
                  {v ? (
                    <View style={[styles.total, { backgroundColor: colors.secondary }]}>
                      <Text style={[styles.totalCal, { color: colors.primary }]}>{v.cal} kkal</Text>
                      <Text style={[styles.hint, { color: colors.primary }]}>
                        {v.protein}g oqsil · {v.carbs}g uglevod · {v.fat}g yog'
                        {v.sugar != null ? tr(" · {0}g qand", v.sugar) : ""}
                      </Text>
                    </View>
                  ) : null}
                  <Pressable
                    onPress={() => addFound(p)}
                    disabled={!v || gramsN <= 0}
                    style={({ pressed }) => [
                      styles.primary,
                      { backgroundColor: v && gramsN > 0 ? colors.primary : colors.mutedForeground, opacity: pressed ? 0.85 : 1 },
                    ]}
                  >
                    <Feather name="plus" size={20} color="#FFFFFF" />
                    <Text style={styles.primaryText}>Qo'shish</Text>
                  </Pressable>
                  <Pressable onPress={() => setPhase({ kind: "scan" })} style={styles.link}>
                    <Text style={[styles.linkText, { color: colors.primary }]}>Boshqa mahsulotni skanerlash</Text>
                  </Pressable>
                </>
              );
            })()
          ) : phase.kind === "missing" ? (
            <>
              <View style={[styles.card, { backgroundColor: "#FEF3C7", borderColor: "#FCD34D" }]}>
                <Text style={[styles.name, { color: "#92400E" }]}>Bu mahsulot bazada yo'q</Text>
                <Text style={[styles.hint, { color: "#92400E" }]}>
                  Qadoqdagi "100 g dagi ozuqaviy qiymat" jadvalidan ko'chiring. Kod: {phase.code}
                </Text>
              </View>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Mahsulot nomi</Text>
              <TextInput
                value={fName}
                onChangeText={setFName}
                placeholder="Masalan: Nestle Fitness yorma"
                placeholderTextColor={colors.mutedForeground}
                maxLength={80}
                style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
              />
              <Text style={[styles.section, { color: colors.text }]}>100 g da</Text>
              <View style={styles.grid}>
                {labelField("Kaloriya", fCal, setFCal, "kkal")}
                {labelField("Oqsil", fProtein, setFProtein, "g")}
                {labelField("Uglevod", fCarbs, setFCarbs, "g")}
                {labelField("Yog'", fFat, setFFat, "g")}
              </View>
              {gramsField("Qancha iste'mol qildingiz (g)")}
              <View style={[styles.shareRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.flex1}>
                  <Text style={[styles.shareTitle, { color: colors.text }]}>Boshqalar uchun ham saqlash</Text>
                  <Text style={[styles.hint, { color: colors.mutedForeground }]}>
                    Keyingi safar bu kodni skanerlagan har kim uni topadi.
                  </Text>
                </View>
                <Switch value={share} onValueChange={setShare} trackColor={{ true: colors.primary, false: colors.border }} />
              </View>
              <Pressable
                onPress={() => addMissing(phase.code)}
                disabled={!formValid}
                style={({ pressed }) => [
                  styles.primary,
                  { backgroundColor: formValid ? colors.primary : colors.mutedForeground, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Feather name="plus" size={20} color="#FFFFFF" />
                <Text style={styles.primaryText}>Qo'shish</Text>
              </Pressable>
            </>
          ) : (
            <View style={styles.center}>
              <Feather name="wifi-off" size={28} color={colors.destructive} />
              <Text style={[styles.hint, { color: colors.text }]}>{phase.message}</Text>
              <Pressable onPress={() => lookup(phase.code)} style={[styles.smallBtn, { backgroundColor: colors.primary }]}>
                <Text style={styles.smallBtnText}>Qayta urinish</Text>
              </Pressable>
              <Pressable onPress={() => setPhase({ kind: "scan" })} style={styles.link}>
                <Text style={[styles.linkText, { color: colors.primary }]}>Orqaga</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
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
  body: { padding: 20, gap: 12, paddingBottom: 48 },
  cameraWrap: { height: 300, borderRadius: 20, overflow: "hidden", backgroundColor: "#000", justifyContent: "center", alignItems: "center" },
  frame: { width: "78%", height: 120, borderWidth: 3, borderColor: "#FFFFFF", borderRadius: 16 },
  noCamera: { borderRadius: 20, borderWidth: 1, padding: 24, alignItems: "center", gap: 10 },
  hint: { fontSize: 12.5, fontFamily: "Inter_400Regular", lineHeight: 18 },
  label: { fontSize: 12, fontFamily: "Inter_500Medium" },
  section: { fontSize: 15, fontFamily: "Inter_700Bold", marginTop: 4 },
  manualRow: { flexDirection: "row", gap: 8 },
  input: { height: 50, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, fontSize: 16, fontFamily: "Inter_600SemiBold" },
  searchBtn: { width: 50, height: 50, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  center: { alignItems: "center", gap: 12, paddingVertical: 60 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 4 },
  name: { fontSize: 17, fontFamily: "Inter_700Bold" },
  per100: { fontSize: 12.5, fontFamily: "Inter_500Medium", marginTop: 4 },
  gramsRow: { gap: 6 },
  gramsBox: { flexDirection: "row", alignItems: "center", height: 50, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14 },
  gramsInput: { flex: 1, minWidth: 0, fontSize: 18, fontFamily: "Inter_700Bold", paddingVertical: 0 },
  unit: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 },
  chipText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  total: { borderRadius: 14, padding: 14, gap: 2 },
  totalCal: { fontSize: 22, fontFamily: "Inter_700Bold" },
  primary: { flexDirection: "row", height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center", gap: 8 },
  primaryText: { color: "#FFFFFF", fontSize: 16, fontFamily: "Inter_700Bold" },
  link: { alignSelf: "center", paddingVertical: 8 },
  linkText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  smallBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20 },
  smallBtnText: { color: "#FFFFFF", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  cell: { flexBasis: "46%", flexGrow: 1, gap: 6 },
  shareRow: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 14, borderWidth: 1, padding: 14 },
  shareTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
});
