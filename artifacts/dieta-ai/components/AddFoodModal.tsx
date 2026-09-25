import { Feather } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import {
  aiAnalyzeImage,
  aiAnalyzeText,
  type AiNutritionResponse,
  type FoodSide,
  type FoodVariant,
} from "@/lib/api-client";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { TRIAL_DAILY_SCAN_LIMIT, useApp, type ScanBlockReason } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { MEAL_INFO, MEAL_ORDER, mealForTime, type MealType } from "@/lib/meals";
import { CustomFoodEditor } from "@/components/CustomFoodEditor";
import { QuickAddStrip } from "@/components/QuickAddStrip";
import { foodKey, useTracker, type SavedFood } from "@/context/TrackerContext";

function savedFoodFields(f: SavedFood): Omit<SavedFood, "id"> {
  return {
    name: f.name,
    emoji: f.emoji,
    portion: f.portion,
    cal: f.cal,
    protein: f.protein,
    carbs: f.carbs,
    fat: f.fat,
  };
}
import {
  CATEGORIES,
  FOOD_DB,
  type FoodCategory,
  type FoodItem,
} from "@/lib/foodDatabase";

type ColorPalette = ReturnType<typeof useColors>;
type ImageMime = "image/png" | "image/webp" | "image/jpeg";
type Source = "camera" | "gallery" | "text" | "catalog";
type Step = "choose" | "instructions" | "catalog" | "confirm" | "ai-confirm" | "text-confirm" | "error";

interface ExtraItem {
  note: string;
  cal: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface AiResult {
  name: string;
  portion: string;
  portionGrams?: number;
  emoji: string;
  cal: number;
  protein: number;
  carbs: number;
  fat: number;
  caloriesPer100?: number;
  unitPer100?: "g" | "ml";
  unitName?: string;
  unitGrams?: number;
  units?: number;
  coachAdvice?: string;
  recommendedUnits?: number;
  recommendedCal?: number;
  recommendedProtein?: number;
  recommendedCarbs?: number;
  recommendedFat?: number;
  /** 0–1; the AI's own certainty. Low values (blurry / partial photo) get a warning. */
  confidence?: number;
  source: Source;
  imageUri?: string;
  extras?: ExtraItem[];
  /** Look-alike types of this dish (filling, cooking, meat) — see VariantPicker. */
  variants?: FoodVariant[];
  variantQuestion?: string;
  selectedVariant?: number;
  /** The AI's own pick; its advice/recommendation numbers only hold for it. */
  defaultVariant?: number;
  /** Dish name without the variant label, e.g. "Somsa". */
  baseName?: string;
  aiAdviceSnapshot?: Pick<
    AiResult,
    "coachAdvice" | "recommendedCal" | "recommendedProtein" | "recommendedCarbs" | "recommendedFat"
  >;
  /** Other dishes found on the same plate; each is saved as its own diary entry if included. */
  sides?: SideItem[];
}

type SideItem = FoodSide & { included: boolean };

type ConfirmTotals = {
  cal: number;
  protein: number;
  carbs: number;
  fat: number;
  portionLabel: string;
  extrasSummary?: string;
};

function sumSides(sides: SideItem[] | undefined) {
  const on = (sides ?? []).filter((s) => s.included);
  return {
    cal: on.reduce((t, s) => t + s.calories, 0),
    protein: on.reduce((t, s) => t + s.protein, 0),
    carbs: on.reduce((t, s) => t + s.carbs, 0),
    fat: on.reduce((t, s) => t + s.fat, 0),
    count: on.length,
  };
}

function variantName(base: string, v: FoodVariant): string {
  return `${base} (${v.label.toLowerCase()})`;
}

export interface AddedFood {
  name: string;
  cal: number;
  source: Source;
  protein?: number;
  carbs?: number;
  fat?: number;
  portion?: string;
  emoji?: string;
  imageUri?: string;
  meal?: MealType;
}

interface AiUserContext {
  gender?: string;
  age?: number;
  heightCm?: number;
  currentWeight?: number;
  targetWeight?: number;
  goal?: string;
  dailyCalories?: number;
  dailyProtein?: number;
  dailyCarbs?: number;
  dailyFat?: number;
  mealsPerDay?: number;
  remainingCal?: number;
}

interface AddFoodModalProps {
  visible: boolean;
  onClose: () => void;
  /** One call per confirm; a photo of a full plate yields several foods. */
  onAdd: (foods: AddedFood[]) => void;
  /** Meal to preselect; defaults to the one matching the current time. */
  meal?: MealType;
  remainingCal?: number;
  dailyCalories?: number;
  userContext?: AiUserContext;
}

const ACCENT: Record<Source, string> = {
  camera: "#2C5F1A",
  gallery: "#2563EB",
  text: "#7C3AED",
  catalog: "#E07A1F",
};

export function AddFoodModal({
  visible,
  onClose,
  onAdd: onAddProp,
  meal: initialMeal,
  remainingCal,
  dailyCalories,
  userContext,
}: AddFoodModalProps) {
  const buildCtx = (): AiUserContext | undefined => {
    if (!userContext && remainingCal == null && dailyCalories == null) return undefined;
    const merged: AiUserContext = { ...(userContext ?? {}) };
    if (merged.dailyCalories == null && dailyCalories != null) merged.dailyCalories = dailyCalories;
    if (merged.remainingCal == null && remainingCal != null) merged.remainingCal = remainingCal;
    return merged;
  };
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { subscription, canScan, registerScan, entries } = useApp();
  const { favorites, customFoods, isFavorite, toggleFavorite } = useTracker();
  // Latest distinct foods the user logged, newest first (entries are stored newest first).
  const recentFoods = React.useMemo(() => {
    const seen = new Set<string>();
    const out: SavedFood[] = [];
    for (const e of entries) {
      const k = foodKey(e.name);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({
        id: e.id,
        name: e.name,
        emoji: e.emoji,
        portion: e.portion,
        cal: e.cal,
        protein: e.protein,
        carbs: e.carbs,
        fat: e.fat,
      });
      if (out.length >= 15) break;
    }
    return out;
  }, [entries]);
  const [step, setStep] = useState<Step>("choose");
  const [activeSource, setActiveSource] = useState<Source | null>(null);
  const [textInput, setTextInput] = useState("");
  const [loading, setLoading] = useState<Source | null>(null);
  const [catalogTab, setCatalogTab] = useState<"all" | FoodCategory>("all");
  const [catalogQuery, setCatalogQuery] = useState("");
  const [pickedFood, setPickedFood] = useState<FoodItem | null>(null);
  const [aiResult, setAiResult] = useState<AiResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorDetected, setErrorDetected] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [meal, setMeal] = useState<MealType>(() => initialMeal ?? mealForTime());
  const [creatingFood, setCreatingFood] = useState(false);
  const onAdd = (foods: AddedFood[]) => onAddProp(foods.map((f) => ({ ...f, meal: f.meal ?? meal })));

  const fade = useRef(new Animated.Value(0)).current;
  const sheetY = useRef(new Animated.Value(40)).current;
  const stepFade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      setMeal(initialMeal ?? mealForTime());
      setStep("choose");
      setActiveSource(null);
      setTextInput("");
      setLoading(null);
      setCatalogTab("all");
      setCatalogQuery("");
      setPickedFood(null);
      setAiResult(null);
      setErrorMsg(null);
      setErrorDetected(null);
      setErrorStatus(null);
      stepFade.setValue(1);
      Animated.parallel([
        Animated.timing(fade, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(sheetY, {
          toValue: 0,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fade.setValue(0);
      sheetY.setValue(40);
    }
  }, [visible]);

  const triggerHaptic = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(style).catch(() => {});
    }
  };

  const animateStep = (next: Step, src: Source | null) => {
    Animated.timing(stepFade, {
      toValue: 0,
      duration: 140,
      useNativeDriver: true,
    }).start(() => {
      setStep(next);
      setActiveSource(src);
      Animated.timing(stepFade, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();
    });
  };

  const handleQuickAdd = (f: SavedFood) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    onAdd([
      {
        name: f.name,
        cal: f.cal,
        protein: f.protein,
        carbs: f.carbs,
        fat: f.fat,
        portion: f.portion,
        emoji: f.emoji,
        source: "catalog",
      },
    ]);
    onClose();
  };

  const handlePickVariant = (src: Source) => {
    triggerHaptic();
    if (src === "catalog") {
      animateStep("catalog", src);
    } else {
      animateStep("instructions", src);
    }
  };

  const handleBack = () => {
    triggerHaptic();
    if (step === "confirm") {
      animateStep("catalog", "catalog");
      setPickedFood(null);
    } else if (step === "error" && errorStatus?.startsWith("scan_")) {
      // Retrying the photo would hit the same limit — offer the other ways in.
      setErrorMsg(null);
      setErrorStatus(null);
      animateStep("choose", null);
    } else if (step === "ai-confirm" || step === "text-confirm" || step === "error") {
      const src = activeSource ?? "camera";
      setAiResult(null);
      setErrorMsg(null);
      setErrorDetected(null);
      setErrorStatus(null);
      animateStep("instructions", src === "catalog" ? "camera" : src);
    } else {
      animateStep("choose", null);
    }
  };

