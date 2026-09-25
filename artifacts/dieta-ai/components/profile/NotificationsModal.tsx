import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { UserProfile } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import {
  getDailySummaryTime,
  getMealSchedule,
  getMorningTime,
  getPermissionStatus,
  getWaterSchedule,
  openSystemSettings,
  requestPermissionWithRationale,
  sendTestNotification,
  type PermissionStatus,
} from "@/lib/notifications";

function formatHm(h: number, m: number) {
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Full-screen reminder settings, opened from a single row on the profile. */
export function NotificationsModal({
  visible,
  onClose,
  profile,
  setProfile,
  onPermissionChange,
}: {
  visible: boolean;
  onClose: () => void;
  profile: Partial<UserProfile>;
  setProfile: (updates: Partial<UserProfile>) => void;
  /** Lets the profile row show "blocked" without re-querying. */
  onPermissionChange?: (status: PermissionStatus) => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const notifEnabled = profile.notificationsEnabled !== false;
  const mealEnabled = profile.mealRemindersEnabled !== false;
  const waterEnabled = profile.waterRemindersEnabled !== false;
  const summaryEnabled = profile.dailySummaryEnabled !== false;
  const morningEnabled = profile.morningGreetingEnabled !== false;
  const mealSlots = getMealSchedule(profile.mealsPerDay ?? 3);
  const waterSlots = getWaterSchedule();
  const summaryTime = getDailySummaryTime();
  const morningTime = getMorningTime();

  const [permStatus, setPermStatus] = useState<PermissionStatus>("undetermined");
  const refreshPerm = useCallback(async () => {
    const st = await getPermissionStatus();
    setPermStatus(st);
    onPermissionChange?.(st);
  }, [onPermissionChange]);
  useEffect(() => {
    if (visible) refreshPerm();
  }, [visible, refreshPerm, notifEnabled]);

  const handlePermissionFix = async () => {
    if (Platform.OS === "web") return;
    if (permStatus === "denied") {
      Alert.alert(
        "Eslatmalar bloklangan",
        "Ilova sozlamalaridan bildirishnomalarga ruxsat bering. Aks holda eslatmalar yetib bormaydi.",
        [
          { text: "Bekor qilish", style: "cancel" },
          { text: "Sozlamalarni ochish", onPress: () => openSystemSettings() },
        ],
      );
    } else {
      const ok = await requestPermissionWithRationale();
      await refreshPerm();
      // Re-setting a reminder key re-runs scheduling now that permission exists.
      if (ok) setProfile({ notificationsEnabled: true });
    }
  };

  const handleTestNotification = async () => {
    if (Platform.OS === "web") {
      Alert.alert("Mavjud emas", "Sinov bildirishnomasi faqat haqiqiy qurilmada ishlaydi.");
      return;
    }
    const ok = await sendTestNotification();
    await refreshPerm();
    if (ok) {
      Alert.alert(
        "Sinov yuborildi",
        "5 soniyadan so'ng bildirishnoma keladi. Ilovani yopib (yoki orqa fonga olib) kuting.",
      );
    } else {
      Alert.alert(
        "Yuborilmadi",
        "Bildirishnomalar uchun ruxsat yo'q. Avval ruxsat bering yoki sozlamalardan oching.",
        [
          { text: "Yopish", style: "cancel" },
          { text: "Sozlamalarni ochish", onPress: () => openSystemSettings() },
        ],
      );
    }
  };

  const toggleNotifications = async (value: boolean) => {
    if (value && Platform.OS !== "web") {
      // Ask first so the reschedule triggered by setProfile can succeed.
      await requestPermissionWithRationale();
      await refreshPerm();
    }
    setProfile({ notificationsEnabled: value });
  };
  const toggleMeal = (value: boolean) => setProfile({ mealRemindersEnabled: value });
  const toggleWater = (value: boolean) => setProfile({ waterRemindersEnabled: value });
  const toggleSummary = (value: boolean) => setProfile({ dailySummaryEnabled: value });
  const toggleMorning = (value: boolean) => setProfile({ morningGreetingEnabled: value });

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
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
          <Text style={[styles.headerTitle, { color: colors.text }]}>Eslatmalar</Text>
          <View style={{ width: 32 }} />
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32 }}
          showsVerticalScrollIndicator={false}
        >
          {Platform.OS !== "web" && notifEnabled && permStatus === "denied" && (
            <Pressable
              onPress={handlePermissionFix}
              style={[
                styles.permBanner,
                { backgroundColor: "#FEF2F2", borderColor: "#FCA5A5" },
              ]}
            >
              <Feather name="alert-triangle" size={18} color="#B91C1C" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.permTitle, { color: "#991B1B" }]}>
                  Bildirishnomalar bloklangan
                </Text>
                <Text style={[styles.permSub, { color: "#991B1B" }]}>
                  Eslatmalar yetib bormaydi. Sozlamalardan ruxsat bering.
                </Text>
              </View>
              <Feather name="chevron-right" size={20} color="#991B1B" />
            </Pressable>
          )}

          {Platform.OS !== "web" && notifEnabled && permStatus === "undetermined" && (
            <Pressable
              onPress={handlePermissionFix}
              style={[
                styles.permBanner,
                { backgroundColor: colors.secondary, borderColor: colors.primary },
              ]}
            >
              <Feather name="bell" size={18} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.permTitle, { color: colors.primary }]}>
                  Eslatmalarga ruxsat bering
                </Text>
                <Text style={[styles.permSub, { color: colors.primary }]}>
                  Bosing va ruxsat oynasini tasdiqlang.
                </Text>
              </View>
              <Feather name="chevron-right" size={20} color={colors.primary} />
            </Pressable>
          )}

          <View
            style={[
              styles.notifCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={styles.notifHeader}>
              <View style={[styles.settingIcon, { backgroundColor: colors.secondary }]}>
                <Feather name="bell" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.notifTitle, { color: colors.text }]}>
                  Barcha eslatmalar
                </Text>
                <Text style={[styles.notifSub, { color: colors.mutedForeground }]}>
                  {notifEnabled
                    ? "Asosiy o'chirgich — pastdagi turlarni boshqaring"
                    : "O'chirilgan — barcha eslatmalar to'xtaydi"}
                </Text>
              </View>
              <Switch
                value={notifEnabled}
                onValueChange={toggleNotifications}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          {notifEnabled && (
            <>
              <View
                style={[
                  styles.notifCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <View style={styles.notifHeader}>
                  <View style={[styles.settingIcon, { backgroundColor: colors.secondary }]}>
                    <Feather name="coffee" size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.notifTitle, { color: colors.text }]}>
                      Ovqat eslatmalari
                    </Text>
                    <Text style={[styles.notifSub, { color: colors.mutedForeground }]}>
                      {mealEnabled
                        ? `Kuniga ${mealSlots.length} marta eslatma yuboriladi`
                        : "O'chirilgan"}
                    </Text>
                  </View>
                  <Switch
                    value={mealEnabled}
                    onValueChange={toggleMeal}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor="#FFFFFF"
                  />
                </View>
                {mealEnabled && (
                  <View style={styles.timeChips}>
                    {mealSlots.map((s, i) => (
                      <View
                        key={i}
                        style={[
                          styles.timeChip,
                          { backgroundColor: colors.secondary, borderColor: colors.primary },
                        ]}
                      >
                        <Feather name="clock" size={11} color={colors.primary} />
                        <Text style={[styles.timeText, { color: colors.primary }]}>
                          {formatHm(s.hour, s.minute)}
                        </Text>
                        <Text style={[styles.timeLabel, { color: colors.primary }]}>
                          {s.label}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              <View
                style={[
                  styles.notifCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <View style={styles.notifHeader}>
                  <View style={[styles.settingIcon, { backgroundColor: "#DBEAFE" }]}>
                    <Feather name="droplet" size={18} color="#2563EB" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.notifTitle, { color: colors.text }]}>
                      Suv eslatmasi
                    </Text>
                    <Text style={[styles.notifSub, { color: colors.mutedForeground }]}>
                      {waterEnabled
                        ? `Kuniga ${waterSlots.length} marta — suv ichishni unutmang`
                        : "O'chirilgan"}
                    </Text>
                  </View>
                  <Switch
                    value={waterEnabled}
                    onValueChange={toggleWater}
                    trackColor={{ false: colors.border, true: "#2563EB" }}
                    thumbColor="#FFFFFF"
                  />
                </View>
                {waterEnabled && (
                  <View style={styles.timeChips}>
                    {waterSlots.map((s, i) => (
                      <View
                        key={i}
                        style={[
                          styles.timeChip,
                          { backgroundColor: "#DBEAFE", borderColor: "#2563EB" },
                        ]}
                      >
                        <Feather name="clock" size={11} color="#2563EB" />
                        <Text style={[styles.timeText, { color: "#2563EB" }]}>
                          {formatHm(s.hour, s.minute)}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              <View
                style={[
                  styles.notifCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <View style={styles.notifHeader}>
                  <View style={[styles.settingIcon, { backgroundColor: "#EDE9FE" }]}>
                    <Feather name="moon" size={18} color="#7C3AED" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.notifTitle, { color: colors.text }]}>
                      Kunni yopish
                    </Text>
                    <Text style={[styles.notifSub, { color: colors.mutedForeground }]}>
                      {summaryEnabled
                        ? `Har kuni ${formatHm(summaryTime.hour, summaryTime.minute)} da`
                        : "O'chirilgan"}
                    </Text>
                  </View>
                  <Switch
                    value={summaryEnabled}
                    onValueChange={toggleSummary}
                    trackColor={{ false: colors.border, true: "#7C3AED" }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              </View>

              <View
                style={[
                  styles.notifCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <View style={styles.notifHeader}>
                  <View style={[styles.settingIcon, { backgroundColor: "#FEF3C7" }]}>
                    <Feather name="sun" size={18} color="#E07A1F" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.notifTitle, { color: colors.text }]}>
                      Ertalabki motivatsiya
                    </Text>
                    <Text style={[styles.notifSub, { color: colors.mutedForeground }]}>
                      {morningEnabled
                        ? `Har kuni ${formatHm(morningTime.hour, morningTime.minute)} da`
                        : "O'chirilgan"}
                    </Text>
                  </View>
                  <Switch
                    value={morningEnabled}
                    onValueChange={toggleMorning}
                    trackColor={{ false: colors.border, true: "#E07A1F" }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              </View>

              {Platform.OS !== "web" && (
                <TouchableOpacity
                  onPress={handleTestNotification}
                  activeOpacity={0.85}
                  style={[
                    styles.testBtn,
                    { backgroundColor: colors.secondary, borderColor: colors.primary },
                  ]}
                >
                  <Feather name="zap" size={16} color={colors.primary} />
                  <Text style={[styles.testBtnText, { color: colors.primary }]}>
                    Sinov bildirishnomasini yuborish (5 soniya)
                  </Text>
                </TouchableOpacity>
              )}

              {Platform.OS === "android" && (
                <View style={[styles.batteryHint, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Feather name="info" size={14} color={colors.mutedForeground} />
                  <Text style={[styles.batteryHintText, { color: colors.mutedForeground }]}>
                    Xiaomi, Samsung yoki Huawei qurilmalarida eslatma kelmasa,
                    Sozlamalar → Ilovalar → UzDieta AI → Batareya bo'limidan
                    &quot;Cheklanmagan&quot; rejimini yoqing.
                  </Text>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  settingIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  notifCard: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 8, gap: 12 },
  notifHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  notifTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  notifSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  timeChips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  timeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  timeText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  timeLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },
  permBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  permTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  permSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  testBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    marginBottom: 8,
  },
  testBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  batteryHint: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    marginBottom: 8,
  },
  batteryHintText: { fontSize: 11, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 16 },
});
