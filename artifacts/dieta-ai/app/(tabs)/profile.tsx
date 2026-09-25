import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EditEntryModal } from "@/components/EditEntryModal";
import { MyFoodsModal } from "@/components/profile/MyFoodsModal";
import { NotificationsModal } from "@/components/profile/NotificationsModal";
import { PremiumCard } from "@/components/profile/PremiumCard";
import {
  BirthDateSheet,
  CaloriesSheet,
  ChoiceSheet,
  MONTHS_UZ,
  NumberSheet,
  TextSheet,
  type ChoiceOption,
} from "@/components/profile/ProfileSheets";
import { WeightProgressCard } from "@/components/WeightProgressCard";
import {
  useApp,
  type DiaryEntryPatch,
  type Gender,
  type Goal,
  type UserProfile,
} from "@/context/AppContext";
import { useTracker } from "@/context/TrackerContext";
import { useColors } from "@/hooks/useColors";
import { confirmAction } from "@/lib/confirm";
import { calculateAge, calculatePlan, macrosForCalories } from "@/lib/nutrition";
import {
  getMealSchedule,
  getPermissionStatus,
  type PermissionStatus,
} from "@/lib/notifications";

type Editor =
  | "currentWeight"
  | "targetWeight"
  | "name"
  | "gender"
  | "birthDate"
  | "height"
  | "goal"
  | "calories"
  | null;

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

const GOAL_OPTIONS: ChoiceOption<Goal>[] = [
  { value: "ozish", label: "Vazn yo'qotish", desc: "Kaloriya kamomadi bilan ozish", icon: "trending-down" },
  { value: "saqlash", label: "Vaznni saqlash", desc: "Hozirgi vaznda qolish", icon: "minus" },
  { value: "oshirish", label: "Vazn oshirish", desc: "Kaloriya ortiqchasi bilan", icon: "trending-up" },
];

const GENDER_OPTIONS: ChoiceOption<Gender>[] = [
  { value: "erkak", label: "Erkak", icon: "user" },
  { value: "ayol", label: "Ayol", icon: "user" },
];

const GOAL_LABEL: Record<Goal, string> = {
  ozish: "Vazn yo'qotish",
  saqlash: "Vaznni saqlash",
  oshirish: "Vazn oshirish",
};

/** Goal implied by a target weight: within ±0.5 kg counts as maintaining. */
function goalForTarget(current: number, target: number): Goal {
  const diff = target - current;
  if (Math.abs(diff) < 0.5) return "saqlash";
  return diff < 0 ? "ozish" : "oshirish";
}

function fmtKg(kg: number): string {
  return String(Math.round(kg * 10) / 10);
}