  const handlePickFromCatalog = (food: FoodItem) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    setPickedFood(food);
    animateStep("confirm", "catalog");
  };

  const handleConfirmCatalog = () => {
    if (!pickedFood) return;
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    onAdd([
      {
        name: pickedFood.name,
        cal: pickedFood.cal,
        protein: pickedFood.protein,
        carbs: pickedFood.carbs,
        fat: pickedFood.fat,
        portion: pickedFood.portion,
        emoji: pickedFood.emoji,
        source: "catalog",
      },
    ]);
    onClose();
  };

  const showAnalysisResult = (
    analysis: AiNutritionResponse,
    source: Source,
    imageUri?: string,
  ) => {
    if (analysis.status === "ok") {
      const baseName = analysis.name ?? "Aniqlanmagan taom";
      const variants =
        analysis.variants && analysis.variants.length >= 2 ? analysis.variants : undefined;
      const defaultVariant =
        variants && analysis.defaultVariant != null && analysis.defaultVariant < variants.length
          ? analysis.defaultVariant
          : 0;
      setAiResult({
        source,
        name: variants ? variantName(baseName, variants[defaultVariant]) : baseName,
        baseName,
        portion: analysis.portion ?? "1 porsiya",
        portionGrams: analysis.portionGrams,
        emoji: analysis.emoji ?? "🍽️",
        cal: analysis.calories ?? 0,
        protein: analysis.protein ?? 0,
        carbs: analysis.carbs ?? 0,
        fat: analysis.fat ?? 0,
        caloriesPer100: analysis.caloriesPer100,
        unitPer100: analysis.unitPer100 ?? "g",
        unitName: analysis.unitName,
        unitGrams: analysis.unitGrams,
        units: analysis.units,
        coachAdvice: analysis.coachAdvice,
        recommendedUnits: analysis.recommendedUnits,
        recommendedCal: analysis.recommendedCal,
        recommendedProtein: analysis.recommendedProtein,
        recommendedCarbs: analysis.recommendedCarbs,
        recommendedFat: analysis.recommendedFat,
        confidence: analysis.confidence,
        imageUri,
        variants,
        variantQuestion: variants ? analysis.variantQuestion ?? "Qaysi turi?" : undefined,
        selectedVariant: variants ? defaultVariant : undefined,
        defaultVariant: variants ? defaultVariant : undefined,
        sides: analysis.sides?.length
          ? analysis.sides.map((s) => ({ ...s, included: true }))
          : undefined,
        aiAdviceSnapshot: variants
          ? {
              coachAdvice: analysis.coachAdvice,
              recommendedCal: analysis.recommendedCal,
              recommendedProtein: analysis.recommendedProtein,
              recommendedCarbs: analysis.recommendedCarbs,
              recommendedFat: analysis.recommendedFat,
            }
          : undefined,
      });
      animateStep(source === "text" ? "text-confirm" : "ai-confirm", source);
    } else {
      setErrorMsg(
        analysis.reason ??
          "Tahlil amalga oshmadi. Iltimos, qaytadan urinib ko'ring.",
      );
      setErrorDetected(analysis.detected ?? null);
      setErrorStatus(analysis.status ?? null);
      animateStep("error", source);
    }
  };

  const persistFoodImage = async (
    sourceUri: string,
    mimeType: ImageMime,
  ): Promise<string | undefined> => {
    try {
      const docDir = FileSystem.documentDirectory;
      if (!docDir) return undefined;
      const folder = `${docDir}food_images/`;
      await FileSystem.makeDirectoryAsync(folder, { intermediates: true }).catch(
        () => undefined,
      );
      const ext =
        mimeType === "image/png"
          ? "png"
          : mimeType === "image/webp"
            ? "webp"
            : "jpg";
      const dest = `${folder}img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
      await FileSystem.copyAsync({ from: sourceUri, to: dest });
      return dest;
    } catch {
      return undefined;
    }
  };

  const recognizeImage = async (
    source: "camera" | "gallery",
    base64: string,
    mimeType: ImageMime,
    imageUri?: string,
  ) => {
    setLoading(source);
    try {
      const res = await aiAnalyzeImage({ imageBase64: base64, mimeType, userContext: buildCtx() });
      // Only a recognised dish uses up a trial scan; blurry or non-food shots don't.
      if (res.status === "ok") registerScan();
      showAnalysisResult(res, source, imageUri);
    } catch {
      setErrorMsg("Internet bilan bog'lanishda xatolik. Qaytadan urinib ko'ring.");
      setErrorDetected(null);
      setErrorStatus(null);
      animateStep("error", source);
    } finally {
      setLoading(null);
    }
  };

  const pickAndAnalyze = async (source: "camera" | "gallery") => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    const allowance = canScan();
    if (!allowance.allowed) {
      setErrorMsg(scanBlockMessage(allowance.reason));
      setErrorDetected(null);
      setErrorStatus(allowance.reason === "daily_limit" ? "scan_limit" : "scan_locked");
      animateStep("error", source);
      return;
    }
    if (Platform.OS === "web") {
      setErrorMsg("Rasm tahlili faqat mobil ilovada ishlaydi.");
      setErrorDetected(null);
      setErrorStatus(null);
      animateStep("error", source);
      return;
    }
    try {
      if (source === "camera") {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return;
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) return;
      }
      const r =
        source === "camera"
          ? await ImagePicker.launchCameraAsync({
              quality: 0.4,
              base64: true,
              allowsEditing: false,
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
            })
          : await ImagePicker.launchImageLibraryAsync({
              quality: 0.4,
              base64: true,
              allowsEditing: false,
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
            });
      if (r.canceled) return;
      const asset = r.assets?.[0];
      if (!asset?.base64) {
        setErrorMsg("Rasmni yuklab bo'lmadi. Qaytadan urinib ko'ring.");
        setErrorDetected(null);
        setErrorStatus(null);
        animateStep("error", source);
        return;
      }
      const rawMime = asset.mimeType ?? (asset.uri?.endsWith(".png") ? "image/png" : "image/jpeg");
      const mime: ImageMime =
        rawMime === "image/png"
          ? "image/png"
          : rawMime === "image/webp"
            ? "image/webp"
            : "image/jpeg";
      const persistedUri = asset.uri ? await persistFoodImage(asset.uri, mime) : undefined;
      await recognizeImage(source, asset.base64, mime, persistedUri);
    } catch {
      setErrorMsg("Rasm yuklashda xatolik yuz berdi.");
      setErrorDetected(null);
      setErrorStatus(null);
      animateStep("error", source);
    }
  };

  const handleStartCamera = () => {
    void pickAndAnalyze("camera");
  };

  const handleStartGallery = () => {
    void pickAndAnalyze("gallery");
  };

  const handleSubmitText = async () => {
    if (!textInput.trim()) return;
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    setLoading("text");
    try {
      const res = await aiAnalyzeText({ text: textInput.trim(), userContext: buildCtx() });
      showAnalysisResult(res, "text");
    } catch {
      setErrorMsg("Internet bilan bog'lanishda xatolik. Qaytadan urinib ko'ring.");
      setErrorDetected(null);
      setErrorStatus(null);
      animateStep("error", "text");
    } finally {
      setLoading(null);
    }
  };

  /** `totals` is the main dish only (portion + extras); included sides become their own entries. */
  const handleConfirmAiFinal = (totals: ConfirmTotals) => {
    if (!aiResult) return;
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    const displayName = totals.extrasSummary
      ? `${aiResult.name} (+${totals.extrasSummary})`
      : aiResult.name;
    const main: AddedFood = {
      name: displayName,
      cal: Math.max(0, Math.round(totals.cal)),
      protein: Math.max(0, Math.round(totals.protein)),
      carbs: Math.max(0, Math.round(totals.carbs)),
      fat: Math.max(0, Math.round(totals.fat)),
      portion: totals.portionLabel || aiResult.portion,
      emoji: aiResult.emoji,
      source: aiResult.source,
      imageUri: aiResult.imageUri,
    };
    const sides: AddedFood[] = (aiResult.sides ?? [])
      .filter((s) => s.included)
      .map((s) => ({
        name: s.name,
        cal: s.calories,
        protein: s.protein,
        carbs: s.carbs,
        fat: s.fat,
        portion: s.portion,
        emoji: s.emoji,
        source: aiResult.source,
      }));
    onAdd([main, ...sides]);
    setAiResult(null);
    setTextInput("");
    onClose();
  };

  const handleRejectAi = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    const src = aiResult?.source ?? activeSource ?? "camera";
    setAiResult(null);
    animateStep("instructions", src === "catalog" ? "camera" : src);
  };

  const handleUpdateAiFood = (patch: Partial<AiResult>) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    setAiResult((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      // Recompute caloriesPer100 if cal/portionGrams changed
      if (next.portionGrams && next.portionGrams > 0 && next.cal > 0) {
        next.caloriesPer100 = Math.round((next.cal / next.portionGrams) * 100);
      }
      return next;
    });
  };

  const handleToggleSide = (idx: number) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    setAiResult((prev) =>
      prev?.sides
        ? {
            ...prev,
            sides: prev.sides.map((s, i) => (i === idx ? { ...s, included: !s.included } : s)),
          }
        : prev,
    );
  };

  const handleSelectVariant = (idx: number) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    setAiResult((prev) => {
      const v = prev?.variants?.[idx];
      if (!prev || !v || prev.selectedVariant === idx) return prev;
      const next: AiResult = {
        ...prev,
        selectedVariant: idx,
        name: variantName(prev.baseName ?? prev.name, v),
        cal: v.calories,
        protein: v.protein,
        carbs: v.carbs,
        fat: v.fat,
        // The AI's advice text and recommended* numbers were written for its
        // own pick; for any other variant fall back to the locally computed
        // advice so the text never quotes the wrong calories.
        ...(idx === prev.defaultVariant
          ? prev.aiAdviceSnapshot
          : {
              coachAdvice: undefined,
              recommendedCal: undefined,
              recommendedProtein: undefined,
              recommendedCarbs: undefined,
              recommendedFat: undefined,
            }),
      };
      if (next.portionGrams && next.portionGrams > 0) {
        next.caloriesPer100 = Math.round((next.cal / next.portionGrams) * 100);
      }
      return next;
    });
  };

  const handleAddIngredient = async (note: string) => {
    if (!aiResult) return;
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(aiResult.source === "text" ? "text" : "camera");
    try {
      // Faqat qo'shimchaning o'zini AI ga yubor — asosiy taom o'zgarmaydi
      const prompt =
        `Faqat shu QO'SHIMCHA mahsulot(lar)ning kaloriya va makrolarini hisobla: "${note}". ` +
        `Asosiy taom (palov, manti va h.k.) HAQIDA o'ylash kerak emas — faqat shu qo'shimchaning ` +
        `o'zining qiymatlarini qaytar. Masalan: "30g sariyog'" → ~220 kkal, oqsil 0g, uglevod 0g, yog' 24g.`;
      const res = await aiAnalyzeText({ text: prompt, userContext: buildCtx() });
      // "30g sariyog' va smetana" may come back split into a main item plus
      // sides — the extra is all of it together.
      const withSides = sumSides(res.sides?.map((s) => ({ ...s, included: true })));
      const newExtra: ExtraItem =
        res.status === "ok"
          ? {
              note,
              cal: Math.max(0, Math.round((res.calories ?? 0) + withSides.cal)),
              protein: Math.max(0, Math.round((res.protein ?? 0) + withSides.protein)),
              carbs: Math.max(0, Math.round((res.carbs ?? 0) + withSides.carbs)),
              fat: Math.max(0, Math.round((res.fat ?? 0) + withSides.fat)),
            }
          : { note, cal: 0, protein: 0, carbs: 0, fat: 0 };
      setAiResult((prev) =>
        prev ? { ...prev, extras: [...(prev.extras ?? []), newExtra] } : prev,
      );
    } catch {
      // Tarmoq xatolik — qo'shimchani 0 kkal bilan saqla, foydalanuvchi tahrirlaydi
      setAiResult((prev) =>
        prev
          ? {
              ...prev,
              extras: [
                ...(prev.extras ?? []),
                { note, cal: 0, protein: 0, carbs: 0, fat: 0 },
              ],
            }
          : prev,
      );
    } finally {
      setLoading(null);
    }
  };

  const handleRemoveIngredient = (index: number) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    setAiResult((prev) => {
      if (!prev || !prev.extras) return prev;
      const next = prev.extras.filter((_, i) => i !== index);
      return { ...prev, extras: next.length ? next : undefined };
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={() => {
        if (step === "instructions") {
          handleBack();
        } else {
          onClose();
        }
      }}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior="padding"
        keyboardVerticalOffset={0}
        style={styles.flex1}
      >
        <Animated.View
          style={[
            styles.backdrop,
            step === "ai-confirm" && styles.backdropFull,
            { opacity: fade },
          ]}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={step === "ai-confirm" ? undefined : onClose}
          />
          {/* ── AI Loading Overlay — ekran markazida ── */}
          {loading !== null && step !== "ai-confirm" && (
            <AiLoadingOverlay />
          )}
          <Animated.View
            style={[
              step === "ai-confirm" ? styles.sheetFull : styles.sheet,
              {
                backgroundColor: step === "ai-confirm" ? colors.background : colors.card,
                transform: [{ translateY: sheetY }],
                paddingBottom: step === "ai-confirm" ? 0 : Math.max(insets.bottom + 16, 32),
              },
            ]}
          >
            {step !== "ai-confirm" && (
              <View style={[styles.handle, { backgroundColor: colors.border }]} />
            )}
          <Animated.View style={[{ opacity: stepFade }, step === "ai-confirm" && { flex: 1 }]}>
              {step === "choose" ? (
                <ChooseStep
                  colors={colors}
                  onPick={handlePickVariant}
                  onClose={onClose}
                  meal={meal}
                  onMealChange={setMeal}
                  quickAdd={
                    <QuickAddStrip
                      recent={recentFoods}
                      favorites={favorites}
                      mine={customFoods}
                      isFavorite={isFavorite}
                      onToggleFavorite={(f) => toggleFavorite(savedFoodFields(f))}
                      onAdd={handleQuickAdd}
                      onCreateMine={() => setCreatingFood(true)}
                    />
                  }
                  scanNote={
                    subscription.status === "trial"
                      ? `Sinov: bugun ${canScan().remaining} / ${TRIAL_DAILY_SCAN_LIMIT} ta rasm tahlili qoldi`
                      : undefined
                  }
                />
              ) : step === "catalog" ? (
                <CatalogStep
                  colors={colors}
                  tab={catalogTab}
                  setTab={setCatalogTab}
                  query={catalogQuery}
                  setQuery={setCatalogQuery}
                  onBack={handleBack}
                  onPick={handlePickFromCatalog}
                />
              ) : step === "confirm" && pickedFood ? (
                <ConfirmStep
                  colors={colors}
                  food={pickedFood}
                  onBack={handleBack}
                  onConfirm={handleConfirmCatalog}
                />
              ) : step === "ai-confirm" && aiResult ? (
                <AiConfirmStep
                  colors={colors}
                  food={aiResult}
                  onBack={handleBack}
                  onConfirmFinal={handleConfirmAiFinal}
                  onReject={handleRejectAi}
                  onUpdateFood={handleUpdateAiFood}
                  onSelectVariant={handleSelectVariant}
                  onToggleSide={handleToggleSide}
                  onAddIngredient={handleAddIngredient}
                  onRemoveIngredient={handleRemoveIngredient}
                  recomputing={loading === "text" || loading === "camera"}
                  remainingCal={remainingCal}
                  dailyCalories={dailyCalories}
                  mealsPerDay={userContext?.mealsPerDay}
                  bottomInset={Math.max(insets.bottom, 16)}
                />
              ) : step === "text-confirm" && aiResult ? (
                <TextConfirmStep
                  colors={colors}
                  food={aiResult}
                  onBack={handleBack}
                  onConfirm={handleConfirmAiFinal}
                  onReject={handleRejectAi}
                  onSelectVariant={handleSelectVariant}
                  onToggleSide={handleToggleSide}
                />
              ) : step === "error" ? (
                <ErrorStep
                  colors={colors}
                  message={errorMsg ?? "Xatolik yuz berdi."}
                  detected={errorDetected}
                  status={errorStatus}
                  source={activeSource}
                  onBack={handleBack}
                  onRetakeCamera={handleStartCamera}
                  onRetakeGallery={handleStartGallery}
                  onGetPremium={() => {
                    onClose();
                    router.push("/onboarding/premium");
                  }}
                />
              ) : (
                <InstructionsStep
                  colors={colors}
                  source={(activeSource === "catalog" ? "camera" : activeSource) ?? "camera"}
                  textInput={textInput}
                  setTextInput={setTextInput}
                  loading={loading}
                  onBack={handleBack}
                  onStartCamera={handleStartCamera}
                  onStartGallery={handleStartGallery}
                  onSubmitText={handleSubmitText}
                />
              )}
            </Animated.View>
          </Animated.View>
        </Animated.View>
      </KeyboardAvoidingView>
      <CustomFoodEditor visible={creatingFood} onClose={() => setCreatingFood(false)} />
    </Modal>
  );
}

