import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import {
  applyBackup,
  backupErrorMessage,
  backupItemCount,
  backupNow,
  fetchBackup,
  getBackupCode,
  getBackupMeta,
  normalizeBackupCode,
} from "@/lib/backup";
import { confirmAction } from "@/lib/confirm";

function fmtTime(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * Cloud backup: turn it on (creates a secret code), back up now, or restore
 * from a code on a new phone. `restoreOnly` hides the backup half (used
 * before onboarding, when there is nothing to back up yet).
 */
export function BackupModal({
  visible,
  onClose,
  restoreOnly,
  onRestored,
}: {
  visible: boolean;
  onClose: () => void;
  restoreOnly?: boolean;
  onRestored?: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { reloadFromStorage } = useApp();
  const [code, setCode] = useState<string | null>(null);
  const [lastAt, setLastAt] = useState<number | undefined>(undefined);
  const [busy, setBusy] = useState<"backup" | "restore" | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [restoreText, setRestoreText] = useState("");

  useEffect(() => {
    if (!visible) return;
    setMessage(null);
    setRestoreText("");
    getBackupCode().then(setCode).catch(() => {});
    getBackupMeta().then((m) => setLastAt(m.lastBackupAt)).catch(() => {});
  }, [visible]);

  const doBackup = async () => {
    setBusy("backup");
    setMessage(null);
    try {
      const r = await backupNow();
      setCode(r.code);
      setLastAt(r.at);
      setMessage({ ok: true, text: "Zaxira saqlandi." });
    } catch (err) {
      setMessage({ ok: false, text: backupErrorMessage(err) });
    } finally {
      setBusy(null);
    }
  };

  const doRestore = async () => {
    const normalized = normalizeBackupCode(restoreText);
    if (!normalized) {
      setMessage({ ok: false, text: "Kod UZD-XXXX-XXXX-XXXX-XXXX ko'rinishida bo'lishi kerak." });
      return;
    }
    setBusy("restore");
    setMessage(null);
    try {
      const { payload, updatedAt } = await fetchBackup(normalized);
      const { entries, days } = backupItemCount(payload);
      const ok = await confirmAction({
        title: "Zaxiradan tiklash",
        message: `${fmtTime(new Date(updatedAt).getTime())} dagi zaxira: ${entries} ta ovqat yozuvi, ${days} kun. Shu telefondagi hozirgi ma'lumotlar uning o'rniga almashtiriladi.`,
        confirmText: "Tiklash",
        destructive: !restoreOnly,
      });
      if (!ok) return;
      await applyBackup(normalized, payload);
      await reloadFromStorage();
      setCode(normalized);
      setMessage({ ok: true, text: "Ma'lumotlar tiklandi." });
      onRestored?.();
    } catch (err) {
      setMessage({ ok: false, text: backupErrorMessage(err) });
    } finally {
      setBusy(null);
    }
  };

  const shareCode = () => {
    if (!code) return;
    Share.share({
      message: `UzDieta AI zaxira kodim: ${code}\nYangi telefonda Profil → Zaxira nusxa → Tiklash orqali kiriting.`,
    }).catch(() => {});
  };

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
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {restoreOnly ? "Zaxiradan tiklash" : "Zaxira nusxa"}
          </Text>
          <View style={{ width: 32 }} />
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {message ? (
            <View
              style={[
                styles.message,
                { backgroundColor: message.ok ? "#DCFCE7" : "#FEE2E2" },
              ]}
            >
              <Feather name={message.ok ? "check-circle" : "alert-circle"} size={16} color={message.ok ? "#166534" : "#991B1B"} />
              <Text style={[styles.messageText, { color: message.ok ? "#166534" : "#991B1B" }]}>{message.text}</Text>
            </View>
          ) : null}

          {!restoreOnly ? (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.cardHead}>
                <View style={[styles.icon, { backgroundColor: colors.secondary }]}>
                  <Feather name="upload-cloud" size={20} color={colors.primary} />
                </View>
                <View style={styles.flex1}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>
                    {code ? "Zaxira yoqilgan" : "Ma'lumotlaringizni saqlab qo'ying"}
                  </Text>
                  <Text style={[styles.hint, { color: colors.mutedForeground }]}>
                    {code
                      ? lastAt
                        ? `Oxirgi saqlash: ${fmtTime(lastAt)} · ilova yopilganda o'zi yangilanadi`
                        : "Hali saqlanmagan"
                      : "Ovqat tarixi, vazn, suv, taomlaringiz va sozlamalar serverga yoziladi. Telefon almashsa, kod bilan qaytarasiz."}
                  </Text>
                </View>
              </View>

              {code ? (
                <>
                  <Text style={[styles.label, { color: colors.mutedForeground }]}>Zaxira kodingiz</Text>
                  <View style={[styles.codeBox, { backgroundColor: colors.secondary, borderColor: colors.primary }]}>
                    <Text style={[styles.code, { color: colors.primary }]} selectable>
                      {code}
                    </Text>
                  </View>
                  <Text style={[styles.warn]}>
                    Bu kodni yozib qo'ying yoki o'zingizga yuboring. Kodsiz ma'lumotni tiklab bo'lmaydi, uni hech kimga
                    bermang.
                  </Text>
                  <View style={styles.row}>
                    <Pressable
                      onPress={shareCode}
                      style={({ pressed }) => [
                        styles.secondaryBtn,
                        { borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
                      ]}
                    >
                      <Feather name="share-2" size={16} color={colors.text} />
                      <Text style={[styles.secondaryText, { color: colors.text }]}>Kodni yuborish</Text>
                    </Pressable>
                    <Pressable
                      onPress={doBackup}
                      disabled={busy !== null}
                      style={({ pressed }) => [
                        styles.secondaryBtn,
                        { borderColor: colors.primary, opacity: pressed ? 0.8 : 1 },
                      ]}
                    >
                      {busy === "backup" ? (
                        <ActivityIndicator color={colors.primary} />
                      ) : (
                        <>
                          <Feather name="refresh-cw" size={16} color={colors.primary} />
                          <Text style={[styles.secondaryText, { color: colors.primary }]}>Hozir saqlash</Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                </>
              ) : (
                <Pressable
                  onPress={doBackup}
                  disabled={busy !== null}
                  style={({ pressed }) => [styles.primary, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
                >
                  {busy === "backup" ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryText}>Zaxirani yoqish</Text>
                  )}
                </Pressable>
              )}
            </View>
          ) : null}

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardHead}>
              <View style={[styles.icon, { backgroundColor: "#DBEAFE" }]}>
                <Feather name="download-cloud" size={20} color="#2563EB" />
              </View>
              <View style={styles.flex1}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>Boshqa telefondan tiklash</Text>
                <Text style={[styles.hint, { color: colors.mutedForeground }]}>
                  Avvalgi telefonda ko'rsatilgan zaxira kodini kiriting.
                </Text>
              </View>
            </View>
            <TextInput
              value={restoreText}
              onChangeText={setRestoreText}
              placeholder="UZD-XXXX-XXXX-XXXX-XXXX"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="characters"
              autoCorrect={false}
              style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
            />
            <Pressable
              onPress={doRestore}
              disabled={busy !== null || restoreText.trim().length === 0}
              style={({ pressed }) => [
                styles.primary,
                {
                  backgroundColor: restoreText.trim() ? "#2563EB" : colors.mutedForeground,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              {busy === "restore" ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>Tiklash</Text>}
            </Pressable>
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              Premium zaxiradan tiklanmaydi — uni botdan olingan login va parol bilan tiklang. Ovqat rasmlari faqat eski
              telefonda qoladi.
            </Text>
          </View>
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
  body: { padding: 20, gap: 14, paddingBottom: 48 },
  message: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, padding: 12 },
  messageText: { flex: 1, fontSize: 13, fontFamily: "Inter_600SemiBold" },
  card: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 12 },
  cardHead: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  icon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: 15.5, fontFamily: "Inter_700Bold" },
  hint: { fontSize: 12.5, fontFamily: "Inter_400Regular", lineHeight: 18, marginTop: 2 },
  label: { fontSize: 12, fontFamily: "Inter_500Medium" },
  codeBox: { borderRadius: 14, borderWidth: 1.5, borderStyle: "dashed", paddingVertical: 14, alignItems: "center" },
  code: { fontSize: 18, fontFamily: "Inter_700Bold", letterSpacing: 1 },
  warn: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#B45309", lineHeight: 17 },
  row: { flexDirection: "row", gap: 10 },
  secondaryBtn: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    borderWidth: 1.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondaryText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  primary: { height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center" },
  primaryText: { color: "#FFFFFF", fontSize: 15.5, fontFamily: "Inter_700Bold" },
  input: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
  },
});
