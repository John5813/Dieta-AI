import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { calculatePlan } from "@/lib/nutrition";
import {
  getMealSchedule,
  getWaterSchedule,
  getDailySummaryTime,
  getMorningTime,
  getPermissionStatus,
  openSystemSettings,
  requestPermissionWithRationale,
  sendTestNotification,
  type PermissionStatus,
} from "@/lib/notifications";

type EditField = "currentWeight" | "targetWeight" | null;

const SPEED_OPTIONS = [
  { value: 0.25, label: "0.25 kg", desc: "Sekin va qulay" },
  { value: 0.5, label: "0.5 kg", desc: "Tavsiya etilgan" },
  { value: 0.75, label: "0.75 kg", desc: "Tezroq natija" },
  { value: 1.0, label: "1.0 kg", desc: "Maksimal — qiyin" },
];

const ACTIVITY_OPTIONS: Array<{
  value: number;
  label: string;
  desc: string;
  icon: keyof typeof Feather.glyphMap;
}> = [
  { value: 1.2, label: "Kam harakatli", desc: "Ko'p o'tirib ishlash, deyarli sport yo'q", icon: "monitor" },
  { value: 1.375, label: "Yengil faol", desc: "Haftada 1–3 marta yengil mashq", icon: "wind" },
  { value: 1.55, label: "O'rtacha faol", desc: "Haftada 3–5 marta o'rta mashq", icon: "activity" },
  { value: 1.725, label: "Juda faol", desc: "Deyarli har kuni intensiv mashq", icon: "zap" },
  { value: 1.9, label: "Sportchi", desc: "Kuniga 2 marta mashq, og'ir ish", icon: "award" },
];

const MEAL_OPTIONS = [
  { value: 2, label: "2 mahal", desc: "Nonushta va kechki ovqat" },
  { value: 3, label: "3 mahal", desc: "Klassik tartib" },
  { value: 4, label: "4 mahal", desc: "Kichik gazaklar bilan" },
  { value: 5, label: "5 mahal", desc: "Tez-tez va kam-kam" },
  { value: 6, label: "6 mahal", desc: "Sportchilar uchun" },
];

