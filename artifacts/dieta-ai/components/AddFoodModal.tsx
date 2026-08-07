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
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import {
  aiAnalyzeImage,
  aiAnalyzeText,
} from "@/lib/api-client";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
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
  source: Source;
  imageUri?: string;
  extras?: ExtraItem[];
}

interface AddedFood {
  name: string;
  cal: number;
  source: Source;
  protein?: number;
  carbs?: number;
  fat?: number;
  portion?: string;
  emoji?: string;
  imageUri?: string;
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
  onAdd: (food: AddedFood) => void;
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

export function AddFoodModal({ visible, onClose, onAdd, remainingCal, dailyCalories, userContext }: AddFoodModalProps) {
  const buildCtx = (): AiUserContext | undefined => {
    if (!userContext && remainingCal == null && dailyCalories == null) return undefined;
    const merged: AiUserContext = { ...(userContext ?? {}) };
    if (merged.dailyCalories == null && dailyCalories != null) merged.dailyCalories = dailyCalories;
    if (merged.remainingCal == null && remainingCal != null) merged.remainingCal = remainingCal;
    return merged;
  };
  const colors = useColors();
  const insets = useSafeAreaInsets();
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

  const fade = useRef(new Animated.Value(0)).current;
  const sheetY = useRef(new Animated.Value(40)).current;
  const stepFade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
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
    onAdd({
      name: pickedFood.name,
      cal: pickedFood.cal,
      protein: pickedFood.protein,
      carbs: pickedFood.carbs,
      fat: pickedFood.fat,
      portion: pickedFood.portion,
      emoji: pickedFood.emoji,
      source: "catalog",
    });
    onClose();
  };