function formatHm(h: number, m: number) {
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function SettingRow({
  icon,
  label,
  value,
  valueColor,
  onPress,
  danger,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value?: string;
  valueColor?: string;
  onPress?: () => void;
  danger?: boolean;
}) {
  const colors = useColors();
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.7}
      style={[styles.settingRow, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <View style={[styles.settingIcon, { backgroundColor: danger ? "#FEE2E2" : colors.secondary }]}>
        <Feather name={icon} size={18} color={danger ? colors.destructive : colors.primary} />
      </View>
      <Text style={[styles.settingLabel, { color: danger ? colors.destructive : colors.text }]}>
        {label}
      </Text>
      <View style={styles.settingValueWrap}>
        {value ? (
          <Text
            style={[styles.settingValue, { color: valueColor ?? colors.mutedForeground }]}
            numberOfLines={1}
          >
            {value}
          </Text>
        ) : null}
      </View>
      {onPress && !danger ? (
        <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
      ) : null}
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const {
    profile,
    setProfile,
    subscription,
    resetApp,
    entries,
    updateEntry,
    removeEntry,
    weightLog,
    logWeight,
    removeWeightEntry,
  } = useApp();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [editor, setEditor] = useState<Editor>(null);
  const [bmiOpen, setBmiOpen] = useState(false);
  const [speedOpen, setSpeedOpen] = useState(false);
  const [mealsOpen, setMealsOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [myFoodsOpen, setMyFoodsOpen] = useState(false);
  const { customFoods, favorites } = useTracker();
  const [permStatus, setPermStatus] = useState<PermissionStatus>("undetermined");

  // Re-check on focus: the user may have toggled permission in system settings.
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === "web") return;
      getPermissionStatus().then(setPermStatus).catch(() => {});
    }, []),
  );

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 100 : insets.bottom + 80;
  const closeEditor = () => setEditor(null);

  /**
   * Saves profile changes and re-derives the daily target from them. A manual
   * calorie target survives; only its macro split follows the new weight/goal.
   */
  const applyProfile = (updates: Partial<UserProfile>) => {
    const next = { ...profile, ...updates };
    const manual = next.manualCalories === true && !!next.dailyCalories;
    const plan = calculatePlan(next);
    const calories = manual ? next.dailyCalories! : plan.calories;
    const macros = manual
      ? macrosForCalories(calories, next.currentWeight ?? 75, next.goal)
      : plan;
    setProfile({
      ...updates,
      dailyCalories: calories,
      protein: macros.protein,
      carbs: macros.carbs,
      fat: macros.fat,
    });
  };

  const plan = calculatePlan(profile);
  const autoPlan = calculatePlan({ ...profile, manualCalories: false });
  const bmi = profile.currentWeight && profile.height ? plan.bmi : null;
  const bmiCategory = bmi ? plan.bmiCategory : "—";
  const mealsCount = profile.mealsPerDay ?? 3;
  const goal = profile.goal ?? "ozish";
  const displayName = profile.name?.trim() || "";
  const initial = displayName ? displayName[0]!.toUpperCase() : null;

  const activityLabel =
    ACTIVITY_OPTIONS.find((o) => Math.abs(o.value - (profile.activityLevel ?? 1.375)) < 0.001)
      ?.label ?? "Yengil faol";

  const notifLabel =
    profile.notificationsEnabled === false
      ? "O'chirilgan"
      : Platform.OS !== "web" && permStatus === "denied"
        ? "Ruxsat yo'q"
        : "Yoqilgan";

  const saveWeight = (value: number) => {
    applyProfile({ currentWeight: value });
    logWeight(value);
    closeEditor();
  };

  const saveTarget = (value: number) => {
    const current = profile.currentWeight ?? value;
    applyProfile({ targetWeight: value, goal: goalForTarget(current, value) });
    closeEditor();
  };

  const saveGoal = (g: Goal) => {
    const current = profile.currentWeight ?? 75;
    let target = profile.targetWeight ?? current;
    // Keep the target on the right side of the current weight for the new goal.
    if (g === "saqlash") target = current;
    else if (g === "ozish" && target >= current) target = Math.round(current - 5);
    else if (g === "oshirish" && target <= current) target = Math.round(current + 5);
    applyProfile({ goal: g, targetWeight: target });
    closeEditor();
  };

  const handleReset = async () => {
    setPrivacyOpen(false);
    const restoreNote = subscription.login
      ? `Premium yo'qolmaydi: "${subscription.login}" login va botdagi parol bilan qayta tiklaysiz.`
      : "Premium yo'qolmaydi: botdan olgan login va parol bilan qayta tiklaysiz.";
    const ok = await confirmAction({
      title: "Barcha ma'lumotlarni o'chirish",
      message: `Ovqat tarixi, vazn o'lchovlari, rejalar va sozlamalar shu telefondan butunlay o'chiriladi. Buni qaytarib bo'lmaydi.\n\n${restoreNote}`,
      confirmText: "Ha, o'chirish",
      destructive: true,
    });
    if (!ok) return;
    await resetApp();
    router.replace("/onboarding/gender");
  };

  const birthLabel = profile.birthDate
    ? `${profile.birthDate.day} ${MONTHS_UZ[profile.birthDate.month]?.slice(0, 3)} ${profile.birthDate.year} · ${calculateAge(profile.birthDate)} yosh`
    : "Kiritilmagan";

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
          <Pressable
            onPress={() => setEditor("name")}
            style={[styles.avatar, { backgroundColor: colors.primary }]}
            accessibilityRole="button"
            accessibilityLabel="Ismni o'zgartirish"
          >
            {initial ? (
              <Text style={[styles.avatarLetter, { color: colors.primaryForeground }]}>{initial}</Text>
            ) : (
              <Feather name="user" size={36} color={colors.primaryForeground} />
            )}
          </Pressable>
          <Pressable onPress={() => setEditor("name")} style={styles.nameRow} hitSlop={6}>
            <Text style={[styles.name, { color: displayName ? colors.text : colors.mutedForeground }]}>
              {displayName || "Ismingizni kiriting"}
            </Text>
            <Feather name="edit-2" size={14} color={colors.mutedForeground} />
          </Pressable>
          {profile.phone ? (
            <Text style={[styles.phone, { color: colors.mutedForeground }]}>+998 {profile.phone}</Text>
          ) : null}
          <Pressable
            onPress={() => setEditor("goal")}
            style={[styles.goalBadge, { backgroundColor: colors.secondary }]}
          >
            <Text style={[styles.goalText, { color: colors.primary }]}>{GOAL_LABEL[goal]}</Text>
          </Pressable>
        </View>

        <PremiumCard
          subscription={subscription}
          onBuy={() => router.push("/onboarding/payment")}
          onRestore={() => router.push("/onboarding/payment")}
        />

        <View style={styles.statsRow}>
          <StatCard
            label="Hozirgi vazn"
            value={profile.currentWeight ? `${fmtKg(profile.currentWeight)} kg` : "—"}
            hint="O'zgartirish"
            icon="edit-2"
            onPress={() => setEditor("currentWeight")}
            colors={colors}
          />
          <StatCard
            label="Haftalik maqsad"
            value={goal === "saqlash" ? "—" : `${parseFloat((profile.speedKgPerWeek ?? 0.5).toFixed(2))} kg`}
            hint={goal === "saqlash" ? "Saqlash rejimi" : "O'zgartirish"}
            icon="edit-2"
            onPress={() => (goal === "saqlash" ? setEditor("goal") : setSpeedOpen(true))}
            colors={colors}
          />
          <StatCard
            label="Yakuniy maqsad"
            value={profile.targetWeight ? `${fmtKg(profile.targetWeight)} kg` : "—"}
            hint="O'zgartirish"
            icon="edit-2"
            onPress={() => setEditor("targetWeight")}
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

        <View style={styles.weightCardWrap}>
          <WeightProgressCard
            weightLog={weightLog}
            targetWeight={profile.targetWeight}
            goal={profile.goal}
            onAddWeight={() => setEditor("currentWeight")}
            onRemoveEntry={removeWeightEntry}
          />
        </View>

        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>Shaxsiy ma'lumotlar</Text>
        <SettingRow icon="user" label="Ism" value={displayName || "Kiritilmagan"} onPress={() => setEditor("name")} />
        <SettingRow
          icon="users"
          label="Jins"
          value={profile.gender === "erkak" ? "Erkak" : profile.gender === "ayol" ? "Ayol" : "—"}
          onPress={() => setEditor("gender")}
        />
        <SettingRow icon="calendar" label="Tug'ilgan sana" value={birthLabel} onPress={() => setEditor("birthDate")} />
        <SettingRow
          icon="maximize-2"
          label="Bo'y"
          value={profile.height ? `${profile.height} sm` : "—"}
          onPress={() => setEditor("height")}
        />
        <SettingRow icon="target" label="Maqsad" value={GOAL_LABEL[goal]} onPress={() => setEditor("goal")} />
        <SettingRow
          icon="activity"
          label="Faollik darajasi"
          value={activityLabel}
          onPress={() => setActivityOpen(true)}
        />

        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>Kunlik reja</Text>
        <SettingRow
          icon="zap"
          label="Kunlik kaloriya"
          value={`${profile.dailyCalories ?? plan.calories} kkal · ${profile.manualCalories ? "qo'lda" : "avto"}`}
          onPress={() => setEditor("calories")}
        />
        <SettingRow
          icon="pie-chart"
          label="Makrolar"
          value={`B ${profile.protein ?? plan.protein}g · U ${profile.carbs ?? plan.carbs}g · Y ${profile.fat ?? plan.fat}g`}
        />
        <SettingRow
          icon="coffee"
          label="Ovqatlanish soni"
          value={`${mealsCount} mahal`}
          onPress={() => setMealsOpen(true)}
        />

        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>Ilova</Text>
        <SettingRow
          icon="bell"
          label="Eslatmalar"
          value={notifLabel}
          valueColor={notifLabel === "Ruxsat yo'q" ? colors.destructive : undefined}
          onPress={() => setNotifOpen(true)}
        />
        <SettingRow icon="globe" label="Til" value="O'zbekcha" />
        <SettingRow icon="shield" label="Maxfiylik siyosati" onPress={() => setPrivacyOpen(true)} />

        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>Ma'lumotlar</Text>
        <SettingRow
          icon="book"
          label="Mening taomlarim"
          value={
            customFoods.length + favorites.length > 0
              ? `${customFoods.length} taom · ${favorites.length} sevimli`
              : undefined
          }
          onPress={() => setMyFoodsOpen(true)}
        />
        <SettingRow
          icon="clock"
          label="Ovqatlanish tarixi"
          value={entries.length > 0 ? `${entries.length} yozuv` : undefined}
          onPress={() => setHistoryOpen(true)}
        />
        <SettingRow icon="trash-2" label="Barcha ma'lumotlarni o'chirish" onPress={handleReset} danger />
      </ScrollView>

      <NumberSheet
        visible={editor === "currentWeight"}
        onClose={closeEditor}
        icon="user"
        title="Hozirgi vazn"
        desc="Tarozidagi vazningizni kiriting. U grafikka yoziladi va kunlik norma qayta hisoblanadi."
        unit="kg"
        min={30}
        max={250}
        initial={profile.currentWeight}
        onSave={saveWeight}
      />
      <NumberSheet
        visible={editor === "targetWeight"}
        onClose={closeEditor}
        icon="target"
        title="Yakuniy maqsad"
        desc="Yetmoqchi bo'lgan vazningiz. Maqsad turi shunga qarab o'zi tanlanadi."
        unit="kg"
        min={30}
        max={250}
        initial={profile.targetWeight}
        hint={(v) => {
          const current = profile.currentWeight;
          if (!current) return null;
          const g = goalForTarget(current, v);
          if (g === "saqlash") return "Maqsad: vaznni saqlash";
          const diff = Math.abs(v - current);
          return `Maqsad: ${GOAL_LABEL[g].toLowerCase()} — ${fmtKg(diff)} kg ${g === "ozish" ? "kamaytirish" : "qo'shish"}`;
        }}
        onSave={saveTarget}
      />
      <NumberSheet
        visible={editor === "height"}
        onClose={closeEditor}
        icon="maximize-2"
        title="Bo'y"
        desc="BMI va kunlik kaloriya bo'yingizga qarab hisoblanadi."
        unit="sm"
        min={120}
        max={230}
        integer
        initial={profile.height}
        onSave={(v) => {
          applyProfile({ height: v });
          closeEditor();
        }}
      />
      <TextSheet
        visible={editor === "name"}
        onClose={closeEditor}
        icon="user"
        title="Ismingiz"
        desc="AI murabbiy sizga shu ism bilan murojaat qiladi."
        placeholder="Ismingiz"
        initial={profile.name}
        onSave={(v) => {
          setProfile({ name: v });
          closeEditor();
        }}
      />
      <ChoiceSheet
        visible={editor === "gender"}
        onClose={closeEditor}
        icon="users"
        title="Jins"
        desc="Kunlik kaloriya normasi erkak va ayol uchun turlicha hisoblanadi."
        options={GENDER_OPTIONS}
        current={profile.gender}
        onSelect={(v) => {
          applyProfile({ gender: v });
          closeEditor();
        }}
      />
      <ChoiceSheet
        visible={editor === "goal"}
        onClose={closeEditor}
        icon="target"
        title="Maqsad"
        desc="Kunlik kaloriya maqsadga qarab qayta hisoblanadi."
        options={GOAL_OPTIONS}
        current={goal}
        onSelect={saveGoal}
      />
      <BirthDateSheet
        visible={editor === "birthDate"}
        onClose={closeEditor}
        initial={profile.birthDate}
        onSave={(v) => {
          applyProfile({ birthDate: v });
          closeEditor();
        }}
      />
      <CaloriesSheet
        visible={editor === "calories"}
        onClose={closeEditor}
        autoCalories={autoPlan.calories}
        current={profile.dailyCalories}
        manual={profile.manualCalories === true}
        minCalories={autoPlan.minCalories}
        onSave={(v) => {
          applyProfile({ manualCalories: true, dailyCalories: v });
          closeEditor();
        }}
        onUseAuto={() => {
          applyProfile({ manualCalories: false });
          closeEditor();
        }}
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
        onSave={(v) => {
          applyProfile({ speedKgPerWeek: v });
          setSpeedOpen(false);
        }}
        colors={colors}
      />

      <MealsPickerModal
        visible={mealsOpen}
        current={mealsCount}
        onClose={() => setMealsOpen(false)}
        onSave={(v) => {
          setProfile({ mealsPerDay: v });
          setMealsOpen(false);
        }}
        colors={colors}
      />

      <ActivityPickerModal
        visible={activityOpen}
        current={profile.activityLevel ?? 1.375}
        onClose={() => setActivityOpen(false)}
        onSave={(v) => {
          applyProfile({ activityLevel: v });
          setActivityOpen(false);
        }}
        colors={colors}
      />

      <NotificationsModal
        visible={notifOpen}
        onClose={() => setNotifOpen(false)}
        profile={profile}
        setProfile={setProfile}
        onPermissionChange={setPermStatus}
      />

      <MyFoodsModal visible={myFoodsOpen} onClose={() => setMyFoodsOpen(false)} />

      <PrivacyModal
        visible={privacyOpen}
        onClose={() => setPrivacyOpen(false)}
        onDeleteData={handleReset}
        colors={colors}
      />

      <HistoryModal
        visible={historyOpen}
        onClose={() => setHistoryOpen(false)}
        entries={entries}
        onUpdateEntry={updateEntry}
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
  onUpdateEntry,
  onRemoveEntry,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  entries: import("@/context/AppContext").DiaryEntry[];
  onUpdateEntry: (id: string, patch: DiaryEntryPatch) => void;
  onRemoveEntry: (id: string) => void;
  colors: ReturnType<typeof useColors>;
}) {
  const insets = useSafeAreaInsets();
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = editingId ? entries.find((e) => e.id === editingId) ?? null : null;

  const handleDelete = async (id: string, name: string) => {
    const ok = await confirmAction({
      title: "Yozuvni o'chirish",
      message: `"${name}" yozuvini o'chirmoqchimisiz?`,
      confirmText: "O'chirish",
      destructive: true,
    });
    if (ok) onRemoveEntry(id);
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
              {grouped.length > 0
                ? `${grouped.length} kun, jami ${entries.length} yozuv · tahrirlash uchun bosing`
                : "Yozuvlar yo'q"}
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
                  <Pressable
                    key={e.id}
                    onPress={() => setEditingId(e.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`${e.name} — tahrirlash`}
                    style={({ pressed }) => [
                      styles.histEntryRow,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                        opacity: pressed ? 0.85 : 1,
                      },
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
                  </Pressable>
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

        <EditEntryModal
          visible={editing !== null}
          entry={editing}
          onClose={() => setEditingId(null)}
          onSave={(patch) => {
            if (editing) onUpdateEntry(editing.id, patch);
            setEditingId(null);
          }}
          onDelete={() => {
            if (editing) onRemoveEntry(editing.id);
            setEditingId(null);
          }}
        />
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
  onDeleteData,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  onDeleteData: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const insets = useSafeAreaInsets();
  const sections: Array<{ title: string; body: string }> = [
    {
      title: "Ilova va dasturchi",
      body: "Ilova nomi: UzDieta AI - Kaloriya Hisobi\nDasturchi: Muydinov Javlonbek",
    },
    {
      title: "Qurilmada saqlanadigan ma'lumotlar",
      body:
        "Profilingiz (yosh, jins, bo'y, vazn, maqsad), ovqatlanish tarixi, vazn o'lchovlari va " +
        "sozlamalar faqat shu telefonda saqlanadi. Biz ularni serverimizga yozmaymiz. Ilova " +
        "o'chirilsa yoki \"Barcha ma'lumotlarni o'chirish\" bosilsa, ular butunlay yo'qoladi.",
    },
    {
      title: "AI tahlil",
      body:
        "Ovqat rasmi yoki yozgan matningiz tahlil uchun serverimiz orqali AI xizmatiga yuboriladi. " +
        "Aniqroq tavsiya berish uchun so'rov bilan birga yosh, vazn, maqsad va kunlik normangiz ham " +
        "yuboriladi. Serverimiz rasm va matnlarni saqlamaydi.",
    },
    {
      title: "Premium to'lovi",
      body:
        "Premium sotib olayotganda ismingiz, telefon raqamingiz, Telegram akkauntingiz va to'lov " +
        "cheki serverimizda saqlanadi. Ular to'lovni tasdiqlash va keyinchalik Premiumni login " +
        "orqali tiklash uchun kerak. Bu ma'lumotlarni o'chirishni Telegram bot orqali so'rashingiz " +
        "mumkin.",
    },
    {
      title: "Xavfsizlik",
      body:
        "Ilova va server o'rtasidagi barcha so'rovlar HTTPS orqali shifrlangan holda yuboriladi. " +
        "Parolingiz serverda ochiq holda emas, faqat xesh ko'rinishida saqlanadi.",
    },
  ];
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
          <Text style={[styles.privacyTitle, { color: colors.text }]}>Maxfiylik siyosati</Text>
          <View style={{ width: 32 }} />
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32 }}
          showsVerticalScrollIndicator={false}
        >
          {sections.map((sec, i) => (
            <View key={sec.title} style={{ marginTop: i === 0 ? 0 : 24 }}>
              <Text style={[styles.privacySection, { color: colors.text }]}>{sec.title}</Text>
              <Text style={[styles.privacyText, { color: colors.mutedForeground }]}>{sec.body}</Text>
            </View>
          ))}

          <View style={{ marginTop: 28, gap: 10 }}>
            <Pressable
              onPress={onDeleteData}
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
                Barcha ma'lumotlarni o'chirish
              </Text>
            </Pressable>

            <Text style={[styles.privacyHint, { color: colors.mutedForeground }]}>
              Telefondagi barcha ma'lumotlar o'chadi va boshlang'ich sozlashdan qaytadan o'tasiz.
              Premium esa login va parol bilan qayta tiklanadi.
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
  content: { paddingHorizontal: 20 },
  weightCardWrap: { marginBottom: 24 },
  profileHeader: { alignItems: "center", gap: 8, marginBottom: 24 },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  avatarLetter: { fontSize: 36, fontFamily: "Inter_700Bold" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { fontSize: 20, fontFamily: "Inter_700Bold" },
  phone: { fontSize: 13, fontFamily: "Inter_500Medium", marginTop: -4 },
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
  settingLabel: { fontSize: 15, fontFamily: "Inter_500Medium", flexShrink: 0 },
  settingValueWrap: { flex: 1, alignItems: "flex-end" },
  settingValue: { fontSize: 13, fontFamily: "Inter_400Regular", marginRight: 4, textAlign: "right" },

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