function formatHm(h: number, m: number) {
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function SettingRow({
  icon,
  label,
  value,
  onPress,
  danger,
}: {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
}) {
  const colors = useColors();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.settingRow, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <View style={[styles.settingIcon, { backgroundColor: danger ? "#FEE2E2" : colors.secondary }]}>
        <Feather
          name={icon as keyof typeof Feather.glyphMap}
          size={18}
          color={danger ? colors.destructive : colors.primary}
        />
      </View>
      <Text
        style={[
          styles.settingLabel,
          { color: danger ? colors.destructive : colors.text },
        ]}
      >
        {label}
      </Text>
      <View style={{ flex: 1 }} />
      {value ? (
        <Text style={[styles.settingValue, { color: colors.mutedForeground }]}>{value}</Text>
      ) : null}
      {!danger && <Feather name="chevron-right" size={16} color={colors.mutedForeground} />}
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const { profile, setProfile, resetApp, entries, removeEntry } = useApp();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [editField, setEditField] = useState<EditField>(null);
  const [bmiOpen, setBmiOpen] = useState(false);
  const [speedOpen, setSpeedOpen] = useState(false);
  const [mealsOpen, setMealsOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const notifEnabled = profile.notificationsEnabled !== false;
  const mealEnabled = profile.mealRemindersEnabled !== false;
  const waterEnabled = profile.waterRemindersEnabled !== false;
  const summaryEnabled = profile.dailySummaryEnabled !== false;
  const morningEnabled = profile.morningGreetingEnabled !== false;
  const mealsCount = profile.mealsPerDay ?? 3;
  const mealSlots = getMealSchedule(mealsCount);
  const waterSlots = getWaterSchedule();
  const summaryTime = getDailySummaryTime();
  const morningTime = getMorningTime();

  const [permStatus, setPermStatus] = useState<PermissionStatus>("undetermined");
  const refreshPerm = React.useCallback(async () => {
    const s = await getPermissionStatus();
    setPermStatus(s);
  }, []);
  useEffect(() => {
    refreshPerm();
  }, [refreshPerm, notifEnabled, waterEnabled, summaryEnabled, morningEnabled]);

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
      if (ok) {
        // Ruxsat berilgandan so'ng eslatmalar darhol qayta rejalashtirilsin.
        // setProfile orqali bir qiymatni qayta o'rnatamiz — bu reschedule
        // effektini qayta ishga tushiradi (notifications.ts endi getPermission
        // tekshiradi va granted holatida muvaffaqiyatli rejalashtiradi).
        setProfile({ notificationsEnabled: true });
      }
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

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 100 : insets.bottom + 80;

  const MONTHS = [
    "yanvar","fevral","mart","aprel","may","iyun",
    "iyul","avgust","sentabr","oktabr","noyabr","dekabr",
  ];

  const doResetAndRedirect = async () => {
    await resetApp();
    router.replace("/onboarding/gender");
  };

  const handleReset = () => {
    if (Platform.OS === "web") {
      doResetAndRedirect();
      return;
    }
    Alert.alert(
      "Ilovani tiklash",
      "Barcha ma'lumotlar o'chiriladi. Davom etasizmi?",
      [
        { text: "Bekor qilish", style: "cancel" },
        { text: "Ha, o'chirish", style: "destructive", onPress: doResetAndRedirect },
      ]
    );
  };

  const handleLogout = () => {
    setPrivacyOpen(false);
    if (Platform.OS === "web") {
      doResetAndRedirect();
      return;
    }
    Alert.alert(
      "Akauntdan chiqish",
      "Akauntingizdan chiqasizmi? Qayta kirish uchun ma'lumotlaringizni qaytadan kiritishingiz kerak bo'ladi.",
      [
        { text: "Bekor qilish", style: "cancel" },
        { text: "Chiqish", style: "destructive", onPress: doResetAndRedirect },
      ]
    );
  };

  const handleDeleteAccount = () => {
    setPrivacyOpen(false);
    if (Platform.OS === "web") {
      doResetAndRedirect();
      return;
    }
    Alert.alert(
      "Akauntni o'chirish",
      "DIQQAT! Akauntingiz, barcha ma'lumotlaringiz (ovqat tarixi, mashqlar, sozlamalar) va Premium obuna ham butunlay o'chiriladi. Bu amalni qaytarib bo'lmaydi.",
      [
        { text: "Bekor qilish", style: "cancel" },
        {
          text: "Ha, o'chirish",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Tasdiqlash",
              "Rostan ham akauntni va Premium obunani butunlay o'chirmoqchimisiz?",
              [
                { text: "Yo'q", style: "cancel" },
                { text: "Ha, o'chirish", style: "destructive", onPress: doResetAndRedirect },
              ]
            );
          },
        },
      ]
    );
  };

  const saveActivity = (value: number) => {
    const next = { ...profile, activityLevel: value };
    const newPlan = calculatePlan(next);
    setProfile({
      activityLevel: value,
      dailyCalories: newPlan.calories,
      protein: newPlan.protein,
      carbs: newPlan.carbs,
      fat: newPlan.fat,
    });
    setActivityOpen(false);
  };

  const activityLabel =
    ACTIVITY_OPTIONS.find((o) => Math.abs(o.value - (profile.activityLevel ?? 1.375)) < 0.001)
      ?.label ?? "Yengil faol";

  const plan = calculatePlan(profile);
  const bmi = profile.currentWeight && profile.height ? plan.bmi : null;
  const bmiCategory = bmi ? plan.bmiCategory : "—";

  const saveEdit = (field: "currentWeight" | "targetWeight", value: number) => {
    const next = { ...profile, [field]: value };
    const newPlan = calculatePlan(next);
    setProfile({
      [field]: value,
      dailyCalories: newPlan.calories,
      protein: newPlan.protein,
      carbs: newPlan.carbs,
      fat: newPlan.fat,
    });
    setEditField(null);
  };

  const saveSpeed = (value: number) => {
    const next = { ...profile, speedKgPerWeek: value };
    const newPlan = calculatePlan(next);
    setProfile({
      speedKgPerWeek: value,
      dailyCalories: newPlan.calories,
      protein: newPlan.protein,
      carbs: newPlan.carbs,
      fat: newPlan.fat,
    });
    setSpeedOpen(false);
  };

  const saveMeals = (value: number) => {
    setProfile({ mealsPerDay: value });
    setMealsOpen(false);
  };

  const toggleNotifications = async (value: boolean) => {
    if (value && Platform.OS !== "web") {
      // Avval ruxsat — keyin profil yangilanadi (reschedule muvaffaqiyatli ishlasin)
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
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: topPad + 16, paddingBottom: bottomPad },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileHeader}>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Feather name="user" size={36} color={colors.primaryForeground} />
          </View>
          <Text style={[styles.phone, { color: colors.text }]}>
            {profile.phone ? `+998 ${profile.phone}` : "Foydalanuvchi"}
          </Text>
          <View style={[styles.goalBadge, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.goalText, { color: colors.primary }]}>
              {profile.goal === "ozish"
                ? "Ozish"
                : profile.goal === "oshirish"
                ? "Vazn oshirish"
                : "Vaznni saqlash"}
            </Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <StatCard
            label="Hozirgi vazn"
            value={profile.currentWeight ? `${profile.currentWeight} kg` : "—"}
            hint="O'zgartirish"
            icon="edit-2"
            onPress={() => setEditField("currentWeight")}
            colors={colors}
          />
          <StatCard
            label="Haftalik maqsad"
            value={`${parseFloat((profile.speedKgPerWeek ?? 0.5).toFixed(2))} kg`}
            hint="O'zgartirish"
            icon="edit-2"
            onPress={() => setSpeedOpen(true)}
            colors={colors}
          />
          <StatCard
            label="Yakuniy maqsad"
            value={profile.targetWeight ? `${profile.targetWeight} kg` : "—"}
            hint="O'zgartirish"
            icon="edit-2"
            onPress={() => setEditField("targetWeight")}
            colors={colors}
          />
          <StatCard
            label="BMI"
            value={bmi ? bmi.toFixed(1) : "—"}
            hint={bmiCategory}
            icon="info"
            onPress={() => setBmiOpen(true)}
            colors={colors}
          />
        </View>

        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>Ma'lumotlar</Text>
        <SettingRow
          icon="user"
          label="Jins"
          value={profile.gender === "erkak" ? "Erkak" : profile.gender === "ayol" ? "Ayol" : "—"}
        />
        <SettingRow
          icon="calendar"
          label="Tug'ilgan sana"
          value={
            profile.birthDate
              ? `${MONTHS[profile.birthDate.month]} ${profile.birthDate.day}, ${profile.birthDate.year}`
              : "—"
          }
        />
        <SettingRow
          icon="zap"
          label="Kunlik kaloriya"
          value={`${profile.dailyCalories ?? "—"} kal`}
        />
        <SettingRow
          icon="activity"
          label="Faollik darajasi"
          value={activityLabel}
          onPress={() => setActivityOpen(true)}
        />

        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>Eslatmalar</Text>

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
                  Sozlamalar → Ilovalar → Bir Burda → Batareya bo'limidan
                  &quot;Cheklanmagan&quot; rejimini yoqing.
                </Text>
              </View>
            )}
          </>
        )}

        <SettingRow
          icon="coffee"
          label="Ovqatlanish soni"
          value={`${mealsCount} mahal`}
          onPress={() => setMealsOpen(true)}
        />

        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>Sozlamalar</Text>
        <SettingRow icon="globe" label="Til" value="O'zbekcha" />
        <SettingRow
          icon="shield"
          label="Maxfiylik va xavfsizlik"
          onPress={() => setPrivacyOpen(true)}
        />

        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>Ma'lumotlar tarixi</Text>
        <SettingRow
          icon="clock"
          label="Ovqatlanish tarixi"
          value={entries.length > 0 ? `${entries.length} yozuv` : undefined}
          onPress={() => setHistoryOpen(true)}
        />

        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>Xavfli zona</Text>
        <SettingRow
          icon="refresh-ccw"
          label="Ilovani tiklash"
          onPress={handleReset}
          danger
        />
      </ScrollView>

      <NumberEditModal
        visible={editField !== null}
        field={editField}
        currentValue={
          editField === "currentWeight"
            ? profile.currentWeight
            : editField === "targetWeight"
              ? profile.targetWeight
              : undefined
        }
        onClose={() => setEditField(null)}
        onSave={saveEdit}
        colors={colors}
      />

      <BmiInfoModal
        visible={bmiOpen}
        bmi={bmi}
        category={bmiCategory}
        onClose={() => setBmiOpen(false)}
        colors={colors}
      />

      <SpeedPickerModal
        visible={speedOpen}
        current={profile.speedKgPerWeek ?? 0.5}
        onClose={() => setSpeedOpen(false)}
        onSave={saveSpeed}
        colors={colors}
      />

      <MealsPickerModal
        visible={mealsOpen}
        current={mealsCount}
        onClose={() => setMealsOpen(false)}
        onSave={saveMeals}
        colors={colors}
      />

      <ActivityPickerModal
        visible={activityOpen}
        current={profile.activityLevel ?? 1.375}
        onClose={() => setActivityOpen(false)}
        onSave={saveActivity}
        colors={colors}
      />

      <PrivacyModal
        visible={privacyOpen}
        onClose={() => setPrivacyOpen(false)}
        onLogout={handleLogout}
        onDeleteAccount={handleDeleteAccount}
        colors={colors}
      />

      <HistoryModal
        visible={historyOpen}
        onClose={() => setHistoryOpen(false)}
        entries={entries}
        onRemoveEntry={removeEntry}
        colors={colors}
      />
    </View>
  );
}

