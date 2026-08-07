import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Modal } from "react-native";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Defs, LinearGradient as SvgLinGrad, Stop } from "react-native-svg";
import { AddFoodModal } from "@/components/AddFoodModal";
import { SuccessToast } from "@/components/SuccessToast";
import { MacroCard } from "@/components/MacroCard";
import { TourOverlay } from "@/components/TourOverlay";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
function HomeRing({ value, goal }: { value: number; goal: number }) {
  const size = 210;
  const stroke = 16;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const safeValue = Number.isFinite(value) ? Math.max(0, value) : 0;
  const safeGoal = Number.isFinite(goal) && goal > 0 ? goal : 1;
  const remaining = safeGoal - safeValue;
  const over = remaining < 0;
  const pct = Math.min(safeValue / safeGoal, 1);
  const offset = c - c * pct;
  const innerR = r - stroke / 2 - 1;

  return (
    <View style={{ alignItems: "center", justifyContent: "center", width: size, height: size }}>
      <View style={{
        position: "absolute",
        width: size + 56,
        height: size + 56,
        borderRadius: (size + 56) / 2,
        backgroundColor: "#4CAF5014",
        shadowColor: "#4CAF50",
        shadowOpacity: 0.45,
        shadowRadius: 36,
        shadowOffset: { width: 0, height: 0 },
        elevation: 0,
      }} />
      <View style={{
        position: "absolute",
        width: size + 24,
        height: size + 24,
        borderRadius: (size + 24) / 2,
        backgroundColor: "#4CAF5008",
        shadowColor: "#4CAF50",
        shadowOpacity: 0.25,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 0 },
        elevation: 0,
      }} />
      <Svg width={size} height={size}>
        <Defs>
          <SvgLinGrad id="innerFill" x1="30%" y1="20%" x2="80%" y2="90%">
            <Stop offset="0%" stopColor="#2A5A2A" />
            <Stop offset="100%" stopColor="#163016" />
          </SvgLinGrad>
          <SvgLinGrad id="neonGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#7EE8A2" />
            <Stop offset="100%" stopColor="#22C55E" />
          </SvgLinGrad>
          <SvgLinGrad id="overGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#FCD34D" />
            <Stop offset="100%" stopColor="#EF4444" />
          </SvgLinGrad>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={innerR} fill="url(#innerFill)" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="#1A3A1A60" strokeWidth={stroke} fill="transparent" />
        <Circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={over ? "url(#overGrad)" : "url(#neonGrad)"}
          strokeWidth={stroke}
          fill="transparent"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={{ position: "absolute", alignItems: "center" }}>
        <Text style={{ color: "#FFFFFF", fontSize: 44, fontFamily: "Inter_700Bold", letterSpacing: -1 }}>
          {Math.abs(remaining).toLocaleString("ru-RU").replace(/,/g, " ")}
        </Text>
        <Text style={{ color: "rgba(255,255,255,0.72)", fontSize: 13, fontFamily: "Inter_500Medium", marginTop: -2 }}>
          {over ? "Ortib ketdi" : "Qolgan kaloriyalar"}
        </Text>
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const {
    profile,
    entries,
    addEntry,
    removeEntry,
    burnedByDate,
    addBurned,
    todayKey,
    exercisePlan,
    setExercisePlan,
    setExerciseStatus,
    replaceExerciseAt,
    clearExercisePlan,
    tourPending,
    clearTourPending,
    addFoodModalVisible,
    setAddFoodModalVisible,
  } = useApp();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const modalOpen = addFoodModalVisible;
  const setModalOpen = setAddFoodModalVisible;
  const [exerciseOpen, setExerciseOpen] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [toast, setToast] = useState<{ visible: boolean; message: string }>({
    visible: false,
    message: "",
  });
  const [showMealRings, setShowMealRings] = useState(true);
  const [tourVisible, setTourVisible] = useState(false);
  const wasOverRef = useRef(false);

  const ringWrapRef = useRef<View>(null);
  const macroRowRef = useRef<View>(null);

  useEffect(() => {
    if (tourPending) {
      const t = setTimeout(() => {
        clearTourPending();
        setTourVisible(true);
      }, 600);
      return () => clearTimeout(t);
    }
  }, [tourPending, clearTourPending]);

  const dayEntries = entries.filter((e) => e.date === todayKey);

  const rawCal = dayEntries.reduce((s, e) => s + (Number.isFinite(e.cal) ? e.cal : 0), 0);
  const totalProtein = dayEntries.reduce((s, e) => s + (Number.isFinite(e.protein) ? e.protein : 0), 0);
  const totalCarbs = dayEntries.reduce((s, e) => s + (Number.isFinite(e.carbs) ? e.carbs : 0), 0);
  const totalFat = dayEntries.reduce((s, e) => s + (Number.isFinite(e.fat) ? e.fat : 0), 0);
  const burnedToday = burnedByDate[todayKey] ?? 0;
  const totalCal = Math.max(0, rawCal - burnedToday);

  const goal = profile.dailyCalories ?? 1993;
  const goalProtein = profile.protein ?? 154;
  const goalCarbs = profile.carbs ?? 189;
  const goalFat = profile.fat ?? 69;

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 100 : insets.bottom + 90;

  const handleAdd = (food: {
    name: string;
    cal: number;
    source: "camera" | "gallery" | "text" | "catalog";
    protein?: number;
    carbs?: number;
    fat?: number;
    portion?: string;
    emoji?: string;
    imageUri?: string;
  }) => {
    const protein = food.protein ?? Math.round((food.cal * 0.25) / 4);
    const carbs = food.carbs ?? Math.round((food.cal * 0.5) / 4);
    const fat = food.fat ?? Math.round((food.cal * 0.25) / 9);
    addEntry({
      name: food.name,
      cal: food.cal,
      source: food.source,
      protein,
      carbs,
      fat,
      portion: food.portion,
      emoji: food.emoji,
      imageUri: food.imageUri,
    });
    setToast({
      visible: true,
      message: `${food.name} qo'shildi · +${Math.round(food.cal)} kkal`,
    });
  };

  const handleDeleteEntry = (id: string, name: string) => {
    Alert.alert(
      "Yozuvni o'chirish",
      `"${name}" yozuvini o'chirmoqchimisiz?`,
      [
        { text: "Bekor qilish", style: "cancel" },
        {
          text: "O'chirish",
          style: "destructive",
          onPress: () => removeEntry(id),
        },
      ],
    );
  };

  return (
    <LinearGradient colors={["#FFFFFF", "#EDF7ED", "#E2F5E2"]} style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: topPad + 8, paddingBottom: bottomPad },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <Image
          source={require("../../assets/images/logo.png")}
          style={styles.headerLogo}
          contentFit="contain"
        />

        {/* AI Banner */}
        <Pressable
          onPress={() => router.push("/ai" as never)}
          style={({ pressed }) => [styles.aiBannerWrap, { opacity: pressed ? 0.88 : 1 }]}
        >
          <LinearGradient
            colors={["#1E5C1E", "#2D8A2D", "#4CAF50"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.aiBanner}
          >
            <View style={styles.aiIconCircle}>
              <Text style={styles.aiIconText}>A</Text>
            </View>
            <Text style={styles.aiBannerText} numberOfLines={1}>
              Bugun balansli ovqatlaning!
            </Text>
            <View style={styles.aiTavsiyaBtn}>
              <Text style={styles.aiTavsiyaText}>AI Tavsiyasi</Text>
            </View>
          </LinearGradient>
        </Pressable>

        {/* Glowing Calorie Ring */}
        <View ref={ringWrapRef} style={styles.ringWrap}>
          <HomeRing value={totalCal} goal={goal} />
          {burnedToday > 0 ? (
            <View style={[styles.burnedBadge, { backgroundColor: "#4CAF5020" }]}>
              <MaterialCommunityIcons name="fire" size={14} color="#22C55E" />
              <Text style={[styles.burnedBadgeText, { color: "#22C55E" }]}>
                Mashqlar bilan yoqildi: −{burnedToday} kkal
              </Text>
            </View>
          ) : null}
        </View>

        <View ref={macroRowRef} style={styles.macroRow}>
          <MacroCard
            emoji="🍗"
            value={Math.max(goalProtein - totalProtein, 0)}
            unit="g"
            label="Qolgan oqsil"
            consumed={totalProtein}
            goal={goalProtein}
            color={colors.chartRed}
          />
          <MacroCard
            emoji="🌾"
            value={Math.max(goalCarbs - totalCarbs, 0)}
            unit="g"
            label="Qolgan uglevod"
            consumed={totalCarbs}
            goal={goalCarbs}
            color={colors.accent}
          />
          <MacroCard
            emoji="🥑"
            value={Math.max(goalFat - totalFat, 0)}
            unit="g"
            label="Qolgan yog'lar"
            consumed={totalFat}
            goal={goalFat}
            color="#3B82F6"
          />
        </View>

        {showCelebration ? (
          <View
            style={[
              styles.celebrateBox,
              { backgroundColor: "#ECFDF5", borderColor: colors.primary },
            ]}
          >
            <Text style={styles.celebrateEmoji}>🎉</Text>
            <Text style={[styles.celebrateTitle, { color: colors.primary }]}>
              Tabriklaymiz! Kunlik plan bajarildi
            </Text>
            <Text style={[styles.celebrateSub, { color: "#065F46" }]}>
              Siz mashqlar bilan ortiqcha kaloriyalarni yoqib, normangizga qaytdingiz.
              Sog'lig'ingiz uchun katta qadam!
            </Text>
            <Pressable
              onPress={() => setShowCelebration(false)}
              style={({ pressed }) => [
                styles.celebrateBtn,
                { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={styles.celebrateBtnText}>Yopish</Text>
            </Pressable>
          </View>
        ) : null}

        {(() => {
          const overCal = Math.max(totalCal - goal, 0);
          const overP = Math.max(totalProtein - goalProtein, 0);
          const overC = Math.max(totalCarbs - goalCarbs, 0);
          const overF = Math.max(totalFat - goalFat, 0);
          const anyOver = overCal > 0 || overP > 0 || overC > 0 || overF > 0;
          if (anyOver) wasOverRef.current = true;
          if (!anyOver) return null;
          const overChips: string[] = [];
          if (overCal > 0) overChips.push(`+${overCal} kkal`);
          if (overP > 0) overChips.push(`+${overP}g oqsil`);
          if (overC > 0) overChips.push(`+${overC}g uglevod`);
          if (overF > 0) overChips.push(`+${overF}g yog'`);
          return (
            <View
              style={[
                styles.alertBox,
                { backgroundColor: "#FEF2F2", borderColor: colors.destructive },
              ]}
            >
              <View style={styles.alertHead}>
                <MaterialCommunityIcons
                  name="alert-circle"
                  size={22}
                  color={colors.destructive}
                />
                <Text style={[styles.alertTitle, { color: colors.destructive }]}>
                  Norma oshib ketdi
                </Text>
              </View>
              <Text style={[styles.alertSub, { color: "#7F1D1D" }]}>
                Quyidagi ko'rsatkichlar normadan oshdi:
              </Text>
              <View style={styles.alertChips}>
                {overChips.map((c) => (
                  <View
                    key={c}
                    style={[styles.alertChip, { borderColor: colors.destructive }]}
                  >
                    <Text style={[styles.alertChipText, { color: colors.destructive }]}>
                      {c}
                    </Text>
                  </View>
                ))}
              </View>
              {(() => {
                const planForToday =
                  exercisePlan && exercisePlan.date === todayKey ? exercisePlan : null;
                const allDone =
                  planForToday !== null &&
                  planForToday.exercises.length > 0 &&
                  planForToday.exercises.every(
                    (_, i) => planForToday.statuses[i] === "done",
                  );
                if (overCal <= 0) {
                  return (
                    <Text style={[styles.alertHint, { color: "#7F1D1D" }]}>
                      Kaloriya normangizdan oshmadi — mashq shart emas. Faqat makro
                      nutrientlarga e'tibor bering: ertaga oqsil, uglevod va yog'
                      miqdorini muvozanatda tuting.
                    </Text>
                  );
                }
                if (allDone) {
                  // User completed all previous exercises but ate more food
                  // and is over again — offer a brand-new plan for the new
                  // overshoot.
                  return (
                    <>
                      <Text style={[styles.alertHint, { color: "#7F1D1D" }]}>
                        Avvalgi mashqlar bajarildi, lekin yangi ovqatdan keyin yana
                        ortiqcha kaloriya paydo bo'ldi. Quyidagi tugmadan AI sizga
                        yangi mashqlar dasturini tuzib beradi.
                      </Text>
                      <Pressable
                        onPress={() => {
                          clearExercisePlan();
                          setExerciseOpen(true);
                        }}
                        accessibilityRole="button"
                        style={({ pressed }) => [
                          styles.exerciseBtn,
                          {
                            backgroundColor: colors.destructive,
                            opacity: pressed ? 0.85 : 1,
                          },
                        ]}
                      >
                        <MaterialCommunityIcons name="dumbbell" size={20} color="#FFFFFF" />
                        <Text style={styles.exerciseBtnText}>
                          Yangi mashqlar dasturini tuzish
                        </Text>
                      </Pressable>
                    </>
                  );
                }
                const hasPlan = planForToday !== null;
                return (
                  <>
                    <Text style={[styles.alertHint, { color: "#7F1D1D" }]}>
                      {hasPlan
                        ? "Quyidagi tugma orqali avval tuzilgan mashqlar dasturini davom ettiring."
                        : "Parhez qoidasi: ortiqcha kaloriyalarni mashqlar bilan yo'qoting. Quyidagi tugmadan AI sizga shaxsiy mashqlar dasturini tuzib beradi."}
                    </Text>
                    <Pressable
                      onPress={() => setExerciseOpen(true)}
                      accessibilityRole="button"
                      style={({ pressed }) => [
                        styles.exerciseBtn,
                        {
                          backgroundColor: colors.destructive,
                          opacity: pressed ? 0.85 : 1,
                        },
                      ]}
                    >
                      <MaterialCommunityIcons name="dumbbell" size={20} color="#FFFFFF" />
                      <Text style={styles.exerciseBtnText}>
                        {hasPlan
                          ? "Mashqlar dasturini davom ettirish"
                          : "Mashqlar dasturini ko'rish"}
                      </Text>
                    </Pressable>
                  </>
                );
              })()}
            </View>
          );
        })()}

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Yaqinda iste'mol qilindi</Text>
          <Pressable
            onPress={() => router.push("/stats")}
            hitSlop={8}
            style={({ pressed }) => [
              styles.statsBtn,
              {
                backgroundColor: colors.primary + "18",
                borderColor: colors.primary,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Feather name="bar-chart-2" size={14} color={colors.primary} />
            <Text style={[styles.statsBtnText, { color: colors.primary }]}>Statistika</Text>
          </Pressable>
        </View>

        {dayEntries.length === 0 ? (
          <View
            style={[styles.emptyCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}
          >
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              Hozircha ma'lumot yo'q!
            </Text>
            <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
              Bugungi ovqatlaringizni tez suratga olib kuzatishni boshlang
            </Text>
          </View>
        ) : (
          dayEntries.map((e) => (
            <Pressable
              key={e.id}
              onLongPress={() => handleDeleteEntry(e.id, e.name)}
              delayLongPress={400}
              accessibilityRole="button"
              accessibilityLabel={`${e.name}, ${e.cal} kaloriya`}
              accessibilityHint="Yozuvni o'chirish uchun bosib turing"
              style={({ pressed }) => [
                styles.entryCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              {e.imageUri ? (
                <Image
                  source={{ uri: e.imageUri }}
                  style={styles.entryThumb}
                  contentFit="cover"
                  transition={120}
                  cachePolicy="memory-disk"
                />
              ) : (
                <View style={[styles.entryIcon, { backgroundColor: colors.secondary }]}>
                  {e.emoji ? (
                    <Text style={styles.entryIconEmoji}>{e.emoji}</Text>
                  ) : (
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
                      size={18}
                      color={colors.primary}
                    />
                  )}
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={[styles.entryName, { color: colors.text }]} numberOfLines={1}>
                  {e.name}
                </Text>
                <Text style={[styles.entryMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {e.time}{e.portion ? ` · ${e.portion}` : ""} · {e.protein}g B · {e.carbs}g U · {e.fat}g Y
                </Text>
              </View>
              <View style={styles.entryRight}>
                <Text style={[styles.entryCal, { color: colors.primary }]}>{e.cal} kal</Text>
                <Pressable
                  onPress={() => handleDeleteEntry(e.id, e.name)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="O'chirish"
                  style={({ pressed }) => [
                    styles.deleteBtn,
                    { opacity: pressed ? 0.5 : 1 },
                  ]}
                >
                  <Feather name="trash-2" size={16} color={colors.destructive} />
                </Pressable>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>

      <SuccessToast
        visible={toast.visible}
        message={toast.message}
        onHide={() => setToast({ visible: false, message: "" })}
      />

      <AddFoodModal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        onAdd={handleAdd}
        dailyCalories={goal}
        remainingCal={Math.max(goal - totalCal, 0)}
        userContext={{
          gender: profile.gender,
          heightCm: profile.height,
          currentWeight: profile.currentWeight,
          targetWeight: profile.targetWeight,
          goal: profile.goal,
          dailyCalories: goal,
          dailyProtein: goalProtein,
          dailyCarbs: goalCarbs,
          dailyFat: goalFat,
          mealsPerDay: profile.mealsPerDay,
          remainingCal: Math.max(goal - totalCal, 0),
        }}
      />

      <TourOverlay
        visible={tourVisible}
        onFinish={() => setTourVisible(false)}
        primaryColor={colors.primary}
        textColor={colors.text}
        cardBg={colors.card}
        mutedColor={colors.mutedForeground}
        steps={[
          {
            ref: ringWrapRef,
            title: "Kunlik kaloriya doirasi",
            description: "Bu sizning kunlik kaloriya rejangizni ko'rsatadi. Doira to'lgani sari maqsadingizga yaqinlashyapsiz.",
          },
          {
            ref: macroRowRef,
            title: "Makro moddalar",
            description: "Oqsil, uglevod va yog'larning kunlik normasi. Sog'lom va muvozanatli ovqatlanish uchun muhim.",
          },
          {
            ref: macroRowRef,
            title: "Ovqat qo'shish",
            description: "Pastdagi kamera tugmasi orqali kamera, galereya yoki matn yordamida ovqat qo'sha olasiz. AI avtomatik kaloriyasini hisoblab beradi.",
          },
        ]}
      />

      <ExerciseModal
        visible={exerciseOpen}
        onClose={() => {
          setExerciseOpen(false);
          if (
            wasOverRef.current &&
            totalCal <= goal &&
            totalProtein <= goalProtein &&
            totalCarbs <= goalCarbs &&
            totalFat <= goalFat
          ) {
            setShowCelebration(true);
            wasOverRef.current = false;
          }
        }}
        profile={profile}
        overshoot={{
          calories: Math.max(totalCal - goal, 0),
          protein: Math.max(totalProtein - goalProtein, 0),
          carbs: Math.max(totalCarbs - goalCarbs, 0),
          fat: Math.max(totalFat - goalFat, 0),
        }}
        colors={colors}
        onBurned={(cal) => addBurned(cal)}
        todayKey={todayKey}
        storedPlan={exercisePlan && exercisePlan.date === todayKey ? exercisePlan : null}
        onSavePlan={setExercisePlan}
        onUpdateStatus={setExerciseStatus}
        onReplaceExercise={replaceExerciseAt}
      />
    </LinearGradient>
  );
}

interface ExerciseItem {
  name: string;
  emoji: string;
  when: string;
  state: string;
  duration: string;
  burnsCal: number;
  instruction: string;
}
interface ExercisePlanResp {
  summary: string;
  warning: string;
  exercises: ExerciseItem[];
}

const API_BASE_EX = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "https://dietaai-lexhk.ondigitalocean.app";

import type {
  ExercisePlanItem as CtxExItem,
  ExStatus,
  StoredExercisePlan,
} from "@/context/AppContext";

function ExerciseModal({
  visible,
  onClose,
  profile,
  overshoot,
  colors,
  onBurned,
  todayKey,
  storedPlan,
  onSavePlan,
  onUpdateStatus,
  onReplaceExercise,
}: {
  visible: boolean;
  onClose: () => void;
  profile: ReturnType<typeof useApp>["profile"];
  overshoot: { calories: number; protein: number; carbs: number; fat: number };
  colors: ReturnType<typeof useColors>;
  onBurned: (cal: number) => void;
  todayKey: string;
  storedPlan: StoredExercisePlan | null;
  onSavePlan: (plan: StoredExercisePlan) => void;
  onUpdateStatus: (idx: number, status: ExStatus) => void;
  onReplaceExercise: (idx: number, item: CtxExItem) => void;
}) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [altLoading, setAltLoading] = useState<number | null>(null);

  const plan = storedPlan;
  const statuses = storedPlan?.statuses ?? {};

  const lockedOverRef = useRef<{ calories: number; protein: number; carbs: number; fat: number } | null>(null);

  const fetchPlan = async (signal?: { cancelled: boolean }) => {
    setLoading(true);
    setError(null);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 50_000);
    try {
      const age = profile.birthDate
        ? new Date().getFullYear() - profile.birthDate.year
        : undefined;
      const lockedOver = lockedOverRef.current ?? overshoot;
      const res = await fetch(`${API_BASE_EX}/api/ai/exercise-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: {
            gender: profile.gender,
            age,
            heightCm: profile.height,
            currentWeight: profile.currentWeight,
            goal: profile.goal,
          },
          overshoot: lockedOver,
        }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as ExercisePlanResp;
      if (!signal?.cancelled) {
        onSavePlan({
          date: todayKey,
          summary: data.summary ?? "",
          warning: data.warning ?? "",
          exercises: data.exercises ?? [],
          statuses: {},
        });
      }
    } catch (err) {
      const isAbort = (err as { name?: string })?.name === "AbortError";
      if (!signal?.cancelled) {
        setError(
          isAbort
            ? "AI javob bermadi (vaqt tugadi). Internetni tekshirib qaytadan urining."
            : "Mashqlar dasturi tuzilmadi. Qaytadan urining.",
        );
      }
    } finally {
      clearTimeout(timer);
      if (!signal?.cancelled) setLoading(false);
    }
  };

  useEffect(() => {
    if (!visible) {
      lockedOverRef.current = null;
      return;
    }
    lockedOverRef.current = { ...overshoot };
    if (storedPlan) return;
    const signal = { cancelled: false };
    fetchPlan(signal);
    return () => {
      signal.cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handleRegenerate = () => {
    lockedOverRef.current = { ...overshoot };
    const signal = { cancelled: false };
    fetchPlan(signal);
  };

  const handleStart = (idx: number) => {
    onUpdateStatus(idx, "started");
  };

  const handleDone = (idx: number, burnsCal: number) => {
    onUpdateStatus(idx, "done");
    onBurned(burnsCal);
  };

  const handleAlt = async (idx: number, ex: ExerciseItem) => {
    if (!plan) return;
    setAltLoading(idx);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 50_000);
    try {
      const age = profile.birthDate
        ? new Date().getFullYear() - profile.birthDate.year
        : undefined;
      const excludeNames = plan.exercises.map((e) => e.name);
      const res = await fetch(`${API_BASE_EX}/api/ai/exercise-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: {
            gender: profile.gender,
            age,
            heightCm: profile.height,
            currentWeight: profile.currentWeight,
            goal: profile.goal,
          },
          overshoot: { calories: ex.burnsCal, protein: 0, carbs: 0, fat: 0 },
          alternativeFor: ex.name,
          excludeNames,
        }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as ExercisePlanResp;
      if (data.exercises && data.exercises.length > 0) {
        onReplaceExercise(idx, data.exercises[0]);
      }
    } catch {}
    finally {
      clearTimeout(timer);
      setAltLoading(null);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={[styles.exModalRoot, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.exHeader,
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
            <Text style={[styles.exTitle, { color: colors.text }]}>
              Mashqlar dasturi
            </Text>
            <Text
              style={[styles.exSub, { color: colors.mutedForeground }]}
              numberOfLines={1}
            >
              Ortiqcha kaloriyani yo'qotish uchun
            </Text>
          </View>
          {plan && !loading ? (
            <Pressable
              onPress={handleRegenerate}
              hitSlop={10}
              style={{ padding: 4, marginRight: 8 }}
              accessibilityLabel="Yangi plan tuzish"
            >
              <Feather name="refresh-cw" size={20} color={colors.mutedForeground} />
            </Pressable>
          ) : null}
          <MaterialCommunityIcons name="dumbbell" size={22} color={colors.primary} />
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32 }}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={styles.exCenter}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.exCenterText, { color: colors.mutedForeground }]}>
                AI shaxsiy mashqlar dasturini tuzmoqda...
              </Text>
            </View>
          ) : error ? (
            <View style={styles.exCenter}>
              <Feather name="alert-circle" size={36} color={colors.destructive} />
              <Text style={[styles.exCenterText, { color: colors.destructive }]}>
                {error}
              </Text>
            </View>
          ) : plan ? (
            <>
              {plan.summary ? (
                <View
                  style={[
                    styles.exSummary,
                    { backgroundColor: colors.secondary, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.exSummaryText, { color: colors.text }]}>
                    {plan.summary}
                  </Text>
                </View>
              ) : null}

              {plan.warning ? (
                <View
                  style={[
                    styles.exWarn,
                    { backgroundColor: "#FEF3C7", borderColor: "#F59E0B" },
                  ]}
                >
                  <Feather name="alert-triangle" size={18} color="#92400E" />
                  <Text style={[styles.exWarnText, { color: "#92400E" }]}>
                    {plan.warning}
                  </Text>
                </View>
              ) : null}

              <View style={styles.exTotalRow}>
                <Text style={[styles.exTotalLabel, { color: colors.mutedForeground }]}>
                  Jami yoqiladi:
                </Text>
                <Text style={[styles.exTotalVal, { color: colors.primary }]}>
                  ~{plan.exercises.reduce((s, e) => s + e.burnsCal, 0)} kkal
                </Text>
              </View>

              {plan.exercises.map((ex, idx) => {
                const st: ExStatus = statuses[idx] ?? "idle";
                const isDone = st === "done";
                const isStarted = st === "started";
                const isAltLoading = altLoading === idx;
                return (
                  <View
                    key={`${ex.name}-${idx}`}
                    style={[
                      styles.exCard,
                      {
                        backgroundColor: colors.card,
                        borderColor: isDone ? colors.primary : colors.border,
                        opacity: isDone ? 0.75 : 1,
                      },
                    ]}
                  >
                    <View style={styles.exCardHead}>
                      <View
                        style={[styles.exEmoji, { backgroundColor: colors.secondary }]}
                      >
                        <Text style={{ fontSize: 22 }}>{isDone ? "✅" : ex.emoji}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.exName,
                            {
                              color: colors.text,
                              textDecorationLine: isDone ? "line-through" : "none",
                            },
                          ]}
                        >
                          {ex.name}
                        </Text>
                        <Text style={[styles.exDur, { color: colors.mutedForeground }]}>
                          {ex.duration}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.exBurn,
                          { backgroundColor: colors.primary + "15" },
                        ]}
                      >
                        <Text style={[styles.exBurnText, { color: colors.primary }]}>
                          −{ex.burnsCal} kkal
                        </Text>
                      </View>
                    </View>

                    <View style={styles.exMetaRow}>
                      <View style={styles.exMetaItem}>
                        <Feather name="clock" size={13} color={colors.primary} />
                        <Text style={[styles.exMetaText, { color: colors.text }]}>
                          {ex.when}
                        </Text>
                      </View>
                      <View style={styles.exMetaItem}>
                        <Feather name="activity" size={13} color={colors.accent} />
                        <Text style={[styles.exMetaText, { color: colors.text }]}>
                          {ex.state}
                        </Text>
                      </View>
                    </View>

                    {ex.instruction ? (
                      <Text style={[styles.exInstr, { color: colors.mutedForeground }]}>
                        {ex.instruction}
                      </Text>
                    ) : null}

                    {isStarted ? (
                      <View
                        style={[
                          styles.exHealthWarn,
                          { backgroundColor: "#FEF2F2", borderColor: colors.destructive },
                        ]}
                      >
                        <Feather name="heart" size={16} color={colors.destructive} />
                        <Text
                          style={[styles.exHealthText, { color: colors.destructive }]}
                        >
                          ILTIMOS, sog'lig'ingizga JIDDIY e'tibor bering!
                          Mashq vaqtida og'riq, bosh aylanish yoki nafas qisilishi
                          bo'lsa — DARHOL to'xtang. Ko'p suv iching, ortga
                          urinmang. Shifokor maslahatisiz og'ir mashqlarni
                          bajarmang.
                        </Text>
                      </View>
                    ) : null}

                    {isDone ? (
                      <View
                        style={[
                          styles.exDoneBadge,
                          { backgroundColor: colors.primary + "20" },
                        ]}
                      >
                        <Feather name="check-circle" size={14} color={colors.primary} />
                        <Text
                          style={[styles.exDoneBadgeText, { color: colors.primary }]}
                        >
                          Bajarildi · −{ex.burnsCal} kkal yoqildi
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.exActionsRow}>
                        {isStarted ? (
                          <Pressable
                            onPress={() => handleDone(idx, ex.burnsCal)}
                            style={({ pressed }) => [
                              styles.exDoneBtn,
                              {
                                backgroundColor: colors.primary,
                                opacity: pressed ? 0.85 : 1,
                              },
                            ]}
                          >
                            <Feather name="check" size={16} color="#FFFFFF" />
                            <Text style={styles.exDoneBtnText}>Bajarildi</Text>
                          </Pressable>
                        ) : (
                          <Pressable
                            onPress={() => handleStart(idx)}
                            style={({ pressed }) => [
                              styles.exStartBtn,
                              {
                                backgroundColor: colors.primary,
                                opacity: pressed ? 0.85 : 1,
                              },
                            ]}
                          >
                            <Feather name="play" size={16} color="#FFFFFF" />
                            <Text style={styles.exStartBtnText}>Boshlash</Text>
                          </Pressable>
                        )}
                        <Pressable
                          onPress={() => { void handleAlt(idx, ex); }}
                          disabled={isAltLoading}
                          style={({ pressed }) => [
                            styles.exAltBtn,
                            {
                              backgroundColor: colors.secondary,
                              borderColor: colors.border,
                              opacity: isAltLoading ? 0.5 : pressed ? 0.7 : 1,
                            },
                          ]}
                        >
                          {isAltLoading ? (
                            <ActivityIndicator size="small" color={colors.primary} />
                          ) : (
                            <Feather name="refresh-cw" size={14} color={colors.text} />
                          )}
                          <Text style={[styles.exAltBtnText, { color: colors.text }]}>
                            Boshqa usullar
                          </Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                );
              })}
            </>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 20 },
  topHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  appTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
  },
  ratsionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1.5,
  },
  ratsionText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  headerLogo: { width: 120, height: 120, alignSelf: "center", marginBottom: 4 },
  aiBannerWrap: { marginBottom: 4 },
  aiBanner: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 28,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 10,
    shadowColor: "#2D8A2D",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  aiIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  aiIconText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  aiBannerText: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  aiTavsiyaBtn: {
    backgroundColor: "rgba(255,255,255,0.22)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  aiTavsiyaText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  ringWrap: { alignItems: "center", marginVertical: 16 },
  alertBox: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
    marginBottom: 20,
    gap: 8,
  },
  alertHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  alertTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  alertSub: { fontSize: 13, fontFamily: "Inter_500Medium" },
  alertChips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginVertical: 4 },
  alertChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1.5,
    backgroundColor: "#FFFFFF",
  },
  alertChipText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  alertHint: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  exerciseBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 4,
  },
  exerciseBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  exModalRoot: { flex: 1 },
  exHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  exTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  exSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  exCenter: { alignItems: "center", paddingTop: 80, gap: 16 },
  exCenterText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
    paddingHorizontal: 20,
  },
  exSummary: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  exSummaryText: { fontSize: 14, fontFamily: "Inter_500Medium", lineHeight: 20 },
  exWarn: {
    flexDirection: "row",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 12,
    marginBottom: 16,
  },
  exWarnText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    lineHeight: 18,
  },
  exTotalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  exTotalLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  exTotalVal: { fontSize: 18, fontFamily: "Inter_700Bold" },
  exCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 14,
    marginBottom: 10,
    gap: 10,
  },
  exCardHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  exEmoji: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  exName: { fontSize: 15, fontFamily: "Inter_700Bold" },
  exDur: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  exBurn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  exBurnText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  exMetaRow: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  exMetaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  exMetaText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  exInstr: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  exHealthWarn: {
    flexDirection: "row",
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 10,
    marginTop: 4,
  },
  exHealthText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 17,
  },
  exActionsRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  exStartBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
  },
  exStartBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  exDoneBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
  },
  exDoneBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  exAltBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  exAltBtnText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  exDoneBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 4,
  },
  exDoneBadgeText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  burnedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    marginTop: 8,
  },
  burnedBadgeText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  celebrateBox: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 18,
    alignItems: "center",
    marginBottom: 16,
    gap: 8,
  },
  celebrateEmoji: { fontSize: 44 },
  celebrateTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  celebrateSub: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
    lineHeight: 19,
  },
  celebrateBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 14,
    marginTop: 6,
  },
  celebrateBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  macroRow: { flexDirection: "row", gap: 8, marginTop: 24, marginBottom: 24 },
  mealRingsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 20,
    marginBottom: 4,
    paddingHorizontal: 2,
  },
  mealRingsTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  mealRingsToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  mealRingsToggleText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  mealRingsWrap: {
    marginTop: 10,
    gap: 14,
  },
  mealRingsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 4,
  },
  mealRingPlaceholder: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  statsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  statsBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    alignItems: "center",
    gap: 4,
  },
  emptyTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  emptySub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  entryCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  entryIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  entryIconEmoji: { fontSize: 22 },
  entryThumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#0001",
  },
  entryName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  entryMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  entryRight: { alignItems: "flex-end", gap: 4 },
  entryCal: { fontSize: 15, fontFamily: "Inter_700Bold" },
  deleteBtn: {
    padding: 4,
    borderRadius: 8,
  },
  macroTag: { fontSize: 11, fontFamily: "Inter_500Medium" },
  planRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
  planHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  planClose: { padding: 4 },
  planTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  planSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  planRefresh: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  dietChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
  },
  planLoading: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    gap: 16,
  },
  planLoadText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
    paddingHorizontal: 20,
  },
  retryBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 18,
    marginTop: 6,
  },
  planSummary: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryDivider: { width: 1, height: 32, backgroundColor: "rgba(0,0,0,0.08)" },
  summaryLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },
  summaryVal: { fontSize: 17, fontFamily: "Inter_700Bold", marginTop: 2 },
  summaryUnit: { fontSize: 10, fontFamily: "Inter_400Regular" },
  planMeal: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 12,
    marginBottom: 10,
  },
  planMealLabel: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  planMealRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  planMealIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  planMealName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  planMealPortion: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  planMacroRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  planAddBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
});