/**
 * "Somsa ichida nima bor?" — the photo can't show a filling or how something
 * was cooked, so let the user pick; each chip shows what it does to calories.
 */
function VariantPicker({
  food,
  multiplier,
  accent,
  onSelect,
  style,
}: {
  food: AiResult;
  multiplier: number;
  accent: string;
  onSelect: (idx: number) => void;
  style?: object;
}) {
  if (!food.variants || food.variants.length < 2) return null;
  const aiPick = food.variants[food.defaultVariant ?? 0];
  return (
    <View style={[vp.card, style]}>
      <View style={vp.head}>
        <View style={[vp.icon, { backgroundColor: accent + "1A" }]}>
          <Feather name="help-circle" size={16} color={accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={vp.question}>{food.variantQuestion ?? "Qaysi turi?"}</Text>
          <Text style={vp.hint}>
            {food.source === "text" ? "Matndan" : "Rasmdan"} aniq bilib bo'lmaydi. AI taxmini:{" "}
            {aiPick.label.toLowerCase()}. Boshqacha bo'lsa, tanlang — kaloriya o'zgaradi.
          </Text>
        </View>
      </View>
      <View style={vp.chips}>
        {food.variants.map((v, i) => {
          const active = i === food.selectedVariant;
          return (
            <Pressable
              key={v.label}
              onPress={() => onSelect(i)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              style={({ pressed }) => [
                vp.chip,
                active
                  ? { backgroundColor: accent, borderColor: accent }
                  : { backgroundColor: "#FFFFFF", borderColor: "#D5DDE6" },
                { opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Text style={[vp.chipLabel, { color: active ? "#FFFFFF" : "#1A202C" }]}>{v.label}</Text>
              <Text style={[vp.chipCal, { color: active ? "rgba(255,255,255,0.85)" : "#718096" }]}>
                {Math.round(v.calories * multiplier)} kkal
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Other dishes on the plate — each checked one is saved as its own diary entry. */
function SidesList({
  food,
  colors,
  onToggle,
  style,
}: {
  food: AiResult;
  colors: ColorPalette;
  onToggle: (idx: number) => void;
  style?: object;
}) {
  if (!food.sides || food.sides.length === 0) return null;
  return (
    <View style={[sl.card, { backgroundColor: colors.card, borderColor: colors.border }, style]}>
      <Text style={[sl.title, { color: colors.text }]}>
        {food.source === "text" ? "Yana yozganingiz" : "Rasmda yana topildi"}
      </Text>
      <Text style={[sl.hint, { color: colors.mutedForeground }]}>
        Har biri kundalikka alohida yoziladi. Yemaganingizni belgidan chiqaring.
      </Text>
      {food.sides.map((s, i) => (
        <Pressable
          key={`${s.name}-${i}`}
          onPress={() => onToggle(i)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: s.included }}
          accessibilityLabel={`${s.name}, ${s.calories} kaloriya`}
          style={({ pressed }) => [sl.row, { borderTopColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
        >
          <View
            style={[
              sl.box,
              s.included
                ? { backgroundColor: colors.primary, borderColor: colors.primary }
                : { backgroundColor: colors.card, borderColor: colors.mutedForeground },
            ]}
          >
            {s.included ? <Feather name="check" size={14} color="#FFFFFF" /> : null}
          </View>
          <Text style={sl.emoji}>{s.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text
              style={[sl.name, { color: s.included ? colors.text : colors.mutedForeground }]}
              numberOfLines={1}
            >
              {s.name}
            </Text>
            <Text style={[sl.portion, { color: colors.mutedForeground }]} numberOfLines={1}>
              {s.portion}
            </Text>
          </View>
          <Text
            style={[
              sl.cal,
              { color: s.included ? colors.text : colors.mutedForeground },
              !s.included && sl.struck,
            ]}
          >
            {s.calories} kkal
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function scanBlockMessage(reason?: ScanBlockReason): string {
  switch (reason) {
    case "daily_limit":
      return `Sinov davrida kuniga ${TRIAL_DAILY_SCAN_LIMIT} ta rasm tahlil qilinadi — bugungisi tugadi. Ovqatni ro'yxatdan yoki matn bilan qo'shishingiz mumkin, yoki Premium bilan cheksiz foydalaning.`;
    case "premium_expired":
      return "Premium muddati tugagan. Rasm tahlilidan foydalanish uchun Premiumni yangilang.";
    case "trial_expired":
      return "Bepul sinov muddati tugadi. Rasm tahlilidan foydalanish uchun Premium oling.";
    default:
      return "Rasm tahlili Premium foydalanuvchilar uchun. Premium oling yoki bepul sinovni boshlang.";
  }
}

function ChooseStep({
  colors,
  onPick,
  onClose,
  scanNote,
  meal,
  onMealChange,
  quickAdd,
}: {
  colors: ColorPalette;
  onPick: (s: Source) => void;
  onClose: () => void;
  meal: MealType;
  onMealChange: (m: MealType) => void;
  quickAdd?: React.ReactNode;
  /** Trial allowance line shown under the photo options. */
  scanNote?: string;
}) {
  // Recent/favorite cards make this step taller than small phones — let it scroll.
  const { height } = useWindowDimensions();
  return (
    <ScrollView
      style={{ maxHeight: height * 0.86 }}
      contentContainerStyle={styles.stepWrap}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.title, { color: colors.text }]}>Ovqat qo'shish</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        Qaysi ovqatga va qaysi yo'l bilan qo'shasiz?
      </Text>

      <View style={styles.mealRow}>
        {MEAL_ORDER.map((m) => {
          const on = m === meal;
          return (
            <Pressable
              key={m}
              onPress={() => onMealChange(m)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={[
                styles.mealChip,
                {
                  backgroundColor: on ? colors.primary : colors.background,
                  borderColor: on ? colors.primary : colors.border,
                },
              ]}
            >
              <Text style={styles.mealChipEmoji}>{MEAL_INFO[m].emoji}</Text>
              <Text
                style={[styles.mealChipText, { color: on ? "#FFFFFF" : colors.text }]}
                numberOfLines={1}
              >
                {m === "kechki" ? "Kechki" : MEAL_INFO[m].label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {quickAdd}

      <View style={styles.tileList}>
        <Tile
          colors={colors}
          accent={ACCENT.catalog}
          icon="list"
          title="Ro'yxatdan tanlash"
          desc="Milliy taomlar va ichimliklar katalogi (kategoriyalar bo'yicha)"
          onPress={() => onPick("catalog")}
        />
        <Tile
          colors={colors}
          accent={ACCENT.camera}
          icon="camera"
          title="Kamera bilan skanlash"
          desc="Ovqatni rasmga oling — AI nomi va kaloriyasini aniqlaydi"
          onPress={() => onPick("camera")}
        />
        <Tile
          colors={colors}
          accent={ACCENT.gallery}
          icon="image"
          title="Galereyadan tanlash"
          desc="Telefon xotirasidagi tayyor rasmni yuklash"
          onPress={() => onPick("gallery")}
        />
        {scanNote ? (
          <View style={[styles.scanNote, { backgroundColor: "#FEF3C7" }]}>
            <Feather name="clock" size={13} color="#92400E" />
            <Text style={styles.scanNoteText}>{scanNote}</Text>
          </View>
        ) : null}
        <Tile
          colors={colors}
          accent={ACCENT.text}
          icon="edit-3"
          title="Qo'lda yozish"
          desc="Ovqat nomi va miqdorini matn bilan kiriting"
          onPress={() => onPick("text")}
        />
      </View>

      <TouchableOpacity onPress={onClose} style={styles.cancelBtn} accessibilityRole="button">
        <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>Bekor qilish</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Tile({
  colors,
  accent,
  icon,
  title,
  desc,
  onPress,
}: {
  colors: ColorPalette;
  accent: string;
  icon: keyof typeof Feather.glyphMap;
  title: string;
  desc: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        {
          backgroundColor: colors.background,
          borderColor: colors.border,
          opacity: pressed ? 0.7 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={[styles.tileIcon, { backgroundColor: accent }]}>
        <Feather name={icon} size={22} color="#FFFFFF" />
      </View>
      <View style={styles.tileText}>
        <Text style={[styles.tileTitle, { color: colors.text }]}>{title}</Text>
        <Text
          style={[styles.tileDesc, { color: colors.mutedForeground }]}
          numberOfLines={2}
        >
          {desc}
        </Text>
      </View>
      <Feather name="chevron-right" size={22} color={colors.mutedForeground} />
    </Pressable>
  );
}

interface Tip {
  emoji: string;
  title: string;
  desc: string;
  good?: boolean;
}

const CAMERA_TIPS: Tip[] = [
  { emoji: "💡", title: "Yaxshi yorug'lik", desc: "Tabiiy kunduzgi yorug'lik eng aniq natija beradi" },
  { emoji: "📐", title: "Yuqoridan oling", desc: "Kamerani likopchaga to'g'ri (90°) tushadigan qiling" },
  { emoji: "🍽️", title: "Bitta ovqat", desc: "Bir vaqtda bitta likopchani rasmga oling" },
  { emoji: "📏", title: "Yaqin keling", desc: "Ovqat kadrning kamida 70%ini egallasin" },
];

const GALLERY_TIPS: Tip[] = [
  { emoji: "✅", title: "Yangi rasm", desc: "Yaqinda olingan, yaxshi yoritilgan rasm", good: true },
  { emoji: "✅", title: "Aniq likopcha", desc: "Bitta ovqat, ranglari aniq ko'rinadi", good: true },
  { emoji: "❌", title: "Yaroqsiz", desc: "Qorong'i, blur, ekrandan olingan yoki ko'p ovqat", good: false },
];

const TEXT_TIPS: Tip[] = [
  { emoji: "✅", title: "1 likopcha osh", desc: "Porsiya bilan: likopcha, kosa, stakan", good: true },
  { emoji: "✅", title: "200g guruch", desc: "Aniq gramm yoki millilitr ko'rsating", good: true },
  { emoji: "❌", title: "ovqat / kechki", desc: "Juda noaniq — AI miqdorni bila olmaydi", good: false },
];

function InstructionsStep({
  colors,
  source,
  textInput,
  setTextInput,
  loading,
  onBack,
  onStartCamera,
  onStartGallery,
  onSubmitText,
}: {
  colors: ColorPalette;
  source: "camera" | "gallery" | "text";
  textInput: string;
  setTextInput: (v: string) => void;
  loading: Source | null;
  onBack: () => void;
  onStartCamera: () => void;
  onStartGallery: () => void;
  onSubmitText: () => void;
}) {
  const [showTips, setShowTips] = useState(false);
  const accent = ACCENT[source];
  const meta = {
    camera: {
      icon: "camera" as const,
      heading: "Kamera bilan skanlash",
      sub: "Aniq natija uchun quyidagilarga e'tibor bering",
      tips: CAMERA_TIPS,
      cta: "Kamerani ochish",
      onStart: onStartCamera,
    },
    gallery: {
      icon: "image" as const,
      heading: "Galereyadan tanlash",
      sub: "Qaysi rasmlar yaxshi natija beradi",
      tips: GALLERY_TIPS,
      cta: "Galereyani ochish",
      onStart: onStartGallery,
    },
    text: {
      icon: "edit-3" as const,
      heading: "Qo'lda yozish",
      sub: "Aniqlik uchun porsiya yoki gramm yozing",
      tips: TEXT_TIPS,
      cta: "Aniqlash",
      onStart: onSubmitText,
    },
  }[source];

  const isLoading = loading === source;
  const canSubmit = isLoading
    ? false
    : source === "text"
      ? textInput.trim().length > 0
      : true;

  return (
    <View style={styles.stepWrap}>
      <View style={styles.instrHeader}>
        <TouchableOpacity onPress={onBack} hitSlop={12} style={styles.backBtn}>
          <Feather name="chevron-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={[styles.headIcon, { backgroundColor: accent }]}>
          <Feather name={meta.icon} size={20} color="#FFFFFF" />
        </View>
        <View style={styles.headText}>
          <Text style={[styles.title, { color: colors.text }]}>{meta.heading}</Text>
          <TouchableOpacity
            onPress={() => setShowTips((v) => !v)}
            hitSlop={8}
            activeOpacity={0.7}
            style={styles.tipsToggleBtn}
          >
            <Text style={[styles.subtitle, { color: accent }]}>
              {meta.sub}
            </Text>
            <Feather
              name={showTips ? "chevron-up" : "chevron-down"}
              size={14}
              color={accent}
            />
          </TouchableOpacity>
        </View>
      </View>

      {showTips && (
        <KeyboardAwareScrollViewCompat
          style={styles.tipsScroll}
          contentContainerStyle={styles.tipsContent}
          showsVerticalScrollIndicator={false}
          bottomOffset={20}
        >
          {meta.tips.map((tip, i) => (
            <View
              key={i}
              style={[
                styles.tipRow,
                {
                  backgroundColor: colors.background,
                  borderColor:
                    tip.good === false
                      ? "#FCA5A5"
                      : tip.good === true
                        ? "#86EFAC"
                        : colors.border,
                },
              ]}
            >
              <Text style={styles.tipEmoji}>{tip.emoji}</Text>
              <View style={styles.tipText}>
                <Text style={[styles.tipTitle, { color: colors.text }]}>{tip.title}</Text>
                <Text style={[styles.tipDesc, { color: colors.mutedForeground }]}>
                  {tip.desc}
                </Text>
              </View>
            </View>
          ))}
        </KeyboardAwareScrollViewCompat>
      )}

      {source === "text" ? (
        <TextInput
          value={textInput}
          onChangeText={setTextInput}
          placeholder="Masalan: 1 likopcha osh"
          placeholderTextColor={colors.mutedForeground}
          style={[
            styles.textField,
            {
              backgroundColor: colors.input,
              color: colors.text,
              borderColor: colors.border,
            },
          ]}
          onSubmitEditing={onSubmitText}
          returnKeyType="done"
        />
      ) : null}

      <Pressable
        onPress={meta.onStart}
        disabled={!canSubmit}
        style={({ pressed }) => [
          styles.cta,
          {
            backgroundColor: canSubmit ? accent : colors.mutedForeground,
            opacity: pressed && canSubmit ? 0.85 : 1,
          },
        ]}
      >
        <Feather
          name={isLoading ? "loader" : meta.icon}
          size={18}
          color="#FFFFFF"
        />
        <Text style={styles.ctaText}>
          {isLoading ? "Aniqlanmoqda..." : meta.cta}
        </Text>
      </Pressable>
    </View>
  );
}

function CatalogStep({
  colors,
  tab,
  setTab,
  query,
  setQuery,
  onBack,
  onPick,
}: {
  colors: ColorPalette;
  tab: "all" | FoodCategory;
  setTab: (t: "all" | FoodCategory) => void;
  query: string;
  setQuery: (q: string) => void;
  onBack: () => void;
  onPick: (f: FoodItem) => void;
}) {
  const q = query.trim().toLowerCase();
  const filtered = FOOD_DB.filter((f) => {
    if (tab !== "all" && f.category !== tab) return false;
    if (!q) return true;
    return f.name.toLowerCase().includes(q);
  });

  return (
    <View style={styles.stepWrap}>
      <View style={styles.instrHeader}>
        <TouchableOpacity onPress={onBack} hitSlop={12} style={styles.backBtn}>
          <Feather name="chevron-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={[styles.headIcon, { backgroundColor: ACCENT.catalog }]}>
          <Feather name="list" size={20} color="#FFFFFF" />
        </View>
        <View style={styles.headText}>
          <Text style={[styles.title, { color: colors.text }]}>Ro'yxatdan tanlash</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Kategoriyani tanlang yoki qidirib toping
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.searchBar,
          { backgroundColor: colors.input, borderColor: colors.border },
        ]}
      >
        <Feather name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Taom yoki ichimlik..."
          placeholderTextColor={colors.mutedForeground}
          style={[styles.searchInput, { color: colors.text }]}
        />
        {query.length > 0 ? (
          <TouchableOpacity onPress={() => setQuery("")} hitSlop={6}>
            <Feather name="x" size={14} color={colors.mutedForeground} />
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
      >
        <CatalogChip
          label="Hammasi"
          emoji="🍽️"
          active={tab === "all"}
          onPress={() => setTab("all")}
          colors={colors}
        />
        {CATEGORIES.map((c) => (
          <CatalogChip
            key={c.id}
            label={c.label}
            emoji={c.emoji}
            active={tab === c.id}
            onPress={() => setTab(c.id)}
            colors={colors}
          />
        ))}
      </ScrollView>

      <ScrollView style={styles.catalogList} showsVerticalScrollIndicator={false}>
        {filtered.length === 0 ? (
          <View style={styles.catalogEmpty}>
            <Feather name="search" size={32} color={colors.mutedForeground} />
            <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium" }}>
              Hech narsa topilmadi
            </Text>
          </View>
        ) : (
          filtered.map((f) => (
            <Pressable
              key={f.id}
              onPress={() => onPick(f)}
              style={({ pressed }) => [
                styles.catalogRow,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <View style={[styles.catalogEmojiWrap, { backgroundColor: colors.secondary }]}>
                <Text style={styles.catalogEmoji}>{f.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.catalogName, { color: colors.text }]} numberOfLines={1}>
                  {f.name}
                </Text>
                <Text
                  style={[styles.catalogMeta, { color: colors.mutedForeground }]}
                  numberOfLines={1}
                >
                  {f.portion} · {f.cal} kal
                </Text>
              </View>
              <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function CatalogChip({
  label,
  emoji,
  active,
  onPress,
  colors,
}: {
  label: string;
  emoji: string;
  active: boolean;
  onPress: () => void;
  colors: ColorPalette;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.catChip,
        {
          backgroundColor: active ? ACCENT.catalog : colors.secondary,
          borderColor: active ? ACCENT.catalog : colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Text style={styles.catChipEmoji}>{emoji}</Text>
      <Text
        style={[
          styles.catChipLabel,
          {
            color: active ? "#FFFFFF" : colors.text,
            fontFamily: active ? "Inter_600SemiBold" : "Inter_500Medium",
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ConfirmStep({
  colors,
  food,
  onBack,
  onConfirm,
}: {
  colors: ColorPalette;
  food: FoodItem;
  onBack: () => void;
  onConfirm: () => void;
}) {
  return (
    <View style={styles.stepWrap}>
      <View style={styles.instrHeader}>
        <TouchableOpacity onPress={onBack} hitSlop={12} style={styles.backBtn}>
          <Feather name="chevron-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={[styles.headIcon, { backgroundColor: ACCENT.catalog }]}>
          <Feather name="check-circle" size={20} color="#FFFFFF" />
        </View>
        <View style={styles.headText}>
          <Text style={[styles.title, { color: colors.text }]}>Tasdiqlash</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Tanlangan taom ma'lumotlari
          </Text>
        </View>
      </View>

      <View style={[styles.confirmCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <View style={styles.confirmHead}>
          <View style={[styles.confirmEmojiWrap, { backgroundColor: colors.secondary }]}>
            <Text style={styles.confirmEmoji}>{food.emoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.confirmName, { color: colors.text }]}>{food.name}</Text>
            <Text style={[styles.confirmPortion, { color: colors.mutedForeground }]}>
              {food.portion}
            </Text>
          </View>
        </View>

        <View style={[styles.confirmCal, { backgroundColor: colors.secondary }]}>
          <Text style={[styles.confirmCalValue, { color: colors.primary }]}>{food.cal}</Text>
          <Text style={[styles.confirmCalLabel, { color: colors.mutedForeground }]}>kkal</Text>
        </View>

        <View style={styles.confirmMacros}>
          <ConfirmMacro label="Oqsil" value={food.protein} color={colors.chartRed} />
          <ConfirmMacro label="Uglevod" value={food.carbs} color={colors.accent} />
          <ConfirmMacro label="Yog'" value={food.fat} color="#3B82F6" />
        </View>
      </View>

      <Pressable
        onPress={onConfirm}
        style={({ pressed }) => [
          styles.cta,
          {
            backgroundColor: ACCENT.catalog,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <Feather name="check" size={20} color="#FFFFFF" />
        <Text style={styles.ctaText}>Tasdiqlash va qo'shish</Text>
      </Pressable>
    </View>
  );
}

function TextConfirmStep({
  colors,
  food,
  onBack,
  onConfirm,
  onReject,
  onSelectVariant,
  onToggleSide,
}: {
  colors: ColorPalette;
  food: AiResult;
  onBack: () => void;
  onConfirm: (totals: ConfirmTotals) => void;
  onReject: () => void;
  onSelectVariant: (idx: number) => void;
  onToggleSide: (idx: number) => void;
}) {
  const baseCal = Math.max(0, Math.round(food.cal));
  const baseProtein = Math.max(0, Math.round(food.protein));
  const baseCarbs = Math.max(0, Math.round(food.carbs));
  const baseFat = Math.max(0, Math.round(food.fat));

  const [portion, setPortion] = useState(1.0);
  const [editMode, setEditMode] = useState(false);
  const [editCal, setEditCal] = useState(String(baseCal));
  const [editProtein, setEditProtein] = useState(String(baseProtein));
  const [editCarbs, setEditCarbs] = useState(String(baseCarbs));
  const [editFat, setEditFat] = useState(String(baseFat));

  // A new analysis resets the portion; switching variant (same dish) keeps it.
  const dishKey = food.baseName ?? food.name;
  useEffect(() => {
    setPortion(1.0);
  }, [dishKey]);

  useEffect(() => {
    setEditMode(false);
    setEditCal(String(Math.max(0, Math.round(food.cal))));
    setEditProtein(String(Math.max(0, Math.round(food.protein))));
    setEditCarbs(String(Math.max(0, Math.round(food.carbs))));
    setEditFat(String(Math.max(0, Math.round(food.fat))));
  }, [food]);

  const parseNum = (s: string, fallback: number) => {
    const n = Number.parseInt(s, 10);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };

  const editedCal = parseNum(editCal, baseCal);
  const editedProtein = parseNum(editProtein, baseProtein);
  const editedCarbs = parseNum(editCarbs, baseCarbs);
  const editedFat = parseNum(editFat, baseFat);

  const cal = Math.round(editedCal * portion);
  const sides = sumSides(food.sides);
  const protein = Math.round(editedProtein * portion);
  const carbs = Math.round(editedCarbs * portion);
  const fat = Math.round(editedFat * portion);

  const fmtPortion = (n: number): string => {
    if (Number.isInteger(n)) return String(n);
    return (Math.round(n * 100) / 100).toString();
  };

  const portionLabel =
    Math.abs(portion - 1) < 0.01
      ? food.portion
      : `${fmtPortion(portion)}× ${food.portion}`;

  const decPortion = () => setPortion((p) => Math.max(0.25, Math.round((p - 0.25) * 100) / 100));
  const incPortion = () => setPortion((p) => Math.min(10, Math.round((p + 0.25) * 100) / 100));

  return (
    <View style={styles.stepWrap}>
      <View style={styles.instrHeader}>
        <TouchableOpacity onPress={onBack} hitSlop={12} style={styles.backBtn}>
          <Feather name="chevron-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={[styles.headIcon, { backgroundColor: ACCENT.text }]}>
          <Feather name="edit-3" size={20} color="#FFFFFF" />
        </View>
        <View style={styles.headText}>
          <Text style={[styles.title, { color: colors.text }]}>AI hisobi</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Yozgan ovqatingiz uchun
          </Text>
        </View>
      </View>

      <View style={[styles.confirmCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <View style={styles.confirmHead}>
          <View style={[styles.confirmEmojiWrap, { backgroundColor: colors.secondary }]}>
            <Text style={styles.confirmEmoji}>{food.emoji || "🍽️"}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.confirmName, { color: colors.text }]}>{food.name}</Text>
            <Text style={[styles.confirmPortion, { color: colors.mutedForeground }]}>
              {portionLabel}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setEditMode((v) => !v)}
            hitSlop={10}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 8,
              backgroundColor: editMode ? ACCENT.text : colors.secondary,
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
            }}
          >
            <Feather name={editMode ? "check" : "edit-2"} size={14} color={editMode ? "#FFFFFF" : colors.text} />
            <Text style={{ fontSize: 12, fontWeight: "600", color: editMode ? "#FFFFFF" : colors.text }}>
              {editMode ? "Tayyor" : "Tahrirlash"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.confirmCal, { backgroundColor: colors.secondary }]}>
          <Text style={[styles.confirmCalValue, { color: colors.primary }]}>{cal}</Text>
          <Text style={[styles.confirmCalLabel, { color: colors.mutedForeground }]}>kkal</Text>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 14, marginTop: 12 }}>
          <TouchableOpacity
            onPress={decPortion}
            disabled={portion <= 0.25}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: colors.secondary,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: "center",
              justifyContent: "center",
              opacity: portion <= 0.25 ? 0.4 : 1,
            }}
          >
            <Feather name="minus" size={18} color={colors.text} />
          </TouchableOpacity>
          <View style={{ alignItems: "center", minWidth: 80 }}>
            <Text style={{ fontSize: 11, color: colors.mutedForeground }}>Porsiya</Text>
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
              {fmtPortion(portion)}×
            </Text>
          </View>
          <TouchableOpacity
            onPress={incPortion}
            disabled={portion >= 10}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: colors.secondary,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: "center",
              justifyContent: "center",
              opacity: portion >= 10 ? 0.4 : 1,
            }}
          >
            <Feather name="plus" size={18} color={colors.text} />
          </TouchableOpacity>
        </View>

        {editMode ? (
          <View style={{ marginTop: 14, gap: 8 }}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.confirmMacroLabel, { color: colors.mutedForeground }]}>Kaloriya</Text>
                <TextInput
                  value={editCal}
                  onChangeText={setEditCal}
                  keyboardType="number-pad"
                  style={{
                    height: 40,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.secondary,
                    paddingHorizontal: 10,
                    fontSize: 14,
                    color: colors.text,
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.confirmMacroLabel, { color: colors.mutedForeground }]}>Oqsil (g)</Text>
                <TextInput
                  value={editProtein}
                  onChangeText={setEditProtein}
                  keyboardType="number-pad"
                  style={{
                    height: 40,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.secondary,
                    paddingHorizontal: 10,
                    fontSize: 14,
                    color: colors.text,
                  }}
                />
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.confirmMacroLabel, { color: colors.mutedForeground }]}>Uglevod (g)</Text>
                <TextInput
                  value={editCarbs}
                  onChangeText={setEditCarbs}
                  keyboardType="number-pad"
                  style={{
                    height: 40,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.secondary,
                    paddingHorizontal: 10,
                    fontSize: 14,
                    color: colors.text,
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.confirmMacroLabel, { color: colors.mutedForeground }]}>Yog' (g)</Text>
                <TextInput
                  value={editFat}
                  onChangeText={setEditFat}
                  keyboardType="number-pad"
                  style={{
                    height: 40,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.secondary,
                    paddingHorizontal: 10,
                    fontSize: 14,
                    color: colors.text,
                  }}
                />
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.confirmMacros}>
            <ConfirmMacro label="Oqsil" value={protein} color={colors.chartRed} />
            <ConfirmMacro label="Uglevod" value={carbs} color={colors.accent} />
            <ConfirmMacro label="Yog'" value={fat} color="#3B82F6" />
          </View>
        )}
      </View>

      <VariantPicker
        food={food}
        multiplier={portion}
        accent={ACCENT.text}
        onSelect={onSelectVariant}
        style={{ marginTop: 12, borderWidth: 1, borderColor: colors.border }}
      />

      <SidesList food={food} colors={colors} onToggle={onToggleSide} style={{ marginTop: 12 }} />
      {sides.count > 0 ? (
        <Text style={[styles.plateTotal, { color: colors.text }]}>
          Jami {sides.count + 1} ta taom: {cal + sides.cal} kkal
        </Text>
      ) : null}

      <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
        <Pressable
          onPress={onReject}
          style={({ pressed }) => [
            styles.cta,
            {
              flex: 1,
              backgroundColor: colors.secondary,
              borderWidth: 1,
              borderColor: colors.border,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Feather name="x" size={18} color={colors.destructive} />
          <Text style={[styles.ctaText, { color: colors.destructive }]}>Rad etish</Text>
        </Pressable>
        <Pressable
          onPress={() =>
            onConfirm({
              cal,
              protein,
              carbs,
              fat,
              portionLabel,
            })
          }
          style={({ pressed }) => [
            styles.cta,
            {
              flex: 1,
              backgroundColor: ACCENT.text,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Feather name="check" size={18} color="#FFFFFF" />
          <Text style={styles.ctaText}>Tasdiqlash</Text>
        </Pressable>
      </View>
    </View>
  );
}

function AiConfirmStep({
  colors,
  food,
  onBack,
  onConfirmFinal,
  onReject,
  onUpdateFood,
  onSelectVariant,
  onToggleSide,
  onAddIngredient,
  onRemoveIngredient,
  recomputing,
  remainingCal,
  dailyCalories,
  mealsPerDay,
  bottomInset,
}: {
  colors: ColorPalette;
  food: AiResult;
  onBack: () => void;
  onConfirmFinal: (totals: ConfirmTotals) => void;
  onReject: () => void;
  onUpdateFood: (patch: Partial<AiResult>) => void;
  onSelectVariant: (idx: number) => void;
  onToggleSide: (idx: number) => void;
  onAddIngredient: (note: string) => void;
  onRemoveIngredient: (index: number) => void;
  recomputing: boolean;
  remainingCal?: number;
  dailyCalories?: number;
  mealsPerDay?: number;
  bottomInset: number;
}) {
  const [portion, setPortion] = useState(1.0);
  const { width: winW } = useWindowDimensions();
  const topInset = useSafeAreaInsets().top;
  const photoHeight = Math.round(Math.min(winW * 0.85, 380));
  const [showEdit, setShowEdit] = useState(false);
  const [showIngredient, setShowIngredient] = useState(false);
  const [editName, setEditName] = useState(food.name);
  const [editPortionText, setEditPortionText] = useState(food.portion);
  const [editCal, setEditCal] = useState(String(food.cal));
  const [editProtein, setEditProtein] = useState(String(food.protein));
  const [editCarbs, setEditCarbs] = useState(String(food.carbs));
  const [editFat, setEditFat] = useState(String(food.fat));
  const [ingredientNote, setIngredientNote] = useState("");
  const [customPortionText, setCustomPortionText] = useState("");

  useEffect(() => {
    setEditName(food.name);
    setEditPortionText(food.portion);
    setEditCal(String(food.cal));
    setEditProtein(String(food.protein));
    setEditCarbs(String(food.carbs));
    setEditFat(String(food.fat));
  }, [food]);

  // Qo'shimchalar yig'indisi (asosiy taom o'zgarmaydi)
  const extras = food.extras ?? [];
  const extrasCalSum = extras.reduce((s, x) => s + (x.cal || 0), 0);
  const extrasProteinSum = extras.reduce((s, x) => s + (x.protein || 0), 0);
  const extrasCarbsSum = extras.reduce((s, x) => s + (x.carbs || 0), 0);
  const extrasFatSum = extras.reduce((s, x) => s + (x.fat || 0), 0);

  // Asosiy porsiya (portion mult bilan)
  const baseCal = Math.round(food.cal * portion);
  const baseProtein = Math.round(food.protein * portion);
  const baseCarbs = Math.round(food.carbs * portion);
  const baseFat = Math.round(food.fat * portion);

  // Jami (asosiy + qo'shimchalar) — bu nutriRow va "Ovqatni kiritish"da
  const displayCal = baseCal + extrasCalSum;
  const displayCarbs = baseCarbs + extrasCarbsSum;
  const displayProtein = baseProtein + extrasProteinSum;
  const displayFat = baseFat + extrasFatSum;

  const unit = food.unitPer100 === "ml" ? "ml" : "g";
  const per100Cal =
    food.caloriesPer100 ??
    (food.portionGrams && food.portionGrams > 0 && food.cal > 0
      ? Math.round((food.cal / food.portionGrams) * 100)
      : null);

  // Tabiiy birlik (dona/burda/likopcha/kosa/stakan/piyola/sixcha) yoki gramm/ml
  const COUNT_UNITS = new Set(["dona", "burda", "likopcha", "kosa", "stakan", "piyola", "sixcha"]);
  const isCountUnit = food.unitName != null && COUNT_UNITS.has(food.unitName);
  const baseUnits = food.units && food.units > 0 ? food.units : 1;
  const unitNamePlural = food.unitName ?? unit;

  // Bir birlik kaloriyasi (kalkulator)
  const calPerUnit = baseUnits > 0 ? food.cal / baseUnits : food.cal;

  // Tavsiya — kunlik norma / mahallar soni (35% emas)
  const mealsCount = mealsPerDay && mealsPerDay > 0 ? mealsPerDay : 3;
  let targetCal: number | null = null;
  if (remainingCal != null && remainingCal > 0) {
    targetCal = Math.min(
      remainingCal,
      dailyCalories ? Math.round(dailyCalories / mealsCount) : remainingCal,
    );
  } else if (dailyCalories) {
    targetCal = Math.round(dailyCalories / mealsCount);
  }

  // Cap kalorial bo'yicha — yog'li taom uchun kichik porsiya
  const capGrams = per100Cal
    ? per100Cal > 200
      ? 300
      : per100Cal > 100
        ? 400
        : 600
    : null;

  // Tavsiya etilgan birlik soni va gramm — AVVAL serverdan kelgan recommended* bo'lsa shuni ishlat
  let recommendedUnits: number | null =
    food.recommendedUnits != null && food.recommendedUnits > 0 ? food.recommendedUnits : null;
  let recommendedGrams: number | null = null;
  if (recommendedUnits != null && food.unitGrams && food.unitGrams > 0) {
    recommendedGrams = Math.round(recommendedUnits * food.unitGrams);
  }
  if (recommendedUnits == null && targetCal && targetCal > 0) {
    if (isCountUnit && calPerUnit > 0) {
      const exact = targetCal / calPerUnit;
      let r: number;
      if (exact < 0.875) {
        // Kasr birlik tavsiyasi (¼, ½, ¾)
        if (exact <= 0.375) r = 0.25;
        else if (exact <= 0.625) r = 0.5;
        else r = 0.75;
      } else {
        r = Math.max(1, Math.round(exact));
        if (capGrams != null && food.unitGrams && food.unitGrams > 0) {
          const maxByGrams = Math.max(1, Math.floor(capGrams / food.unitGrams));
          if (r > maxByGrams) r = maxByGrams;
        }
        if (r > 5) r = 5;
      }
      recommendedUnits = r;
      if (food.unitGrams && food.unitGrams > 0) {
        recommendedGrams = Math.round(r * food.unitGrams);
      }
    } else if (per100Cal && per100Cal > 0) {
      let g = Math.round(((targetCal / per100Cal) * 100) / 10) * 10;
      if (capGrams != null && g > capGrams) g = capGrams;
      if (g < 30) g = 30;
      recommendedGrams = g;
    }
  }

  const fmtUnits = (n: number): string => {
    if (Number.isInteger(n)) return String(n);
    // Doimo o'nli ko'rinish: 0.25, 0.5, 0.75, 1.5 — kasr belgilari (½/¼/¾) ishlatilmaydi
    return (Math.round(n * 100) / 100).toString();
  };

  // Server "coachAdvice" bo'lsa shuni ishlatamiz, aks holda local tavsiya quramiz
  const fallbackAdvice = (() => {
    if (recommendedUnits != null && recommendedUnits > 0) {
      const cal = Math.round(recommendedUnits * calPerUnit);
      const base =
        remainingCal != null && dailyCalories != null
          ? `Kunlik normangiz ${dailyCalories} kkal, qolgan ${remainingCal} kkal. `
          : "";
      return `${base}Sizga ~${fmtUnits(recommendedUnits)} ${unitNamePlural} (≈${cal} kkal) optimal.`;
    }
    if (recommendedGrams && per100Cal) {
      const cal = Math.round((recommendedGrams * per100Cal) / 100);
      const base =
        remainingCal != null && dailyCalories != null
          ? `Kunlik normangiz ${dailyCalories} kkal, qolgan ${remainingCal} kkal. `
          : "";
      return `${base}Sizga ~${recommendedGrams}${unit} (≈${cal} kkal) tavsiya etiladi.`;
    }
    if (remainingCal != null && dailyCalories != null) {
      return displayCal > remainingCal
        ? `Kunlik normangiz ${dailyCalories} kkal. Hozir ${remainingCal} kkal qolgan — bu porsiya normadan oshadi. Porsiyani kamaytirish tavsiya etiladi.`
        : `Kunlik normangiz ${dailyCalories} kkal. Bu porsiya (${displayCal} kkal) norma doirasida.`;
    }
    return "Bu porsiyani me'yorida iste'mol qilish tavsiya etiladi.";
  })();

  const aiAdvice = food.coachAdvice && food.coachAdvice.trim().length > 0
    ? food.coachAdvice
    : fallbackAdvice;

  // Porsiya tanlash variantlari — tabiiy birlikda yoki ko'paytmada
  type PortionOpt = { mult: number; label: string };
  const PORTION_OPTIONS: PortionOpt[] = isCountUnit
    ? (() => {
        const list = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 5];
        return list.map((u) => ({
          mult: u / baseUnits,
          label: `${fmtUnits(u)} ${unitNamePlural}`,
        }));
      })()
    : [0.25, 0.5, 0.75, 1.0, 1.5, 2.0, 3.0].map((m) => ({
        mult: m,
        label: `${fmtUnits(m)}x`,
      }));

  const applyCustomPortion = () => {
    const raw = customPortionText.trim().replace(",", ".");
    const num = Number.parseFloat(raw);
    if (!Number.isFinite(num) || num <= 0 || num > 20) return;
    const newMult = isCountUnit && baseUnits > 0 ? num / baseUnits : num;
    setPortion(newMult);
    setCustomPortionText("");
  };

  // Tavsiya tugmasi bosilganda qaysi ko'paytma qo'llaniladi
  const acceptMult = (() => {
    if (recommendedUnits != null && baseUnits > 0) {
      return recommendedUnits / baseUnits;
    }
    if (recommendedGrams && food.portionGrams && food.portionGrams > 0) {
      return recommendedGrams / food.portionGrams;
    }
    return portion;
  })();

  // Qo'shimchalarning qisqa nomini tuzish — saqlangan taom nomida ishlatish uchun
  const extrasSummary = (() => {
    if (extras.length === 0) return undefined;
    if (extras.length === 1) return extras[0].note.length > 30 ? `${extras[0].note.slice(0, 30)}…` : extras[0].note;
    return `${extras.length} qo'shimcha`;
  })();

  // Porsiya yorlig'i — saqlanganda ko'rinadi
  const manualPortionLabel = isCountUnit
    ? `${fmtUnits(portion * baseUnits)} ${unitNamePlural}`
    : Math.abs(portion - 1) < 0.01
      ? food.portion
      : `${fmtUnits(portion)}× ${food.portion}`;

  const toggleEdit = () => {
    if (!showEdit) {
      // Seed from the current portion (without extras) — otherwise a chosen
      // multiplier (e.g. 2x) is silently dropped when the edit is saved.
      setEditName(food.name);
      setEditPortionText(food.portion);
      setEditCal(String(baseCal));
      setEditProtein(String(baseProtein));
      setEditCarbs(String(baseCarbs));
      setEditFat(String(baseFat));
    }
    setShowEdit(!showEdit);
  };

  const applyEdit = () => {
    const cal = Number.parseInt(editCal, 10);
    const protein = Number.parseInt(editProtein, 10);
    const carbs = Number.parseInt(editCarbs, 10);
    const fat = Number.parseInt(editFat, 10);
    onUpdateFood({
      name: editName.trim() || food.name,
      portion: editPortionText.trim() || food.portion,
      cal: Number.isFinite(cal) && cal >= 0 ? cal : food.cal,
      protein: Number.isFinite(protein) && protein >= 0 ? protein : food.protein,
      carbs: Number.isFinite(carbs) && carbs >= 0 ? carbs : food.carbs,
      fat: Number.isFinite(fat) && fat >= 0 ? fat : food.fat,
    });
    setShowEdit(false);
    setPortion(1.0);
  };

  const applyIngredient = () => {
    const note = ingredientNote.trim();
    if (!note) return;
    onAddIngredient(note);
    setIngredientNote("");
    setShowIngredient(false);
  };

  // Whole plate = main dish (portion + extras) + the other dishes still checked.
  const sides = sumSides(food.sides);
  const plateCal = displayCal + sides.cal;
  const plateProtein = displayProtein + sides.protein;
  const plateCarbs = displayCarbs + sides.carbs;
  const plateFat = displayFat + sides.fat;
  const kcalLeftAfter = remainingCal != null ? remainingCal - plateCal : null;
  const lowConfidence = food.confidence != null && food.confidence < 0.6;
  const portionIsRecommended = Math.abs(acceptMult - portion) < 0.01;
  const recommendedLabel = isCountUnit
    ? `${fmtUnits(baseUnits * acceptMult)} ${unitNamePlural}`
    : recommendedGrams
      ? `${recommendedGrams}${unit}`
      : `${fmtUnits(acceptMult)}×`;
  const currentGrams =
    food.portionGrams && food.portionGrams > 0 ? Math.round(food.portionGrams * portion) : null;

  const stepPortion = (dir: 1 | -1) => {
    if (isCountUnit) {
      const u = portion * baseUnits;
      const next =
        dir > 0 ? (u < 1 ? u + 0.25 : u + 0.5) : u <= 1 ? Math.max(0.25, u - 0.25) : u - 0.5;
      setPortion(Math.min(20, next) / baseUnits);
    } else {
      setPortion((p) => Math.min(10, Math.max(0.25, Math.round((p + dir * 0.25) * 100) / 100)));
    }
  };
  const canStepDown = isCountUnit ? portion * baseUnits > 0.25 + 1e-6 : portion > 0.25 + 1e-6;

  const macro = (label: string, value: number, color: string) => (
    <View style={[ac.macroCell, { backgroundColor: colors.secondary }]}>
      <View style={[ac.macroDot, { backgroundColor: color }]} />
      <Text style={[ac.macroValue, { color: colors.text }]}>
        {value}
        <Text style={[ac.macroUnit, { color: colors.mutedForeground }]}> g</Text>
      </Text>
      <Text style={[ac.macroLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );

  return (
    <View style={[ac.root, { backgroundColor: colors.background }]}>
      <KeyboardAwareScrollViewCompat
        style={ac.flex1}
        contentContainerStyle={ac.scrollContent}
        showsVerticalScrollIndicator={false}
        bottomOffset={20}
      >
        {/* ── Photo ──
            Phone photos are portrait; show the whole photo ("contain") over a
            blurred, dimmed copy of itself so any aspect ratio fills the frame. */}
        <View style={[ac.photoFrame, { height: food.imageUri ? photoHeight : 170 }]}>
          {food.imageUri ? (
            <>
              <Image
                source={{ uri: food.imageUri }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                blurRadius={24}
              />
              <View style={[StyleSheet.absoluteFill, ac.photoDim]} />
              <Image
                source={{ uri: food.imageUri }}
                style={ac.photoMain}
                contentFit="contain"
                accessibilityLabel={`${food.name} rasmi`}
              />
            </>
          ) : (
            <View style={[StyleSheet.absoluteFill, ac.emojiBox, { backgroundColor: colors.secondary }]}>
              <Text style={ac.emojiBig}>{food.emoji}</Text>
            </View>
          )}
          <Pressable
            onPress={onBack}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Orqaga"
            style={({ pressed }) => [ac.backBtn, { top: topInset + 10, opacity: pressed ? 0.7 : 1 }]}
          >
            <Feather name="chevron-left" size={24} color="#FFFFFF" />
          </Pressable>
        </View>

        {/* ── Summary: what it is and what it costs ── */}
        <View style={[ac.summary, { backgroundColor: colors.card }]}>
          <View style={ac.titleRow}>
            <View style={{ flex: 1 }}>
              <Text style={[ac.foodName, { color: colors.text }]} numberOfLines={2}>
                {food.emoji} {food.name}
              </Text>
              <Text style={[ac.foodPortion, { color: colors.mutedForeground }]} numberOfLines={1}>
                {manualPortionLabel}
                {currentGrams && isCountUnit ? ` · ~${currentGrams}${unit}` : ""}
              </Text>
            </View>
            <Pressable
              onPress={toggleEdit}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Tahrirlash"
              style={({ pressed }) => [
                ac.iconBtn,
                {
                  backgroundColor: showEdit ? colors.primary : colors.secondary,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Feather name={showEdit ? "x" : "edit-2"} size={16} color={showEdit ? "#FFFFFF" : colors.primary} />
            </Pressable>
          </View>

          {lowConfidence ? (
            <View style={ac.warnBox}>
              <Feather name="alert-triangle" size={15} color="#B45309" />
              <Text style={ac.warnText}>
                AI ishonchi past — rasm xira yoki taom to'liq ko'rinmayapti. Nomi va porsiyasini
                tekshiring yoki qayta suratga oling.
              </Text>
            </View>
          ) : null}

          <View style={ac.kcalRow}>
            <Text style={[ac.kcalValue, { color: colors.text }]}>{plateCal}</Text>
            <Text style={[ac.kcalUnit, { color: colors.mutedForeground }]}>kkal</Text>
            <View style={{ flex: 1 }} />
            {kcalLeftAfter != null ? (
              <Text
                style={[
                  ac.leftText,
                  { color: kcalLeftAfter >= 0 ? colors.mutedForeground : colors.destructive },
                ]}
              >
                {kcalLeftAfter >= 0
                  ? `Keyin qoladi: ${kcalLeftAfter} kkal`
                  : `Normadan +${-kcalLeftAfter} kkal`}
              </Text>
            ) : null}
          </View>

          <View style={ac.macroRow}>
            {macro("Oqsil", plateProtein, colors.chartRed)}
            {macro("Uglevod", plateCarbs, colors.accent)}
            {macro("Yog'", plateFat, "#3B82F6")}
          </View>

          {sides.count > 0 ? (
            <Text style={[ac.per100, { color: colors.mutedForeground }]}>
              Jami {sides.count + 1} ta taom: {food.baseName ?? food.name} {displayCal} kkal + yana {sides.cal} kkal
            </Text>
          ) : null}

          {per100Cal != null && per100Cal > 0 ? (
            <Text style={[ac.per100, { color: colors.mutedForeground }]}>
              {isCountUnit && food.unitGrams
                ? `1 ${unitNamePlural} ≈ ${Math.round(food.unitGrams)}${unit} · `
                : ""}
              100{unit} = {per100Cal} kkal
            </Text>
          ) : null}
        </View>

        {/* ── Manual edit ── */}
        {showEdit ? (
          <View style={[ac.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[ac.cardTitle, { color: colors.text }]}>Qo'lda tahrirlash</Text>
            <Text style={[ac.fieldLabel, { color: colors.mutedForeground }]}>Nomi</Text>
            <TextInput
              value={editName}
              onChangeText={setEditName}
              style={[ac.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
              placeholder="Taom nomi"
              placeholderTextColor={colors.mutedForeground}
            />
            <Text style={[ac.fieldLabel, { color: colors.mutedForeground }]}>Porsiya tavsifi</Text>
            <TextInput
              value={editPortionText}
              onChangeText={setEditPortionText}
              style={[ac.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
              placeholder="masalan: 1 likopcha (350g)"
              placeholderTextColor={colors.mutedForeground}
            />
            <View style={ac.editGrid}>
              {(
                [
                  ["Kaloriya", editCal, setEditCal],
                  ["Oqsil (g)", editProtein, setEditProtein],
                  ["Uglevod (g)", editCarbs, setEditCarbs],
                  ["Yog' (g)", editFat, setEditFat],
                ] as const
              ).map(([label, value, setValue]) => (
                <View key={label} style={ac.editCell}>
                  <Text style={[ac.fieldLabel, { color: colors.mutedForeground }]}>{label}</Text>
                  <TextInput
                    value={value}
                    onChangeText={setValue}
                    keyboardType="number-pad"
                    selectTextOnFocus
                    style={[ac.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
                  />
                </View>
              ))}
            </View>
            <Pressable
              onPress={applyEdit}
              style={({ pressed }) => [ac.smallPrimary, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
            >
              <Feather name="check" size={16} color="#FFFFFF" />
              <Text style={ac.smallPrimaryText}>Saqlash</Text>
            </Pressable>
          </View>
        ) : null}

        {/* ── Portion ── */}
        <View style={[ac.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[ac.cardTitle, { color: colors.text }]} numberOfLines={1}>
            Porsiya{food.sides?.length ? ` — ${food.baseName ?? food.name}` : ""}
          </Text>
          <View style={ac.stepperRow}>
            <Pressable
              onPress={() => stepPortion(-1)}
              disabled={!canStepDown}
              accessibilityRole="button"
              accessibilityLabel="Kamaytirish"
              style={({ pressed }) => [
                ac.stepBtn,
                { backgroundColor: colors.secondary, opacity: !canStepDown ? 0.35 : pressed ? 0.7 : 1 },
              ]}
            >
              <Feather name="minus" size={20} color={colors.primary} />
            </Pressable>
            <View style={ac.stepCenter}>
              <Text style={[ac.stepValue, { color: colors.text }]}>
                {isCountUnit ? `${fmtUnits(portion * baseUnits)} ${unitNamePlural}` : `${fmtUnits(portion)}×`}
              </Text>
              {currentGrams ? (
                <Text style={[ac.stepSub, { color: colors.mutedForeground }]}>~{currentGrams}{unit}</Text>
              ) : null}
            </View>
            <Pressable
              onPress={() => stepPortion(1)}
              accessibilityRole="button"
              accessibilityLabel="Ko'paytirish"
              style={({ pressed }) => [ac.stepBtn, { backgroundColor: colors.secondary, opacity: pressed ? 0.7 : 1 }]}
            >
              <Feather name="plus" size={20} color={colors.primary} />
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={ac.chipsRow}
            keyboardShouldPersistTaps="handled"
          >
            {PORTION_OPTIONS.map((p) => {
              const active = Math.abs(portion - p.mult) < 0.01;
              return (
                <Pressable
                  key={p.label}
                  onPress={() => setPortion(p.mult)}
                  style={[
                    ac.chip,
                    active
                      ? { backgroundColor: colors.primary, borderColor: colors.primary }
                      : { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                >
                  <Text style={[ac.chipText, { color: active ? "#FFFFFF" : colors.text }]}>{p.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={ac.customRow}>
            <TextInput
              value={customPortionText}
              onChangeText={setCustomPortionText}
              placeholder={isCountUnit ? `Boshqa miqdor (${unitNamePlural}), masalan 1.5` : "Boshqa miqdor, masalan 1.5"}
              placeholderTextColor={colors.mutedForeground}
              keyboardType="decimal-pad"
              style={[ac.input, ac.flex1, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
              onSubmitEditing={applyCustomPortion}
              returnKeyType="done"
            />
            <Pressable
              onPress={applyCustomPortion}
              disabled={!customPortionText.trim()}
              accessibilityRole="button"
              accessibilityLabel="Miqdorni qo'llash"
              style={[ac.customBtn, { backgroundColor: colors.primary, opacity: customPortionText.trim() ? 1 : 0.4 }]}
            >
              <Feather name="check" size={18} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>

        <VariantPicker
          food={food}
          multiplier={portion}
          accent={colors.primary}
          onSelect={onSelectVariant}
          style={[ac.variantCard, { borderColor: colors.border }]}
        />

        <SidesList food={food} colors={colors} onToggle={onToggleSide} style={ac.sidesCard} />

        {/* ── AI advice: applies as a portion, never as a second "add" button ── */}
        <View style={[ac.card, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <View style={ac.adviceRow}>
            <View style={[ac.adviceIcon, { backgroundColor: colors.primary }]}>
              <Feather name="cpu" size={16} color="#FFFFFF" />
            </View>
            <Text style={[ac.adviceText, { color: colors.text }]}>{aiAdvice}</Text>
          </View>
          {portionIsRecommended ? (
            <View style={ac.adviceDone}>
              <Feather name="check-circle" size={15} color={colors.primary} />
              <Text style={[ac.adviceDoneText, { color: colors.primary }]}>Tavsiya etilgan porsiya tanlangan</Text>
            </View>
          ) : (
            <Pressable
              onPress={() => setPortion(acceptMult)}
              style={({ pressed }) => [
                ac.adviceBtn,
                { borderColor: colors.primary, backgroundColor: colors.card, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Text style={[ac.adviceBtnText, { color: colors.primary }]}>
                Tavsiyani qo'llash · {recommendedLabel}
              </Text>
            </Pressable>
          )}
        </View>

        {/* ── Extras (butter, sauce, bread...) ── */}
        <View style={[ac.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={ac.extrasHead}>
            <Text style={[ac.cardTitle, { color: colors.text, flex: 1 }]}>
              Qo'shimchalar{extras.length ? ` (${extras.length})` : ""}
            </Text>
            <Pressable
              onPress={() => setShowIngredient((v) => !v)}
              hitSlop={8}
              style={({ pressed }) => [ac.linkBtn, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Feather name={showIngredient ? "x" : "plus"} size={15} color={colors.primary} />
              <Text style={[ac.linkText, { color: colors.primary }]}>{showIngredient ? "Yopish" : "Qo'shish"}</Text>
            </Pressable>
          </View>
          {extras.length === 0 && !showIngredient ? (
            <Text style={[ac.hintText, { color: colors.mutedForeground }]}>
              Sariyog', sous, non yoki shakar qo'shdingizmi? Ularni ham hisoblaymiz.
            </Text>
          ) : null}
          {extras.map((it, idx) => (
            <View key={`${it.note}-${idx}`} style={[ac.extraRow, { borderTopColor: colors.border }]}>
              <Text style={[ac.extraName, { color: colors.text }]} numberOfLines={2}>+ {it.note}</Text>
              <Text style={[ac.extraCal, { color: colors.text }]}>{it.cal > 0 ? `${it.cal} kkal` : "?"}</Text>
              <Pressable
                onPress={() => onRemoveIngredient(idx)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Qo'shimchani olib tashlash"
              >
                <Feather name="x" size={16} color={colors.mutedForeground} />
              </Pressable>
            </View>
          ))}
          {showIngredient ? (
            <View style={{ gap: 8, marginTop: 6 }}>
              <TextInput
                value={ingredientNote}
                onChangeText={setIngredientNote}
                multiline
                editable={!recomputing}
                placeholder="masalan: 30g sariyog' va 1 osh qoshiq smetana"
                placeholderTextColor={colors.mutedForeground}
                style={[
                  ac.input,
                  ac.multiline,
                  { backgroundColor: colors.input, borderColor: colors.border, color: colors.text },
                ]}
              />
              <Pressable
                onPress={applyIngredient}
                disabled={!ingredientNote.trim() || recomputing}
                style={[
                  ac.smallPrimary,
                  { backgroundColor: colors.primary, opacity: !ingredientNote.trim() || recomputing ? 0.5 : 1 },
                ]}
              >
                {recomputing ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Feather name="plus" size={16} color="#FFFFFF" />}
                <Text style={ac.smallPrimaryText}>{recomputing ? "AI hisoblamoqda…" : "Qo'shimchani qo'shish"}</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        <Pressable onPress={onReject} style={({ pressed }) => [ac.retake, { opacity: pressed ? 0.6 : 1 }]}>
          <Feather name="camera" size={15} color={colors.mutedForeground} />
          <Text style={[ac.retakeText, { color: colors.mutedForeground }]}>Boshqa ovqat ekan — qayta suratga olish</Text>
        </Pressable>
      </KeyboardAwareScrollViewCompat>

      {/* ── One primary action ── */}
      <View style={[ac.footer, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: bottomInset }]}>
        <Pressable
          onPress={() =>
            onConfirmFinal({
              cal: displayCal,
              protein: displayProtein,
              carbs: displayCarbs,
              fat: displayFat,
              portionLabel: manualPortionLabel,
              extrasSummary,
            })
          }
          accessibilityRole="button"
          style={({ pressed }) => [ac.confirmBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.88 : 1 }]}
        >
          <Feather name="check" size={20} color="#FFFFFF" />
          <Text style={ac.confirmText} numberOfLines={1}>
            {sides.count > 0 ? `${sides.count + 1} ta taomni qo'shish` : "Kundalikka qo'shish"} · {plateCal} kkal
          </Text>
        </Pressable>
      </View>
    </View>
  );
}


function AiLoadingOverlay() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const makeDot = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: 350, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
          Animated.timing(anim, { toValue: 0, duration: 350, useNativeDriver: true, easing: Easing.in(Easing.ease) }),
          Animated.delay(700 - delay),
        ]),
      );
    const pulseAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.12, duration: 700, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ]),
    );
    const d1 = makeDot(dot1, 0);
    const d2 = makeDot(dot2, 233);
    const d3 = makeDot(dot3, 466);
    Animated.parallel([d1, d2, d3, pulseAnim]).start();
    return () => { d1.stop(); d2.stop(); d3.stop(); pulseAnim.stop(); };
  }, []);

  return (
    <View style={aiLoadStyles.overlay}>
      <View style={aiLoadStyles.card}>
        <Animated.View style={[aiLoadStyles.iconWrap, { transform: [{ scale: pulse }] }]}>
          <LinearGradient
            colors={["#1A4F8A", "#2471A3", "#3CB371"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={aiLoadStyles.iconGrad}
          >
            <Feather name="cpu" size={32} color="#FFFFFF" />
          </LinearGradient>
        </Animated.View>
        <Text style={aiLoadStyles.title}>AI hisoblamoqda…</Text>
        <Text style={aiLoadStyles.sub}>Ovqat tahlil qilinmoqda, biroz kuting</Text>
        <View style={aiLoadStyles.dotsRow}>
          {[dot1, dot2, dot3].map((d, i) => (
            <Animated.View
              key={i}
              style={[
                aiLoadStyles.dot,
                {
                  opacity: d.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }),
                  transform: [{ translateY: d.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }],
                },
              ]}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

const aiLoadStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
    borderRadius: 28,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    gap: 10,
    width: 240,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 16,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginBottom: 4,
    shadowColor: "#2471A3",
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  iconGrad: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#1A2B3C",
    textAlign: "center",
  },
  sub: {
    fontSize: 12.5,
    fontFamily: "Inter_400Regular",
    color: "#5D7A8A",
    textAlign: "center",
    lineHeight: 18,
  },
  dotsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#2471A3",
  },
});

function ErrorStep({
  colors,
  message,
  detected,
  status,
  source,
  onBack,
  onRetakeCamera,
  onRetakeGallery,
  onGetPremium,
}: {
  colors: ColorPalette;
  message: string;
  detected: string | null;
  status: string | null;
  source: Source | null;
  onBack: () => void;
  onRetakeCamera: () => void;
  onRetakeGallery: () => void;
  onGetPremium: () => void;
}) {
  const isNotFood = status === "not_food";
  const isUnclear = status === "unclear";
  const isBlocked = status === "scan_limit" || status === "scan_locked";
  const isImageSource = source === "camera" || source === "gallery";
  const headerTitle = isBlocked
    ? status === "scan_limit"
      ? "Bugungi limit tugadi"
      : "Premium kerak"
    : isNotFood
      ? "Bu ovqat emas"
      : isUnclear
        ? "Rasm noaniq"
        : "Aniqlanmadi";
  const headerSubtitle = isBlocked
    ? "Rasm tahlili cheklangan"
    : isNotFood
      ? "Faqat ovqat rasmini yuboring"
      : isUnclear
        ? "Yaxshi yorug'likda qaytadan oling"
        : "Iltimos, qaytadan urinib ko'ring";

  return (
    <View style={styles.stepWrap}>
      <View style={styles.instrHeader}>
        <TouchableOpacity onPress={onBack} hitSlop={12} style={styles.backBtn}>
          <Feather name="chevron-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={[styles.headIcon, { backgroundColor: "#DC2626" }]}>
          <Feather name="alert-circle" size={20} color="#FFFFFF" />
        </View>
        <View style={styles.headText}>
          <Text style={[styles.title, { color: colors.text }]}>{headerTitle}</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {headerSubtitle}
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.errorCard,
          { backgroundColor: "#FEF2F2", borderColor: "#FCA5A5" },
        ]}
      >
        <Text style={styles.errorEmoji}>
          {isBlocked ? "⏳" : isNotFood ? "🚫" : isUnclear ? "🔍" : "⚠️"}
        </Text>
        <Text style={[styles.errorMessage, { color: "#991B1B" }]}>{message}</Text>
        {detected && detected.trim().length > 0 ? (
          <View style={styles.detectedBox}>
            <Text style={styles.detectedLabel}>Rasmda aniqlangan:</Text>
            <Text style={styles.detectedValue}>{detected}</Text>
          </View>
        ) : null}
      </View>

      {isBlocked ? (
        <>
          <Pressable
            onPress={onGetPremium}
            style={({ pressed }) => [
              styles.cta,
              { backgroundColor: "#2C5F1A", opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Feather name="award" size={18} color="#FFFFFF" />
            <Text style={styles.ctaText}>Premium olish</Text>
          </Pressable>
          <Pressable
            onPress={onBack}
            style={({ pressed }) => [
              styles.cta,
              {
                backgroundColor: colors.background,
                borderWidth: 1.5,
                borderColor: colors.border,
                opacity: pressed ? 0.85 : 1,
                marginTop: -2,
              },
            ]}
          >
            <Feather name="list" size={18} color={colors.text} />
            <Text style={[styles.ctaText, { color: colors.text }]}>Boshqa usul bilan qo'shish</Text>
          </Pressable>
        </>
      ) : isImageSource ? (
        <>
          <Pressable
            onPress={onRetakeCamera}
            style={({ pressed }) => [
              styles.cta,
              { backgroundColor: "#2C5F1A", opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Feather name="camera" size={18} color="#FFFFFF" />
            <Text style={styles.ctaText}>Qaytadan suratga olish</Text>
          </Pressable>
          <Pressable
            onPress={onRetakeGallery}
            style={({ pressed }) => [
              styles.cta,
              {
                backgroundColor: colors.background,
                borderWidth: 1.5,
                borderColor: colors.border,
                opacity: pressed ? 0.85 : 1,
                marginTop: -2,
              },
            ]}
          >
            <Feather name="image" size={18} color={colors.text} />
            <Text style={[styles.ctaText, { color: colors.text }]}>Galereyadan tanlash</Text>
          </Pressable>
        </>
      ) : (
        <Pressable
          onPress={onBack}
          style={({ pressed }) => [
            styles.cta,
            { backgroundColor: "#2C5F1A", opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Feather name="refresh-cw" size={18} color="#FFFFFF" />
          <Text style={styles.ctaText}>Qaytadan urinib ko'rish</Text>
        </Pressable>
      )}
    </View>
  );
}

function ConfirmMacro({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <View style={[styles.confirmMacroBox, { borderColor: color }]}>
      <Text style={[styles.confirmMacroValue, { color }]}>{value}g</Text>
      <Text style={styles.confirmMacroLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  plateTotal: { fontSize: 14, fontFamily: "Inter_700Bold", textAlign: "right", marginTop: 10 },
  flex1: { flex: 1 },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 25, 10, 0.55)",
    justifyContent: "flex-end",
  },
  backdropFull: {
    justifyContent: "flex-start",
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
    paddingHorizontal: 20,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
    elevation: 24,
  },
  sheetFull: {
    flex: 1,
    borderRadius: 0,
    paddingTop: 0,
    paddingHorizontal: 0,
    overflow: "hidden",
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: 14,
  },
  stepWrap: { gap: 14 },
  title: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  subtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  tileList: {
    gap: 10,
    marginTop: 6,
  },
  mealRow: { flexDirection: "row", gap: 6, marginBottom: 4 },
  mealChip: {
    flex: 1,
    alignItems: "center",
    gap: 2,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  mealChipEmoji: { fontSize: 16 },
  mealChipText: { fontSize: 11.5, fontFamily: "Inter_600SemiBold" },
  scanNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  scanNoteText: { flex: 1, fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#92400E" },
  tile: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    gap: 14,
  },
  tileIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  tileText: { flex: 1 },
  tileTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 2,
  },
  tileDesc: {
    fontSize: 12.5,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
  },
  cancelBtn: {
    alignSelf: "center",
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginTop: 4,
  },
  cancelText: { fontSize: 15, fontFamily: "Inter_500Medium" },

  instrHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 4,
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  headIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  headText: { flex: 1 },
  tipsToggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  tipsScroll: {
    maxHeight: 280,
  },
  tipsContent: {
    gap: 10,
    paddingBottom: 4,
  },
  tipRow: {
    flexDirection: "row",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
    alignItems: "center",
  },
  tipEmoji: { fontSize: 22 },
  tipText: { flex: 1 },
  tipTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 2,
  },
  tipDesc: {
    fontSize: 12.5,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
  },
  textField: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
  },
  cta: {
    flexDirection: "row",
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
  },
  ctaText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  chipsRow: { gap: 8, paddingVertical: 2 },
  catChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
  },
  catChipEmoji: { fontSize: 13 },
  catChipLabel: { fontSize: 12.5 },
  catalogList: { maxHeight: 320 },
  catalogEmpty: { alignItems: "center", gap: 10, paddingVertical: 40 },
  catalogRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  catalogEmojiWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  catalogEmoji: { fontSize: 20 },
  catalogName: { fontSize: 14.5, fontFamily: "Inter_600SemiBold" },
  catalogMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  confirmCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 14,
    gap: 12,
  },
  confirmHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  confirmEmojiWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmEmoji: { fontSize: 28 },
  confirmName: { fontSize: 17, fontFamily: "Inter_700Bold" },
  confirmPortion: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  confirmCal: {
    borderRadius: 14,
    alignItems: "center",
    paddingVertical: 14,
    gap: 2,
  },
  confirmCalValue: { fontSize: 30, fontFamily: "Inter_700Bold" },
  confirmCalLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  confirmMacros: { flexDirection: "row", gap: 8 },
  confirmMacroBox: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    gap: 2,
  },
  confirmMacroValue: { fontSize: 15, fontFamily: "Inter_700Bold" },
  confirmMacroLabel: { fontSize: 11, fontFamily: "Inter_500Medium", color: "#666" },
  aiActionRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  aiRejectBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 54,
    borderRadius: 27,
    borderWidth: 1.5,
    gap: 8,
  },
  aiRejectText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  aiConfirmBtn: {
    flex: 1.4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 54,
    borderRadius: 27,
    gap: 8,
  },
  aiConfirmText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  errorCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 18,
    alignItems: "center",
    gap: 10,
  },
  errorEmoji: { fontSize: 36 },
  errorMessage: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
    lineHeight: 20,
  },
  detectedBox: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 4,
    alignItems: "center",
    gap: 4,
  },
  detectedLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: "#9B1C1C",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  detectedValue: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#7F1D1D",
    textAlign: "center",
  },
});

/* ── AiConfirmStep styles ── */
const ac = StyleSheet.create({
  root: { flex: 1 },
  flex1: { flex: 1 },
  scrollContent: { paddingBottom: 24 },
  photoFrame: { width: "100%", backgroundColor: "#1A202C", overflow: "hidden" },
  photoDim: { backgroundColor: "rgba(0,0,0,0.28)" },
  // Stops 24px short of the bottom: the summary card overlaps the frame by
  // 24px, so that strip is blurred backdrop, not the photo itself.
  photoMain: { position: "absolute", top: 0, left: 0, right: 0, bottom: 24 },
  emojiBox: { alignItems: "center", justifyContent: "center" },
  emojiBig: { fontSize: 72 },
  backBtn: {
    position: "absolute",
    left: 14,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  summary: {
    marginHorizontal: 16,
    marginTop: -24,
    borderRadius: 20,
    padding: 16,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  foodName: { fontSize: 19, fontFamily: "Inter_700Bold", lineHeight: 25 },
  foodPortion: { fontSize: 13, fontFamily: "Inter_500Medium", marginTop: 2 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  warnBox: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    backgroundColor: "#FEF3C7",
    borderRadius: 12,
    padding: 10,
  },
  warnText: { flex: 1, fontSize: 12.5, fontFamily: "Inter_500Medium", color: "#92400E", lineHeight: 17 },
  kcalRow: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  kcalValue: { fontSize: 40, fontFamily: "Inter_700Bold", letterSpacing: -1 },
  kcalUnit: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  leftText: { fontSize: 12.5, fontFamily: "Inter_600SemiBold" },
  macroRow: { flexDirection: "row", gap: 8 },
  macroCell: { flex: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 10 },
  macroDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 6 },
  macroValue: { fontSize: 17, fontFamily: "Inter_700Bold" },
  macroUnit: { fontSize: 12, fontFamily: "Inter_500Medium" },
  macroLabel: { fontSize: 11.5, fontFamily: "Inter_500Medium", marginTop: 1 },
  per100: { fontSize: 12, fontFamily: "Inter_400Regular" },
  card: { marginHorizontal: 16, marginTop: 12, borderRadius: 16, borderWidth: 1, padding: 14, gap: 10 },
  cardTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  variantCard: { marginHorizontal: 16, marginTop: 12, borderWidth: 1, shadowOpacity: 0, elevation: 0 },
  sidesCard: { marginHorizontal: 16, marginTop: 12 },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: -4 },
  input: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  multiline: { height: 76, paddingTop: 10, textAlignVertical: "top" },
  editGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  editCell: { flexBasis: "46%", flexGrow: 1, gap: 8 },
  smallPrimary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 44,
    borderRadius: 22,
  },
  smallPrimaryText: { color: "#FFFFFF", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  stepperRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepBtn: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  stepCenter: { flex: 1, alignItems: "center" },
  stepValue: { fontSize: 22, fontFamily: "Inter_700Bold" },
  stepSub: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 1 },
  chipsRow: { gap: 8, paddingVertical: 2 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, borderWidth: 1 },
  chipText: { fontSize: 13.5, fontFamily: "Inter_600SemiBold" },
  customRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  customBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  adviceRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  adviceIcon: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  adviceText: { flex: 1, fontSize: 13.5, fontFamily: "Inter_500Medium", lineHeight: 19 },
  adviceBtn: { borderWidth: 1.5, borderRadius: 22, height: 42, alignItems: "center", justifyContent: "center" },
  adviceBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  adviceDone: { flexDirection: "row", alignItems: "center", gap: 6 },
  adviceDoneText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  extrasHead: { flexDirection: "row", alignItems: "center" },
  linkBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  linkText: { fontSize: 13.5, fontFamily: "Inter_600SemiBold" },
  hintText: { fontSize: 12.5, fontFamily: "Inter_400Regular", lineHeight: 17 },
  extraRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  extraName: { flex: 1, fontSize: 13.5, fontFamily: "Inter_500Medium" },
  extraCal: { fontSize: 13.5, fontFamily: "Inter_600SemiBold" },
  retake: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 18 },
  retakeText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  footer: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  confirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 54,
    borderRadius: 27,
  },
  confirmText: { color: "#FFFFFF", fontSize: 16, fontFamily: "Inter_700Bold" },
});

const vp = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  head: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  icon: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  question: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#1A202C" },
  hint: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#718096", marginTop: 2, lineHeight: 17 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, minWidth: 92 },
  chipLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  chipCal: { fontSize: 11.5, fontFamily: "Inter_500Medium", marginTop: 1 },
});

const sl = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: 14 },
  title: { fontSize: 15, fontFamily: "Inter_700Bold" },
  hint: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2, marginBottom: 6, lineHeight: 17 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  emoji: { fontSize: 20 },
  name: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  portion: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  cal: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  struck: { textDecorationLine: "line-through" },
});