function HistoryModal({
  visible,
  onClose,
  entries,
  onRemoveEntry,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  entries: import("@/context/AppContext").DiaryEntry[];
  onRemoveEntry: (id: string) => void;
  colors: ReturnType<typeof useColors>;
}) {
  const insets = useSafeAreaInsets();

  const handleDelete = (id: string, name: string) => {
    Alert.alert(
      "Yozuvni o'chirish",
      `"${name}" yozuvini o'chirmoqchimisiz?`,
      [
        { text: "Bekor qilish", style: "cancel" },
        { text: "O'chirish", style: "destructive", onPress: () => onRemoveEntry(id) },
      ],
    );
  };

  const grouped = React.useMemo(() => {
    const map: Record<string, typeof entries> = {};
    for (const e of entries) {
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push(e);
    }
    function dateKeyToMs(key: string): number {
      const [y, m, d] = key.split("-").map(Number);
      return new Date(y, m - 1, d).getTime();
    }

    return Object.keys(map)
      .sort((a, b) => dateKeyToMs(b) - dateKeyToMs(a))
      .map((date) => {
        const dayEntries = map[date].slice().sort((a, b) => a.time.localeCompare(b.time));
        const parts = date.split("-");
        const d = new Date(
          parseInt(parts[0], 10),
          parseInt(parts[1], 10) - 1,
          parseInt(parts[2], 10),
        );
        const MONTHS_UZ = [
          "Yanvar","Fevral","Mart","Aprel","May","Iyun",
          "Iyul","Avgust","Sentabr","Oktabr","Noyabr","Dekabr",
        ];
        const DAYS_UZ = ["Yakshanba","Dushanba","Seshanba","Chorshanba","Payshanba","Juma","Shanba"];
        const label = `${d.getDate()} ${MONTHS_UZ[d.getMonth()]} ${d.getFullYear()} — ${DAYS_UZ[d.getDay()]}`;
        const totalCal = dayEntries.reduce((s, e) => s + e.cal, 0);
        const totalP = dayEntries.reduce((s, e) => s + e.protein, 0);
        const totalC = dayEntries.reduce((s, e) => s + e.carbs, 0);
        const totalF = dayEntries.reduce((s, e) => s + e.fat, 0);
        return { date, label, entries: dayEntries, totalCal, totalP, totalC, totalF };
      });
  }, [entries]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={[styles.histRoot, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.histHeader,
            {
              paddingTop: (Platform.OS === "web" ? 16 : insets.top) + 8,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <Pressable onPress={onClose} hitSlop={10} style={{ padding: 4 }}>
            <Feather name="x" size={24} color={colors.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.histTitle, { color: colors.text }]}>Ovqatlanish tarixi</Text>
            <Text style={[styles.histSub, { color: colors.mutedForeground }]}>
              {grouped.length > 0 ? `${grouped.length} kun, jami ${entries.length} yozuv` : "Yozuvlar yo'q"}
            </Text>
          </View>
          <Feather name="clock" size={22} color={colors.primary} />
        </View>

        {grouped.length === 0 ? (
          <View style={styles.histEmpty}>
            <Text style={[styles.histEmptyIcon]}>🍽️</Text>
            <Text style={[styles.histEmptyText, { color: colors.text }]}>
              Hali hech narsa qayd etilmagan
            </Text>
            <Text style={[styles.histEmptySub, { color: colors.mutedForeground }]}>
              Bosh ekranda ovqat qo'shganingizdan keyin tarix bu yerda ko'rinadi.
            </Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{
              padding: 16,
              paddingBottom: (Platform.OS === "web" ? 24 : insets.bottom) + 32,
            }}
            showsVerticalScrollIndicator={false}
          >
            {grouped.map((group) => (
              <View key={group.date} style={styles.histDayBlock}>
                <View style={[styles.histDayHeader, { backgroundColor: colors.secondary }]}>
                  <Text style={[styles.histDayLabel, { color: colors.primary }]}>
                    {group.label}
                  </Text>
                  <Text style={[styles.histDayTotal, { color: colors.primary }]}>
                    {group.totalCal} kkal
                  </Text>
                </View>

                {group.entries.map((e) => (
                  <View
                    key={e.id}
                    style={[
                      styles.histEntryRow,
                      { backgroundColor: colors.card, borderColor: colors.border },
                    ]}
                  >
                    <View
                      style={[styles.histEntryIcon, { backgroundColor: colors.secondary }]}
                    >
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
                        size={15}
                        color={colors.primary}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[styles.histEntryName, { color: colors.text }]}
                        numberOfLines={1}
                      >
                        {e.name}
                      </Text>
                      <Text style={[styles.histEntryMeta, { color: colors.mutedForeground }]}>
                        {e.time} · {e.protein}g B · {e.carbs}g U · {e.fat}g Y
                      </Text>
                    </View>
                    <Text style={[styles.histEntryCal, { color: colors.primary }]}>
                      {e.cal} kal
                    </Text>
                    <Pressable
                      onPress={() => handleDelete(e.id, e.name)}
                      hitSlop={10}
                      accessibilityRole="button"
                      accessibilityLabel="O'chirish"
                      style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, marginLeft: 8 })}
                    >
                      <Feather name="trash-2" size={15} color={colors.destructive} />
                    </Pressable>
                  </View>
                ))}

                <View
                  style={[styles.histDayFooter, { borderColor: colors.border, backgroundColor: colors.secondary }]}
                >
                  <Text style={[styles.histFooterLabel, { color: colors.mutedForeground }]}>
                    Jami:
                  </Text>
                  <Text style={[styles.histFooterCal, { color: colors.text }]}>
                    {group.totalCal} kkal
                  </Text>
                  <Text style={[styles.histFooterMacro, { color: colors.mutedForeground }]}>
                    {group.totalP}g B · {group.totalC}g U · {group.totalF}g Y
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

function ActivityPickerModal({
  visible,
  current,
  onClose,
  onSave,
  colors,
}: {
  visible: boolean;
  current: number;
  onClose: () => void;
  onSave: (value: number) => void;
  colors: ReturnType<typeof useColors>;
}) {
  const [localSelected, setLocalSelected] = useState(current);

  useEffect(() => {
    if (visible) setLocalSelected(current);
  }, [visible, current]);

  const handleSelect = (value: number) => {
    setLocalSelected(value);
    setTimeout(() => onSave(value), 150);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.editSheet, { backgroundColor: colors.card }]}
          onPress={() => {}}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <View style={styles.editHeader}>
            <View style={[styles.editIcon, { backgroundColor: colors.primary }]}>
              <Feather name="activity" size={20} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.editTitle, { color: colors.text }]}>
                Kunlik faollik darajasi
              </Text>
              <Text style={[styles.editDesc, { color: colors.mutedForeground }]}>
                Kunlik kaloriya normangiz shu darajaga qarab qayta hisoblanadi.
              </Text>
            </View>
          </View>

          <ScrollView
            style={{ maxHeight: 380 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            {ACTIVITY_OPTIONS.map((opt) => {
              const selected = Math.abs(opt.value - localSelected) < 0.001;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => handleSelect(opt.value)}
                  style={({ pressed }) => [
                    styles.speedRow,
                    {
                      backgroundColor: selected ? colors.secondary : colors.background,
                      borderColor: selected ? colors.primary : colors.border,
                      borderWidth: selected ? 2 : 1,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.editIcon,
                      { backgroundColor: selected ? colors.primary : colors.secondary },
                    ]}
                  >
                    <Feather
                      name={opt.icon}
                      size={18}
                      color={selected ? "#FFFFFF" : colors.primary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.speedLabel, { color: colors.text }]}>
                      {opt.label}
                    </Text>
                    <Text style={[styles.speedDesc, { color: colors.mutedForeground }]}>
                      {opt.desc}
                    </Text>
                  </View>
                  {selected && (
                    <Feather name="check-circle" size={22} color={colors.primary} />
                  )}
                </Pressable>
              );
            })}
          </ScrollView>

          <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
            <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>
              Bekor qilish
            </Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function PrivacyModal({
  visible,
  onClose,
  onLogout,
  onDeleteAccount,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  onLogout: () => void;
  onDeleteAccount: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={[styles.privacyRoot, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.privacyHeader,
            {
              paddingTop: (Platform.OS === "web" ? 16 : insets.top) + 8,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <Pressable onPress={onClose} hitSlop={10} style={{ padding: 4 }}>
            <Feather name="x" size={24} color={colors.text} />
          </Pressable>
          <Text style={[styles.privacyTitle, { color: colors.text }]}>
            Maxfiylik va xavfsizlik
          </Text>
          <View style={{ width: 32 }} />
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32 }}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.privacySection, { color: colors.text }]}>
            Ilova va Dasturchi haqida
          </Text>
          <Text style={[styles.privacyText, { color: colors.mutedForeground }]}>
            Ilova nomi: Bir Burda - Kaloriya Hisobi{"\n"}
            Dasturchi: Muydinov Javlonbek
          </Text>

          <Text style={[styles.privacySection, { color: colors.text, marginTop: 24 }]}>
            Maxfiylik siyosati
          </Text>
          <Text style={[styles.privacyText, { color: colors.mutedForeground }]}>
            Ushbu siyosat Bir Burda - Kaloriya Hisobi ilovasiga tegishli bo'lib, uni
            Muydinov Javlonbek ishlab chiqargan.{"\n\n"}
            Ilovamiz sizning maxfiyligingizni qadrlaydi. Foydalanuvchilarning shaxsiy
            va sog'liq ma'lumotlari (yosh, vazn, ovqatlanish tarixi) serverlarimizda
            saqlanmaydi. Barcha ma'lumotlar faqat foydalanuvchining o'z qurilmasida
            (xotirasida) saqlanadi.{"\n\n"}
            AI tahlili uchun ovqat rasmlari va matn so'rovlari xavfsiz kanal orqali
            ishlanadi va saqlanmaydi.
          </Text>

          <Text style={[styles.privacySection, { color: colors.text, marginTop: 24 }]}>
            Ma'lumotlarni saqlash (Data Retention)
          </Text>
          <Text style={[styles.privacyText, { color: colors.mutedForeground }]}>
            Foydalanuvchilarning shaxsiy va sog'liq ma'lumotlari (yosh, vazn,
            ovqatlanish tarixi) serverlarimizda saqlanmaydi. Barcha ma'lumotlar faqat
            foydalanuvchining o'z qurilmasida (xotirasida) saqlanadi va ilova
            o'chirilganda avtomatik ravishda yo'qoladi.{"\n\n"}
            Foydalanuvchi akkountini o'chirganda barcha ma'lumotlar darhol
            qurilmadan o'chiriladi.
          </Text>

          <Text style={[styles.privacySection, { color: colors.text, marginTop: 24 }]}>
            Ma'lumotlar xavfsizligi
          </Text>
          <Text style={[styles.privacyText, { color: colors.mutedForeground }]}>
            Ma'lumotlaringiz qurilmangizning shifrlangan xotirasida saqlanadi.
            Internet orqali yuboriladigan har qanday so'rov HTTPS orqali himoyalangan.
          </Text>

          <View style={{ marginTop: 28, gap: 10 }}>
            <Pressable
              onPress={onLogout}
              style={({ pressed }) => [
                styles.privacyBtn,
                {
                  backgroundColor: colors.secondary,
                  borderColor: colors.border,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Feather name="log-out" size={18} color={colors.text} />
              <Text style={[styles.privacyBtnText, { color: colors.text }]}>
                Akauntdan chiqish
              </Text>
            </Pressable>

            <Pressable
              onPress={onDeleteAccount}
              style={({ pressed }) => [
                styles.privacyBtn,
                {
                  backgroundColor: "#FEE2E2",
                  borderColor: colors.destructive,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Feather name="trash-2" size={18} color={colors.destructive} />
              <Text style={[styles.privacyBtnText, { color: colors.destructive }]}>
                Akauntni butunlay o'chirish
              </Text>
            </Pressable>

            <Text style={[styles.privacyHint, { color: colors.mutedForeground }]}>
              Akauntni o'chirsangiz, barcha ma'lumotlaringiz qaytarib bo'lmas tarzda
              yo'qoladi va siz boshlang'ich sozlash jarayonidan qaytadan o'tasiz.
            </Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function MealsPickerModal({
  visible,
  current,
  onClose,
  onSave,
  colors,
}: {
  visible: boolean;
  current: number;
  onClose: () => void;
  onSave: (value: number) => void;
  colors: ReturnType<typeof useColors>;
}) {
  const [localSelected, setLocalSelected] = useState(current);

  useEffect(() => {
    if (visible) setLocalSelected(current);
  }, [visible, current]);

  const handleSelect = (value: number) => {
    setLocalSelected(value);
    setTimeout(() => onSave(value), 150);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.editSheet, { backgroundColor: colors.card }]}
          onPress={() => {}}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          <View style={styles.editHeader}>
            <View style={[styles.editIcon, { backgroundColor: colors.primary }]}>
              <Feather name="coffee" size={20} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.editTitle, { color: colors.text }]}>
                Ovqatlanish soni
              </Text>
              <Text style={[styles.editDesc, { color: colors.mutedForeground }]}>
                Kuniga necha marta ovqatlanasiz? Eslatmalar shu vaqtlarda yuboriladi.
              </Text>
            </View>
          </View>

          <ScrollView
            style={{ maxHeight: 360 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            {MEAL_OPTIONS.map((opt) => {
              const selected = opt.value === localSelected;
              const slots = getMealSchedule(opt.value);
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => handleSelect(opt.value)}
                  style={({ pressed }) => [
                    styles.speedRow,
                    {
                      backgroundColor: selected ? colors.secondary : colors.background,
                      borderColor: selected ? colors.primary : colors.border,
                      borderWidth: selected ? 2 : 1,
                      opacity: pressed ? 0.85 : 1,
                      flexDirection: "column",
                      alignItems: "stretch",
                      gap: 6,
                    },
                  ]}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.speedLabel, { color: colors.text }]}>
                        {opt.label}
                      </Text>
                      <Text style={[styles.speedDesc, { color: colors.mutedForeground }]}>
                        {opt.desc}
                      </Text>
                    </View>
                    {selected && (
                      <Feather name="check-circle" size={22} color={colors.primary} />
                    )}
                  </View>
                  <View style={styles.timeChipsInner}>
                    {slots.map((s, i) => (
                      <Text
                        key={i}
                        style={[
                          styles.timeMini,
                          {
                            color: selected ? colors.primary : colors.mutedForeground,
                            borderColor: selected ? colors.primary : colors.border,
                          },
                        ]}
                      >
                        {formatHm(s.hour, s.minute)}
                      </Text>
                    ))}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
            <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>
              Bekor qilish
            </Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function SpeedPickerModal({
  visible,
  current,
  onClose,
  onSave,
  colors,
}: {
  visible: boolean;
  current: number;
  onClose: () => void;
  onSave: (value: number) => void;
  colors: ReturnType<typeof useColors>;
}) {
  const [localSelected, setLocalSelected] = useState(current);

  useEffect(() => {
    if (visible) setLocalSelected(current);
  }, [visible, current]);

  const handleSelect = (value: number) => {
    setLocalSelected(value);
    setTimeout(() => onSave(value), 150);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.editSheet, { backgroundColor: colors.card }]}
          onPress={() => {}}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          <View style={styles.editHeader}>
            <View style={[styles.editIcon, { backgroundColor: colors.primary }]}>
              <Feather name="trending-down" size={20} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.editTitle, { color: colors.text }]}>Haftalik tezlik</Text>
              <Text style={[styles.editDesc, { color: colors.mutedForeground }]}>
                Bir haftada qancha kg o'zgartirmoqchisiz? Tezlik kunlik kaloriyaga ta'sir qiladi.
              </Text>
            </View>
          </View>

          <View style={{ gap: 8 }}>
            {SPEED_OPTIONS.map((opt) => {
              const selected = Math.abs(opt.value - localSelected) < 0.01;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => handleSelect(opt.value)}
                  style={({ pressed }) => [
                    styles.speedRow,
                    {
                      backgroundColor: selected ? colors.secondary : colors.background,
                      borderColor: selected ? colors.primary : colors.border,
                      borderWidth: selected ? 2 : 1,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.speedLabel, { color: colors.text }]}>{opt.label}</Text>
                    <Text style={[styles.speedDesc, { color: colors.mutedForeground }]}>
                      {opt.desc}
                    </Text>
                  </View>
                  {selected && (
                    <Feather name="check-circle" size={22} color={colors.primary} />
                  )}
                </Pressable>
              );
            })}
          </View>

          <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
            <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>
              Bekor qilish
            </Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon,
  onPress,
  colors,
}: {
  label: string;
  value: string;
  hint: string;
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.statCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.statIconRow}>
        <Feather name={icon} size={12} color={colors.mutedForeground} />
      </View>
      <Text style={[styles.statValue, { color: colors.primary }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.text }]}>{label}</Text>
      <Text style={[styles.statHint, { color: colors.mutedForeground }]} numberOfLines={1}>
        {hint}
      </Text>
    </Pressable>
  );
}

function NumberEditModal({
  visible,
  field,
  currentValue,
  onClose,
  onSave,
  colors,
}: {
  visible: boolean;
  field: EditField;
  currentValue?: number;
  onClose: () => void;
  onSave: (field: "currentWeight" | "targetWeight", value: number) => void;
  colors: ReturnType<typeof useColors>;
}) {
  const [text, setText] = useState("");

  useEffect(() => {
    if (visible) {
      setText(currentValue ? String(currentValue) : "");
    }
  }, [visible, currentValue]);

  const isWeight = field === "currentWeight";
  const title = isWeight ? "Hozirgi vazn" : "Maqsadli vazn";
  const desc = isWeight
    ? "Tarozidagi haqiqiy vazningizni kiriting. Bu raqam asosida kunlik kaloriya va makro qayta hisoblanadi."
    : "Yetmoqchi bo'lgan vazningizni kiriting. Maqsadgacha qancha vaqt qolganini aniqlash uchun kerak.";
  const num = parseFloat(text.replace(",", "."));
  const valid = !Number.isNaN(num) && num >= 30 && num <= 250;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior="padding"
        keyboardVerticalOffset={0}
        style={styles.flex1}
      >
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable
            style={[styles.editSheet, { backgroundColor: colors.card }]}
            onPress={() => {}}
          >
            <View style={[styles.handle, { backgroundColor: colors.border }]} />

            <View style={styles.editHeader}>
              <View style={[styles.editIcon, { backgroundColor: colors.primary }]}>
                <Feather name={isWeight ? "user" : "target"} size={20} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.editTitle, { color: colors.text }]}>{title}</Text>
                <Text style={[styles.editDesc, { color: colors.mutedForeground }]}>{desc}</Text>
              </View>
            </View>

            <View
              style={[
                styles.numField,
                { backgroundColor: colors.input, borderColor: colors.border },
              ]}
            >
              <TextInput
                value={text}
                onChangeText={setText}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={colors.mutedForeground}
                style={[styles.numInput, { color: colors.text }]}
                autoFocus
                selectTextOnFocus
              />
              <Text style={[styles.unitText, { color: colors.mutedForeground }]}>kg</Text>
            </View>

            {!valid && text.length > 0 ? (
              <Text style={styles.warnText}>30 va 250 kg orasida kiriting</Text>
            ) : null}

            <Pressable
              onPress={() => {
                if (valid && field) onSave(field, num);
              }}
              disabled={!valid || !field}
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

            <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
              <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>
                Bekor qilish
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function BmiInfoModal({
  visible,
  bmi,
  category,
  onClose,
  colors,
}: {
  visible: boolean;
  bmi: number | null;
  category: string;
  onClose: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const ranges = [
    { label: "Vazn kam", range: "< 18.5", color: "#3B82F6", desc: "Vazn yetishmaydi — ko'proq oziqlanish tavsiya etiladi" },
    { label: "Normal", range: "18.5 — 24.9", color: "#16A34A", desc: "Sog'lom vazn diapazoni — shu holatni saqlang" },
    { label: "Ortiqcha", range: "25.0 — 29.9", color: "#F59E0B", desc: "Vazn me'yordan biroz yuqori — diqqat qiling" },
    { label: "Semizlik", range: "≥ 30.0", color: "#DC2626", desc: "Salomatlik uchun xavfli — vazn kamaytirish kerak" },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.editSheet, { backgroundColor: colors.card }]}
          onPress={() => {}}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          <View style={styles.editHeader}>
            <View style={[styles.editIcon, { backgroundColor: colors.primary }]}>
              <Feather name="activity" size={20} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.editTitle, { color: colors.text }]}>BMI nima?</Text>
              <Text style={[styles.editDesc, { color: colors.mutedForeground }]}>
                Body Mass Index — vazn va bo'yga nisbatan tanangiz holatini ko'rsatadi
              </Text>
            </View>
          </View>

          {bmi ? (
            <View style={[styles.bmiBig, { backgroundColor: colors.secondary }]}>
              <Text style={[styles.bmiBigValue, { color: colors.primary }]}>
                {bmi.toFixed(1)}
              </Text>
              <Text style={[styles.bmiBigLabel, { color: colors.text }]}>
                Sizning BMI: {category}
              </Text>
            </View>
          ) : (
            <View style={[styles.bmiBig, { backgroundColor: colors.secondary }]}>
              <Text style={[styles.bmiBigLabel, { color: colors.mutedForeground }]}>
                Vazn va bo'y kiritilmagan
              </Text>
            </View>
          )}

          <View style={styles.rangeList}>
            {ranges.map((r) => (
              <View
                key={r.label}
                style={[
                  styles.rangeRow,
                  {
                    backgroundColor: colors.background,
                    borderColor:
                      category === r.label ? r.color : colors.border,
                    borderWidth: category === r.label ? 2 : 1,
                  },
                ]}
              >
                <View style={[styles.rangeDot, { backgroundColor: r.color }]} />
                <View style={{ flex: 1 }}>
                  <View style={styles.rangeHead}>
                    <Text style={[styles.rangeLabel, { color: colors.text }]}>{r.label}</Text>
                    <Text style={[styles.rangeNum, { color: r.color }]}>{r.range}</Text>
                  </View>
                  <Text style={[styles.rangeDesc, { color: colors.mutedForeground }]}>
                    {r.desc}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.saveBtn,
              {
                backgroundColor: colors.primary,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text style={styles.saveText}>Tushundim</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex1: { flex: 1 },
  content: { paddingHorizontal: 20 },
  profileHeader: { alignItems: "center", gap: 8, marginBottom: 24 },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  phone: { fontSize: 18, fontFamily: "Inter_700Bold" },
  goalBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  goalText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  statsRow: { flexDirection: "row", gap: 7, marginBottom: 24 },
  statCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: "center",
    gap: 2,
  },
  statIconRow: {
    alignSelf: "flex-end",
    opacity: 0.6,
  },
  statValue: { fontSize: 15, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", marginTop: 2 },
  statHint: { fontSize: 9.5, fontFamily: "Inter_400Regular", marginTop: 2 },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 8,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 8,
    gap: 12,
  },
  settingIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  settingLabel: { fontSize: 15, fontFamily: "Inter_500Medium" },
  settingValue: { fontSize: 13, fontFamily: "Inter_400Regular", marginRight: 4 },

  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,25,10,0.55)",
    justifyContent: "flex-end",
  },
  editSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "web" ? 110 : 100,
    gap: 14,
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: 6,
  },
  editHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  editIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  editTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  editDesc: {
    fontSize: 12.5,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
    marginTop: 2,
  },
  privacyRoot: { flex: 1 },
  privacyHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  privacyTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  privacySection: { fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 8 },
  privacyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 21,
  },
  privacyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  privacyBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  privacyHint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
    textAlign: "center",
    marginTop: 4,
  },
  numField: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 18,
    height: 64,
  },
  numInput: {
    flex: 1,
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    paddingVertical: 0,
  },
  unitText: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
  },
  warnText: {
    fontSize: 12.5,
    fontFamily: "Inter_500Medium",
    color: "#DC2626",
  },
  saveBtn: {
    flexDirection: "row",
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
  },
  saveText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  cancelBtn: {
    alignSelf: "center",
    paddingVertical: 6,
  },
  cancelText: { fontSize: 14, fontFamily: "Inter_500Medium" },

  bmiBig: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    gap: 4,
  },
  bmiBigValue: { fontSize: 36, fontFamily: "Inter_700Bold" },
  bmiBigLabel: { fontSize: 13.5, fontFamily: "Inter_600SemiBold" },
  rangeList: { gap: 8 },
  rangeRow: {
    flexDirection: "row",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  rangeDot: { width: 10, height: 10, borderRadius: 5 },
  rangeHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  rangeLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  rangeNum: { fontSize: 12.5, fontFamily: "Inter_700Bold" },
  rangeDesc: { fontSize: 11.5, fontFamily: "Inter_400Regular", lineHeight: 16 },

  speedRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    gap: 12,
  },
  speedLabel: { fontSize: 16, fontFamily: "Inter_700Bold" },
  speedDesc: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },

  notifCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 8,
    gap: 12,
  },
  notifHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  notifTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  notifSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  timeChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
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
  timeChipsInner: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
  },
  timeMini: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
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

  histRoot: { flex: 1 },
  histHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  histTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  histSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  histEmpty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 40,
  },
  histEmptyIcon: { fontSize: 52 },
  histEmptyText: { fontSize: 17, fontFamily: "Inter_700Bold", textAlign: "center" },
  histEmptySub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 19,
  },
  histDayBlock: { marginBottom: 20 },
  histDayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 6,
  },
  histDayLabel: { fontSize: 13, fontFamily: "Inter_700Bold" },
  histDayTotal: { fontSize: 14, fontFamily: "Inter_700Bold" },
  histEntryRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    marginBottom: 6,
    gap: 10,
  },
  histEntryIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  histEntryName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  histEntryMeta: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  histEntryCal: { fontSize: 14, fontFamily: "Inter_700Bold" },
  histDayFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 2,
  },
  histFooterLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  histFooterCal: { fontSize: 13, fontFamily: "Inter_700Bold" },
  histFooterMacro: { fontSize: 11, fontFamily: "Inter_400Regular", flex: 1, textAlign: "right" },
});