  const showAnalysisResult = (
    analysis: {
      status?: string;
      reason?: string;
      detected?: string;
      name?: string;
      portion?: string;
      emoji?: string;
      calories?: number;
      protein?: number;
      carbs?: number;
      fat?: number;
    },
    source: Source,
    imageUri?: string,
  ) => {
    if (analysis.status === "ok") {
      const extra = analysis as typeof analysis & {
        portionGrams?: number;
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
      };
      setAiResult({
        source,
        name: analysis.name ?? "Aniqlanmagan taom",
        portion: analysis.portion ?? "1 porsiya",
        portionGrams: extra.portionGrams,
        emoji: analysis.emoji ?? "🍽️",
        cal: analysis.calories ?? 0,
        protein: analysis.protein ?? 0,
        carbs: analysis.carbs ?? 0,
        fat: analysis.fat ?? 0,
        caloriesPer100: extra.caloriesPer100,
        unitPer100: extra.unitPer100 ?? "g",
        unitName: extra.unitName,
        unitGrams: extra.unitGrams,
        units: extra.units,
        coachAdvice: extra.coachAdvice,
        recommendedUnits: extra.recommendedUnits,
        recommendedCal: extra.recommendedCal,
        recommendedProtein: extra.recommendedProtein,
        recommendedCarbs: extra.recommendedCarbs,
        recommendedFat: extra.recommendedFat,
        imageUri,
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

  const handleConfirmAiFinal = (totals: {
    cal: number;
    protein: number;
    carbs: number;
    fat: number;
    portionLabel: string;
    extrasSummary?: string;
  }) => {
    if (!aiResult) return;
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    const displayName = totals.extrasSummary
      ? `${aiResult.name} (+${totals.extrasSummary})`
      : aiResult.name;
    onAdd({
      name: displayName,
      cal: Math.max(0, Math.round(totals.cal)),
      protein: Math.max(0, Math.round(totals.protein)),
      carbs: Math.max(0, Math.round(totals.carbs)),
      fat: Math.max(0, Math.round(totals.fat)),
      portion: totals.portionLabel || aiResult.portion,
      emoji: aiResult.emoji,
      source: aiResult.source,
      imageUri: aiResult.imageUri,
    });
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
      const newExtra: ExtraItem =
        res.status === "ok"
          ? {
              note,
              cal: Math.max(0, Math.round(res.calories ?? 0)),
              protein: Math.max(0, Math.round(res.protein ?? 0)),
              carbs: Math.max(0, Math.round(res.carbs ?? 0)),
              fat: Math.max(0, Math.round(res.fat ?? 0)),
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
                backgroundColor: step === "ai-confirm" ? "#EDF2F7" : colors.card,
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
    </Modal>
  );
}

function ChooseStep({
  colors,
  onPick,
  onClose,
}: {
  colors: ColorPalette;
  onPick: (s: Source) => void;
  onClose: () => void;
}) {
  return (
    <View style={styles.stepWrap}>
      <Text style={[styles.title, { color: colors.text }]}>Ovqat qo'shish</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        Bugungi kunga qaysi yo'l bilan qo'shasiz?
      </Text>

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
    </View>
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
  { emoji: "📐", title: "Yuqoridan oling", desc: "Kamerani tovoqqa to'g'ri (90°) tushadigan qiling" },
  { emoji: "🍽️", title: "Bitta ovqat", desc: "Bir vaqtda bitta tovoqni rasmga oling" },
  { emoji: "📏", title: "Yaqin keling", desc: "Ovqat kadrning kamida 70%ini egallasin" },
];

const GALLERY_TIPS: Tip[] = [
  { emoji: "✅", title: "Yangi rasm", desc: "Yaqinda olingan, yaxshi yoritilgan rasm", good: true },
  { emoji: "✅", title: "Aniq tovoq", desc: "Bitta ovqat, ranglari aniq ko'rinadi", good: true },
  { emoji: "❌", title: "Yaroqsiz", desc: "Qorong'i, blur, ekrandan olingan yoki ko'p ovqat", good: false },
];

const TEXT_TIPS: Tip[] = [
  { emoji: "✅", title: "1 tovoq osh", desc: "Porsiya bilan: tovoq, kosa, stakan", good: true },
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
          placeholder="Masalan: 1 tovoq osh"
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
}: {
  colors: ColorPalette;
  food: AiResult;
  onBack: () => void;
  onConfirm: (totals: {
    cal: number;
    protein: number;
    carbs: number;
    fat: number;
    portionLabel: string;
    extrasSummary?: string;
  }) => void;
  onReject: () => void;
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

  useEffect(() => {
    setPortion(1.0);
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
  onConfirmFinal: (totals: {
    cal: number;
    protein: number;
    carbs: number;
    fat: number;
    portionLabel: string;
    extrasSummary?: string;
  }) => void;
  onReject: () => void;
  onUpdateFood: (patch: Partial<AiResult>) => void;
  onAddIngredient: (note: string) => void;
  onRemoveIngredient: (index: number) => void;
  recomputing: boolean;
  remainingCal?: number;
  dailyCalories?: number;
  mealsPerDay?: number;
  bottomInset: number;
}) {
  const [portion, setPortion] = useState(1.0);
  const [showDetails, setShowDetails] = useState(false);
  const [showPortion, setShowPortion] = useState(false);
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

  // Tabiiy birlik (dona/burda/tovoq/kosa/stakan/piyola/sixcha) yoki gramm/ml
  const COUNT_UNITS = new Set(["dona", "burda", "tovoq", "kosa", "stakan", "piyola", "sixcha"]);
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

  // Tavsiya qabul qilinganda asosiy taomning aniq qiymatlari (server raqami yoki mult orqali)
  const acceptBaseCal =
    food.recommendedCal != null && food.recommendedCal >= 0
      ? food.recommendedCal
      : Math.round(food.cal * acceptMult);
  const acceptBaseProtein =
    food.recommendedProtein != null && food.recommendedProtein >= 0
      ? food.recommendedProtein
      : Math.round(food.protein * acceptMult);
  const acceptBaseCarbs =
    food.recommendedCarbs != null && food.recommendedCarbs >= 0
      ? food.recommendedCarbs
      : Math.round(food.carbs * acceptMult);
  const acceptBaseFat =
    food.recommendedFat != null && food.recommendedFat >= 0
      ? food.recommendedFat
      : Math.round(food.fat * acceptMult);

  // Qo'shimchalarning qisqa nomini tuzish — saqlangan taom nomida ishlatish uchun
  const extrasSummary = (() => {
    if (extras.length === 0) return undefined;
    if (extras.length === 1) return extras[0].note.length > 30 ? `${extras[0].note.slice(0, 30)}…` : extras[0].note;
    return `${extras.length} qo'shimcha`;
  })();

  // Porsiya yorlig'i — saqlanganda ko'rinadi
  const acceptPortionLabel = isCountUnit
    ? `${fmtUnits(recommendedUnits ?? baseUnits * acceptMult)} ${unitNamePlural}`
    : recommendedGrams
      ? `${recommendedGrams}${unit}`
      : food.portion;
  const manualPortionLabel = isCountUnit
    ? `${fmtUnits(portion * baseUnits)} ${unitNamePlural}`
    : `${fmtUnits(portion)}× ${food.portion}`;

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

  return (
    <KeyboardAwareScrollViewCompat
      style={ac.container}
      contentContainerStyle={[ac.contentContainer, { paddingBottom: bottomInset + 16 }]}
      showsVerticalScrollIndicator={false}
      bounces={false}
      bottomOffset={20}
    >
      {/* ── Header ── */}
      <LinearGradient
        colors={["#1A4F8A", "#2471A3"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={ac.header}
      >
        <TouchableOpacity onPress={onBack} hitSlop={12} style={ac.headerBack}>
          <Feather name="chevron-left" size={26} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={ac.headerTitle}>Ovqat topildi!</Text>
        <View style={ac.headerSpacer} />
      </LinearGradient>

      {/* ── Food Image ── */}
      {food.imageUri ? (
        <Image
          source={{ uri: food.imageUri }}
          style={ac.foodImage}
          contentFit="cover"
        />
      ) : (
        <View style={ac.foodEmojiBox}>
          <Text style={ac.foodEmoji}>{food.emoji}</Text>
        </View>
      )}

      {/* ── Food name badge ── */}
      <View style={ac.nameBadge}>
        <Text style={ac.nameBadgeText} numberOfLines={1}>{food.name}</Text>
        <Text style={ac.portionBadgeText}>{food.portion}</Text>
      </View>

      {/* ── Receipt-style breakdown (extras list) ── */}
      {extras.length > 0 ? (
        <View style={ac.receiptBox}>
          <View style={ac.receiptHeader}>
            <Feather name="plus-circle" size={14} color="#7D3C98" />
            <Text style={ac.receiptTitle}>Qo'shimchalar ({extras.length})</Text>
          </View>
          <View style={ac.receiptMain}>
            <Text style={ac.receiptMainName} numberOfLines={1}>
              {food.name} · {isCountUnit ? `${fmtUnits(portion * baseUnits)} ${unitNamePlural}` : food.portion}
            </Text>
            <Text style={ac.receiptMainCal}>{baseCal} kkal</Text>
          </View>
          {extras.map((it, idx) => (
            <View key={`${it.note}-${idx}`} style={ac.receiptRow}>
              <Text style={ac.receiptRowName} numberOfLines={2}>+ {it.note}</Text>
              <Text style={ac.receiptRowCal}>
                {it.cal > 0 ? `${it.cal} kkal` : "?"}
              </Text>
              <TouchableOpacity
                onPress={() => onRemoveIngredient(idx)}
                hitSlop={8}
                style={ac.receiptRowRemove}
              >
                <Feather name="x" size={14} color="#7D3C98" />
              </TouchableOpacity>
            </View>
          ))}
          <View style={ac.receiptDivider} />
          <View style={ac.receiptTotal}>
            <Text style={ac.receiptTotalLabel}>Jami</Text>
            <Text style={ac.receiptTotalCal}>{displayCal} kkal</Text>
          </View>
        </View>
      ) : null}

      {/* ── AI Advice Panel ── */}
      <LinearGradient
        colors={["#1B3F6E", "#2471A3"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={ac.aiPanel}
      >
        <View style={ac.aiPanelRow}>
          <View style={ac.aiIconWrap}>
            <Feather name="cpu" size={20} color="#FFFFFF" />
          </View>
          <Text style={ac.aiPanelText}>{aiAdvice}</Text>
        </View>
        <TouchableOpacity
          style={ac.aiAcceptBtn}
          onPress={() => {
            onConfirmFinal({
              cal: acceptBaseCal + extrasCalSum,
              protein: acceptBaseProtein + extrasProteinSum,
              carbs: acceptBaseCarbs + extrasCarbsSum,
              fat: acceptBaseFat + extrasFatSum,
              portionLabel: acceptPortionLabel,
              extrasSummary,
            });
          }}
          activeOpacity={0.82}
        >
          <Text style={ac.aiAcceptBtnText}>
            Tavsiyani qabul qilaman ({acceptBaseCal + extrasCalSum} kkal)
          </Text>
        </TouchableOpacity>
      </LinearGradient>

      {/* ── Details Toggle Button ── */}
      <TouchableOpacity
        style={ac.detailsToggle}
        onPress={() => {
          setShowDetails((v) => !v);
          if (!showDetails) {
            setShowPortion(false);
            setShowEdit(false);
            setShowIngredient(false);
          }
        }}
        activeOpacity={0.75}
      >
        <Feather name="sliders" size={15} color="#2471A3" />
        <Text style={ac.detailsToggleText}>
          {showDetails ? "Sozlamalarni yashirish" : "Batafsil sozlamalar va makrolar"}
        </Text>
        <Feather name={showDetails ? "chevron-up" : "chevron-down"} size={15} color="#2471A3" />
      </TouchableOpacity>

      {showDetails && (
        <>
          {/* ── Nutrition Grid ── */}
          <View style={ac.nutriRow}>
            <View style={ac.nutriCell}>
              <Text style={ac.nutriLabel}>Kaloriya</Text>
              <Text style={ac.nutriValue}>{displayCal}<Text style={ac.nutriUnit}> kcal</Text></Text>
            </View>
            <View style={[ac.nutriCell, ac.nutriBorder]}>
              <Text style={ac.nutriLabel}>Uglevodlar</Text>
              <Text style={ac.nutriValue}>{displayCarbs}<Text style={ac.nutriUnit}> g</Text></Text>
            </View>
            <View style={[ac.nutriCell, ac.nutriBorder]}>
              <Text style={ac.nutriLabel}>Oqsil</Text>
              <Text style={ac.nutriValue}>{displayProtein}<Text style={ac.nutriUnit}> g</Text></Text>
            </View>
            <View style={[ac.nutriCell, ac.nutriBorder]}>
              <Text style={ac.nutriLabel}>Yog'</Text>
              <Text style={ac.nutriValue}>{displayFat}<Text style={ac.nutriUnit}> g</Text></Text>
            </View>
          </View>

          {/* ── Per 100g/100ml info ── */}
          {per100Cal != null && per100Cal > 0 ? (
            <View style={ac.per100Row}>
              <View style={ac.per100IconWrap}>
                <Feather name="info" size={14} color="#1A5276" />
              </View>
              <Text style={ac.per100Text}>
                {isCountUnit && food.unitGrams
                  ? `1 ${unitNamePlural} ~${Math.round(food.unitGrams)}${unit} · 100${unit}: `
                  : `100${unit} uchun: `}
                <Text style={ac.per100Bold}>{per100Cal} kkal</Text>
                {!isCountUnit && food.portionGrams ? ` · porsiya ~${food.portionGrams}${unit}` : ""}
              </Text>
            </View>
          ) : null}

          {/* ── Portion Selector ── */}
          {showPortion && (
            <View style={ac.portionSelector}>
              <Text style={ac.portionSelectorTitle}>Porsiyani tanlang</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={ac.portionOptionsRow}
                keyboardShouldPersistTaps="handled"
              >
                {PORTION_OPTIONS.map((p) => {
                  const active = Math.abs(portion - p.mult) < 0.01;
                  return (
                    <TouchableOpacity
                      key={p.label}
                      onPress={() => setPortion(p.mult)}
                      style={[ac.portionOption, active && ac.portionOptionActive]}
                      activeOpacity={0.75}
                    >
                      <Text style={[ac.portionOptionText, active && ac.portionOptionTextActive]}>
                        {p.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <View style={ac.customPortionRow}>
                <TextInput
                  value={customPortionText}
                  onChangeText={setCustomPortionText}
                  placeholder={isCountUnit ? `Qo'lda: masalan 1.5` : `Qo'lda: masalan 1.5`}
                  placeholderTextColor="#9AAAB8"
                  keyboardType="decimal-pad"
                  style={ac.customPortionInput}
                  onSubmitEditing={applyCustomPortion}
                  returnKeyType="done"
                />
                <TouchableOpacity
                  style={[
                    ac.customPortionBtn,
                    !customPortionText.trim() && { opacity: 0.4 },
                  ]}
                  onPress={applyCustomPortion}
                  disabled={!customPortionText.trim()}
                  activeOpacity={0.8}
                >
                  <Feather name="check" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
              <Text style={ac.customPortionHint}>
                Tanlangan: {fmtUnits(isCountUnit ? portion * baseUnits : portion)}
                {isCountUnit ? ` ${unitNamePlural}` : "x"} ≈ {displayCal} kkal
              </Text>
            </View>
          )}

          {/* ── Action Grid ── */}
          <View style={ac.actionGrid}>
            <TouchableOpacity
              style={[ac.actionCell, showPortion && ac.actionCellActive]}
              onPress={() => { setShowPortion((v) => !v); setShowEdit(false); setShowIngredient(false); }}
              activeOpacity={0.75}
            >
              <View style={[ac.actionIcon, { backgroundColor: "#EBF5FB" }]}>
                <Feather name="sliders" size={20} color="#2471A3" />
              </View>
              <Text style={ac.actionLabel}>Porsiyani sozlash</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[ac.actionCell, showEdit && ac.actionCellActive]}
              onPress={() => { setShowEdit((v) => !v); setShowPortion(false); setShowIngredient(false); }}
              activeOpacity={0.75}
            >
              <View style={[ac.actionIcon, { backgroundColor: "#EBF5FB" }]}>
                <Feather name="edit-2" size={20} color="#2471A3" />
              </View>
              <Text style={ac.actionLabel}>Ovqatni tahrirlash</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[ac.actionCell, showIngredient && ac.actionCellActive]}
              onPress={() => { setShowIngredient((v) => !v); setShowPortion(false); setShowEdit(false); }}
              activeOpacity={0.75}
            >
              <View style={[ac.actionIcon, { backgroundColor: "#F4ECF7" }]}>
                <Feather name="plus-circle" size={20} color="#7D3C98" />
              </View>
              <Text style={ac.actionLabel}>Qo'shimcha qo'shish</Text>
            </TouchableOpacity>

            <TouchableOpacity style={ac.actionCell} onPress={onReject} activeOpacity={0.75}>
              <View style={[ac.actionIcon, { backgroundColor: "#FEF9E7" }]}>
                <Feather name="refresh-cw" size={20} color="#B7950B" />
              </View>
              <Text style={ac.actionLabel}>Ovqat turini o'zgartir</Text>
            </TouchableOpacity>
          </View>

          {/* ── Edit form ── */}
          {showEdit && (
            <View style={ac.editForm}>
              <Text style={ac.editFormTitle}>Ovqatni tahrirlash</Text>
              <Text style={ac.editLabel}>Nomi</Text>
              <TextInput
                value={editName}
                onChangeText={setEditName}
                style={ac.editInput}
                placeholder="Taom nomi"
                placeholderTextColor="#9AAAB8"
              />
              <Text style={ac.editLabel}>Porsiya tavsifi</Text>
              <TextInput
                value={editPortionText}
                onChangeText={setEditPortionText}
                style={ac.editInput}
                placeholder="masalan: 1 tovoq (350g)"
                placeholderTextColor="#9AAAB8"
              />
              <View style={ac.editGrid}>
                <View style={ac.editGridCell}>
                  <Text style={ac.editLabel}>Kaloriya</Text>
                  <TextInput
                    value={editCal}
                    onChangeText={setEditCal}
                    style={ac.editInput}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#9AAAB8"
                  />
                </View>
                <View style={ac.editGridCell}>
                  <Text style={ac.editLabel}>Oqsil (g)</Text>
                  <TextInput
                    value={editProtein}
                    onChangeText={setEditProtein}
                    style={ac.editInput}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#9AAAB8"
                  />
                </View>
              </View>
              <View style={ac.editGrid}>
                <View style={ac.editGridCell}>
                  <Text style={ac.editLabel}>Uglevod (g)</Text>
                  <TextInput
                    value={editCarbs}
                    onChangeText={setEditCarbs}
                    style={ac.editInput}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#9AAAB8"
                  />
                </View>
                <View style={ac.editGridCell}>
                  <Text style={ac.editLabel}>Yog' (g)</Text>
                  <TextInput
                    value={editFat}
                    onChangeText={setEditFat}
                    style={ac.editInput}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#9AAAB8"
                  />
                </View>
              </View>
              <TouchableOpacity style={ac.editSaveBtn} onPress={applyEdit} activeOpacity={0.85}>
                <Feather name="check" size={16} color="#FFFFFF" />
                <Text style={ac.editSaveBtnText}>Saqlash</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Ingredient form ── */}
          {showIngredient && (
            <View style={ac.editForm}>
              <Text style={ac.editFormTitle}>Qo'shimcha qo'shish</Text>
              <Text style={ac.editLabel}>Nimani qo'shdingiz?</Text>
              <TextInput
                value={ingredientNote}
                onChangeText={setIngredientNote}
                style={[ac.editInput, { height: 80, textAlignVertical: "top", paddingTop: 10 }]}
                multiline
                editable={!recomputing}
                placeholder="masalan: 30g sariyog' va 1 osh qoshiq smetana"
                placeholderTextColor="#9AAAB8"
              />
              <TouchableOpacity
                style={[
                  ac.editSaveBtn,
                  (!ingredientNote.trim() || recomputing) && { opacity: 0.5 },
                ]}
                onPress={applyIngredient}
                disabled={!ingredientNote.trim() || recomputing}
                activeOpacity={0.85}
              >
                {recomputing ? (
                  <>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={ac.editSaveBtnText}>AI hisoblamoqda…</Text>
                  </>
                ) : (
                  <>
                    <Feather name="plus" size={16} color="#FFFFFF" />
                    <Text style={ac.editSaveBtnText}>Qo'shimchani qo'shish</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </>
      )}

      {/* ── Bottom Buttons ── */}
      <View style={ac.bottomRow}>
        <TouchableOpacity style={ac.retakeBtn} onPress={onReject} activeOpacity={0.8}>
          <Feather name="camera" size={16} color="#4A5568" />
          <Text style={ac.retakeBtnText} numberOfLines={1}>Qayta olish</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={ac.confirmBtn}
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
          activeOpacity={0.85}
        >
          <Text style={ac.confirmBtnText} numberOfLines={1}>
            Kiritish · {displayCal} kkal
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAwareScrollViewCompat>
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
}: {
  colors: ColorPalette;
  message: string;
  detected: string | null;
  status: string | null;
  source: Source | null;
  onBack: () => void;
  onRetakeCamera: () => void;
  onRetakeGallery: () => void;
}) {
  const isNotFood = status === "not_food";
  const isUnclear = status === "unclear";
  const isImageSource = source === "camera" || source === "gallery";
  const headerTitle = isNotFood
    ? "Bu ovqat emas"
    : isUnclear
      ? "Rasm noaniq"
      : "Aniqlanmadi";
  const headerSubtitle = isNotFood
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
        <Text style={styles.errorEmoji}>{isNotFood ? "🚫" : isUnclear ? "🔍" : "⚠️"}</Text>
        <Text style={[styles.errorMessage, { color: "#991B1B" }]}>{message}</Text>
        {detected && detected.trim().length > 0 ? (
          <View style={styles.detectedBox}>
            <Text style={styles.detectedLabel}>Rasmda aniqlangan:</Text>
            <Text style={styles.detectedValue}>{detected}</Text>
          </View>
        ) : null}
      </View>

      {isImageSource ? (
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
  container: {
    flex: 1,
    backgroundColor: "#EDF2F7",
  },
  contentContainer: {
    flexGrow: 1,
  },
  /* Header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: Platform.OS === "ios" ? 54 : 40,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  headerBack: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    flex: 1,
    textAlign: "center",
  },
  headerSpacer: { width: 40 },
  /* Food image */
  foodImage: {
    width: "100%",
    height: 230,
    resizeMode: "cover",
  },
  foodEmojiBox: {
    width: "100%",
    height: 200,
    backgroundColor: "#D6EAF8",
    alignItems: "center",
    justifyContent: "center",
  },
  foodEmoji: { fontSize: 80 },
  /* Name badge */
  nameBadge: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginTop: -20,
    borderRadius: 14,
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  nameBadgeText: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: "#1A2B3C",
    flex: 1,
  },
  portionBadgeText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#5D7A8A",
    flexShrink: 0,
  },
  /* AI Panel */
  aiPanel: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  aiPanelRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  aiIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1,
  },
  aiPanelText: {
    flex: 1,
    fontSize: 13.5,
    fontFamily: "Inter_500Medium",
    color: "#D6EAF8",
    lineHeight: 20,
  },
  aiAcceptBtn: {
    backgroundColor: "#1A5276",
    borderRadius: 24,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  /* Details Toggle */
  detailsToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#EBF5FB",
    borderWidth: 1,
    borderColor: "#AED6F1",
  },
  detailsToggleText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#2471A3",
  },
  aiAcceptBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  /* Nutrition row */
  nutriRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 3,
  },
  nutriCell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 4,
    gap: 4,
  },
  nutriBorder: {
    borderLeftWidth: 1,
    borderLeftColor: "#EAF0F6",
  },
  nutriLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: "#7F8C9A",
    textAlign: "center",
  },
  nutriValue: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#1A2B3C",
  },
  nutriUnit: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#7F8C9A",
  },
  /* Portion selector */
  portionSelector: {
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 5,
    elevation: 2,
  },
  portionSelectorTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#1A2B3C",
    textAlign: "center",
  },
  portionOptionsRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  portionOption: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#CBD5E0",
    backgroundColor: "#F7FAFC",
  },
  customPortionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
    alignItems: "center",
  },
  customPortionInput: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    borderWidth: 1.2,
    borderColor: "#CBD5E0",
    backgroundColor: "#F7FAFC",
    paddingHorizontal: 12,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: "#1A2B3C",
  },
  customPortionBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: "#2471A3",
    alignItems: "center",
    justifyContent: "center",
  },
  customPortionHint: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#5D7A8A",
    textAlign: "center",
    marginTop: 2,
  },
  /* Receipt-style breakdown */
  receiptBox: {
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: "#E8DCEF",
  },
  receiptHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  receiptTitle: {
    fontSize: 12.5,
    fontFamily: "Inter_700Bold",
    color: "#7D3C98",
  },
  receiptMain: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingVertical: 4,
  },
  receiptMainName: {
    flex: 1,
    fontSize: 13.5,
    fontFamily: "Inter_600SemiBold",
    color: "#1A2B3C",
  },
  receiptMainCal: {
    fontSize: 13.5,
    fontFamily: "Inter_700Bold",
    color: "#1A2B3C",
  },
  receiptRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  receiptRowName: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#5B2C6F",
  },
  receiptRowCal: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#7D3C98",
  },
  receiptRowRemove: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(125,60,152,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  receiptDivider: {
    height: 1,
    backgroundColor: "#E8DCEF",
    marginVertical: 4,
  },
  receiptTotal: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  receiptTotalLabel: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#1A2B3C",
  },
  receiptTotalCal: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#0E7C3A",
  },
  portionOptionActive: {
    backgroundColor: "#2471A3",
    borderColor: "#2471A3",
  },
  portionOptionText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#4A5568",
  },
  portionOptionTextActive: { color: "#FFFFFF" },
  /* Action grid */
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: 16,
    marginTop: 10,
    gap: 10,
  },
  actionCell: {
    width: "47.5%",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 5,
    elevation: 2,
  },
  actionCellActive: {
    borderWidth: 1.5,
    borderColor: "#2471A3",
    backgroundColor: "#EBF5FB",
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#2C3E50",
    textAlign: "center",
    lineHeight: 18,
  },
  /* Per-100 info row */
  per100Row: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#EBF5FB",
    borderRadius: 10,
    gap: 8,
  },
  per100IconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  per100Text: {
    flex: 1,
    fontSize: 12.5,
    fontFamily: "Inter_500Medium",
    color: "#1A5276",
  },
  per100Bold: {
    fontFamily: "Inter_700Bold",
  },
  /* Edit form */
  editForm: {
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 5,
    elevation: 2,
  },
  editFormTitle: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#1A2B3C",
    marginBottom: 4,
  },
  editLabel: {
    fontSize: 11.5,
    fontFamily: "Inter_500Medium",
    color: "#5D7A8A",
    marginTop: 4,
  },
  editInput: {
    height: 42,
    borderRadius: 10,
    borderWidth: 1.2,
    borderColor: "#CBD5E0",
    backgroundColor: "#F7FAFC",
    paddingHorizontal: 12,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: "#1A2B3C",
  },
  editGrid: {
    flexDirection: "row",
    gap: 10,
  },
  editGridCell: {
    flex: 1,
  },
  editSaveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 44,
    borderRadius: 22,
    backgroundColor: "#2471A3",
    gap: 8,
    marginTop: 10,
  },
  editSaveBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  /* Bottom buttons */
  bottomRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 14,
    gap: 10,
  },
  retakeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 54,
    paddingHorizontal: 14,
    borderRadius: 27,
    borderWidth: 1.5,
    borderColor: "#CBD5E0",
    backgroundColor: "#FFFFFF",
    gap: 6,
  },
  retakeBtnText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#4A5568",
  },
  confirmBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: 54,
    borderRadius: 27,
    backgroundColor: "#1A5276",
    shadowColor: "#1A5276",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  confirmBtnText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
  },
});
