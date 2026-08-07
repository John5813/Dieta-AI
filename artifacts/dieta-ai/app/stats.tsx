import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

type Range = "week" | "month";

interface DayBucket {
  date: string;
  label: string;
  short: string;
  cal: number;
  protein: number;
  carbs: number;
  fat: number;
  count: number;
  burned: number;
}

const UZ_WEEKDAYS_SHORT = ["Yak", "Du", "Se", "Cho", "Pa", "Ju", "Sha"];
const UZ_MONTHS = [
  "Yan", "Fev", "Mar", "Apr", "May", "Iyn",
  "Iyl", "Avg", "Sen", "Okt", "Noy", "Dek",
];

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function buildBuckets(
  entries: ReturnType<typeof useApp>["entries"],
  burnedByDate: Record<string, number>,
  days: number,
): DayBucket[] {
  const buckets: DayBucket[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = ymd(d);
    const dayEntries = entries.filter((e) => e.date === key);
    const cal = dayEntries.reduce((s, e) => s + (Number.isFinite(e.cal) ? e.cal : 0), 0);
    const protein = dayEntries.reduce((s, e) => s + (Number.isFinite(e.protein) ? e.protein : 0), 0);
    const carbs = dayEntries.reduce((s, e) => s + (Number.isFinite(e.carbs) ? e.carbs : 0), 0);
    const fat = dayEntries.reduce((s, e) => s + (Number.isFinite(e.fat) ? e.fat : 0), 0);
    const burned = burnedByDate[key] ?? 0;
    const net = Math.max(0, cal - burned);
    buckets.push({
      date: key,
      label: `${d.getDate()} ${UZ_MONTHS[d.getMonth()]}`,
      short: days <= 7 ? UZ_WEEKDAYS_SHORT[d.getDay()] : String(d.getDate()),
      cal: net,
      protein,
      carbs,
      fat,
      count: dayEntries.length,
      burned,
    });
  }
  return buckets;
}

export default function StatsScreen() {
  const { entries, burnedByDate, profile, todayKey, setAddFoodModalVisible } = useApp();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [range, setRange] = useState<Range>("week");
  const [showTodayFoods, setShowTodayFoods] = useState(false);

  const goal = profile.dailyCalories ?? 1993;
  const days = range === "week" ? 7 : 30;

  const buckets = useMemo(
    () => buildBuckets(entries, burnedByDate, days),
    [entries, burnedByDate, days],
  );

  const todayEntries = useMemo(
    () => entries.filter((e) => e.date === todayKey),
    [entries, todayKey],
  );

  const activeBuckets = buckets.filter((b) => b.count > 0);
  const totalCal = buckets.reduce((s, b) => s + b.cal, 0);
  const totalEntries = buckets.reduce((s, b) => s + b.count, 0);
  const avgCal = activeBuckets.length > 0
    ? Math.round(totalCal / activeBuckets.length)
    : 0;
  const daysHitGoal = buckets.filter((b) => {
    if (b.count === 0) return false;
    return b.cal <= goal && b.cal >= goal * 0.8;
  }).length;
  const daysOverGoal = buckets.filter((b) => b.cal > goal).length;
  const daysUnderGoal = buckets.filter((b) => b.count > 0 && b.cal < goal * 0.8).length;

  const totalProtein = buckets.reduce((s, b) => s + b.protein, 0);
  const totalCarbs = buckets.reduce((s, b) => s + b.carbs, 0);
  const totalFat = buckets.reduce((s, b) => s + b.fat, 0);
  const avgProtein = activeBuckets.length > 0 ? Math.round(totalProtein / activeBuckets.length) : 0;
  const avgCarbs = activeBuckets.length > 0 ? Math.round(totalCarbs / activeBuckets.length) : 0;
  const avgFat = activeBuckets.length > 0 ? Math.round(totalFat / activeBuckets.length) : 0;

  let streak = 0;
  for (let i = buckets.length - 1; i >= 0; i--) {
    if (buckets[i].count > 0) streak++;
    else break;
  }

  const maxBar = Math.max(goal, ...buckets.map((b) => b.cal), 1);

  const topPad = Platform.OS === "web" ? 16 : insets.top + 8;
  const bottomPad = Platform.OS === "web" ? 32 : insets.bottom + 24;

  const todayTotalCal = todayEntries.reduce((s, e) => s + (e.cal || 0), 0);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad, borderColor: colors.border }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Orqaga"
          style={({ pressed }) => [
            styles.backBtn,
            { backgroundColor: colors.secondary, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Feather name="chevron-left" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Statistika</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Bugungi ovqatlar tugmasi ── */}
        <Pressable
          onPress={() => setShowTodayFoods((v) => !v)}
          style={({ pressed }) => [
            styles.todayBtn,
            {
              backgroundColor: showTodayFoods ? colors.primary : colors.card,
              borderColor: colors.primary,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Feather
            name="calendar"
            size={16}
            color={showTodayFoods ? "#FFFFFF" : colors.primary}
          />
          <Text style={[
            styles.todayBtnText,
            { color: showTodayFoods ? "#FFFFFF" : colors.primary },
          ]}>
            Bugungi ovqatlar ({todayEntries.length})
          </Text>
          {todayTotalCal > 0 && (
            <View style={[
              styles.todayCalBadge,
              { backgroundColor: showTodayFoods ? "rgba(255,255,255,0.25)" : colors.primary + "18" },
            ]}>
              <Text style={[
                styles.todayCalBadgeText,
                { color: showTodayFoods ? "#FFFFFF" : colors.primary },
              ]}>
                {todayTotalCal} kkal
              </Text>
            </View>
          )}
          <Feather
            name={showTodayFoods ? "chevron-up" : "chevron-down"}
            size={16}
            color={showTodayFoods ? "#FFFFFF" : colors.primary}
          />
        </Pressable>

        {/* ── Bugungi ovqatlar ro'yxati ── */}
        {showTodayFoods && (
          <View style={[styles.todayFoodsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {todayEntries.length === 0 ? (
              <View style={styles.todayEmpty}>
                <Feather name="inbox" size={28} color={colors.mutedForeground} />
                <Text style={[styles.todayEmptyText, { color: colors.mutedForeground }]}>
                  Bugun hali ovqat qo'shilmagan
                </Text>
                <Pressable
                  onPress={() => {
                    setShowTodayFoods(false);
                    router.back();
                    setTimeout(() => setAddFoodModalVisible(true), 300);
                  }}
                  style={({ pressed }) => [
                    styles.addFoodBtn,
                    { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <Feather name="plus" size={16} color="#FFFFFF" />
                  <Text style={styles.addFoodBtnText}>Ovqat qo'shish</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <View style={styles.todayFoodsSummary}>
                  <Text style={[styles.todayFoodsSummaryText, { color: colors.mutedForeground }]}>
                    Jami: <Text style={[styles.todayFoodsSummaryBold, { color: colors.text }]}>{todayTotalCal} kkal</Text>
                    {" · "}{todayEntries.length} ta ovqat
                  </Text>
                  <Pressable
                    onPress={() => {
                      setShowTodayFoods(false);
                      router.back();
                      setTimeout(() => setAddFoodModalVisible(true), 300);
                    }}
                    hitSlop={8}
                    style={({ pressed }) => [
                      styles.addMoreBtn,
                      { backgroundColor: colors.primary + "18", opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    <Feather name="plus" size={14} color={colors.primary} />
                    <Text style={[styles.addMoreText, { color: colors.primary }]}>Qo'shish</Text>
                  </Pressable>
                </View>
                {todayEntries.map((e) => (
                  <View
                    key={e.id}
                    style={[styles.foodRow, { borderColor: colors.border }]}
                  >
                    <View style={[styles.foodIcon, { backgroundColor: colors.secondary }]}>
                      {e.imageUri ? (
                        <Image
                          source={{ uri: e.imageUri }}
                          style={styles.foodThumb}
                          contentFit="cover"
                        />
                      ) : (
                        <Text style={styles.foodEmoji}>{e.emoji || "🍽️"}</Text>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.foodName, { color: colors.text }]} numberOfLines={1}>
                        {e.name}
                      </Text>
                      <Text style={[styles.foodMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
                        {e.time}{e.portion ? ` · ${e.portion}` : ""}
                      </Text>
                    </View>
                    <View style={styles.foodRight}>
                      <Text style={[styles.foodCal, { color: colors.primary }]}>
                        {e.cal} kkal
                      </Text>
                      <Text style={[styles.foodMacros, { color: colors.mutedForeground }]}>
                        B{e.protein}·U{e.carbs}·Y{e.fat}
                      </Text>
                    </View>
                  </View>
                ))}
              </>
            )}
          </View>
        )}

        <View style={[styles.toggleWrap, { backgroundColor: colors.secondary }]}>
          {(["week", "month"] as Range[]).map((r) => (
            <Pressable
              key={r}
              onPress={() => setRange(r)}
              style={({ pressed }) => [
                styles.toggleBtn,
                {
                  backgroundColor: range === r ? colors.card : "transparent",
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.toggleText,
                  { color: range === r ? colors.primary : colors.mutedForeground },
                ]}
              >
                {r === "week" ? "7 kun" : "30 kun"}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.summaryGrid}>
          <SummaryCard
            colors={colors}
            icon="zap"
            label="O'rtacha kun/kkal"
            value={`${avgCal}`}
            sub={`Maqsad: ${goal}`}
            tint={colors.primary}
          />
          <SummaryCard
            colors={colors}
            icon="check-circle"
            label="Maqsadda kun"
            value={`${daysHitGoal}`}
            sub={`${days} kundan`}
            tint="#16A34A"
          />
          <SummaryCard
            colors={colors}
            icon="alert-circle"
            label="Oshib ketgan"
            value={`${daysOverGoal}`}
            sub={`${days} kundan`}
            tint={colors.destructive}
          />
          <SummaryCard
            colors={colors}
            icon="trending-up"
            label="Faol kunlar"
            value={`${activeBuckets.length}`}
            sub={`Davomli: ${streak}`}
            tint={colors.accent}
          />
        </View>

        <View
          style={[
            styles.chartCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.chartHead}>
            <Text style={[styles.chartTitle, { color: colors.text }]}>
              Kunlik kaloriya
            </Text>
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
                <Text style={[styles.legendText, { color: colors.mutedForeground }]}>
                  Norma
                </Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.destructive }]} />
                <Text style={[styles.legendText, { color: colors.mutedForeground }]}>
                  Oshgan
                </Text>
              </View>
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chartScroll}
          >
            <View style={styles.chartArea}>
              <View
                style={[
                  styles.goalLine,
                  {
                    bottom: 24 + (goal / maxBar) * 140,
                    borderColor: colors.primary,
                  },
                ]}
              >
                <Text style={[styles.goalLabel, { color: colors.primary, backgroundColor: colors.card }]}>
                  {goal}
                </Text>
              </View>
              <View style={styles.barsRow}>
                {buckets.map((b) => {
                  const h = Math.max(2, (b.cal / maxBar) * 140);
                  const isOver = b.cal > goal;
                  const isEmpty = b.count === 0;
                  const barColor = isEmpty
                    ? colors.border
                    : isOver
                      ? colors.destructive
                      : colors.primary;
                  return (
                    <View
                      key={b.date}
                      accessible
                      accessibilityRole="image"
                      accessibilityLabel={
                        b.count === 0
                          ? `${b.label}: ovqat yo'q`
                          : `${b.label}: ${b.cal} kaloriya, ${b.count} yozuv${
                              isOver ? ", normadan oshgan" : ""
                            }`
                      }
                      style={[
                        styles.barCol,
                        { width: range === "week" ? 36 : 18 },
                      ]}
                    >
                      <Text
                        style={[
                          styles.barValue,
                          { color: colors.mutedForeground, opacity: isEmpty ? 0 : 1 },
                        ]}
                        numberOfLines={1}
                      >
                        {b.cal > 999 ? `${Math.round(b.cal / 100) / 10}k` : b.cal}
                      </Text>
                      <View
                        style={[
                          styles.bar,
                          {
                            height: h,
                            backgroundColor: barColor,
                            opacity: isEmpty ? 0.3 : 1,
                          },
                        ]}
                      />
                      <Text
                        style={[
                          styles.barLabel,
                          { color: colors.mutedForeground, fontSize: range === "week" ? 11 : 9 },
                        ]}
                        numberOfLines={1}
                      >
                        {b.short}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </ScrollView>
        </View>

        <View
          style={[
            styles.macroCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.chartTitle, { color: colors.text, marginBottom: 12 }]}>
            O'rtacha makro moddalar
          </Text>
          <MacroRow
            colors={colors}
            label="Oqsil"
            value={avgProtein}
            unit="g"
            color={colors.chartRed}
          />
          <MacroRow
            colors={colors}
            label="Uglevod"
            value={avgCarbs}
            unit="g"
            color={colors.accent}
          />
          <MacroRow
            colors={colors}
            label="Yog'"
            value={avgFat}
            unit="g"
            color="#3B82F6"
          />
        </View>

        <View
          style={[
            styles.summaryRow,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <SummaryItem
            colors={colors}
            label="Jami yozuv"
            value={`${totalEntries}`}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <SummaryItem
            colors={colors}
            label="Jami kkal"
            value={`${totalCal.toLocaleString("uz-UZ")}`}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <SummaryItem
            colors={colors}
            label="Past kkal"
            value={`${daysUnderGoal} kun`}
          />
        </View>

        {totalEntries === 0 ? (
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: colors.secondary, borderColor: colors.border },
            ]}
          >
            <MaterialCommunityIcons
              name="chart-line"
              size={32}
              color={colors.mutedForeground}
            />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              Statistika hali bo'sh
            </Text>
            <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
              Bir nechta ovqat qo'shing — bu yerda haftalik va oylik tahlilingiz paydo bo'ladi.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function SummaryCard({
  colors,
  icon,
  label,
  value,
  sub,
  tint,
}: {
  colors: ReturnType<typeof useColors>;
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
  sub: string;
  tint: string;
}) {
  return (
    <View
      accessible
      accessibilityRole="summary"
      accessibilityLabel={`${label}: ${value}. ${sub}`}
      style={[
        styles.sumCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={[styles.sumIcon, { backgroundColor: tint + "18" }]}>
        <Feather name={icon} size={16} color={tint} />
      </View>
      <Text style={[styles.sumValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.sumLabel, { color: colors.mutedForeground }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.sumSub, { color: colors.mutedForeground }]} numberOfLines={1}>
        {sub}
      </Text>
    </View>
  );
}

function MacroRow({
  colors,
  label,
  value,
  unit,
  color,
}: {
  colors: ReturnType<typeof useColors>;
  label: string;
  value: number;
  unit: string;
  color: string;
}) {
  return (
    <View style={styles.macroRow}>
      <View style={[styles.macroDot, { backgroundColor: color }]} />
      <Text style={[styles.macroLabel, { color: colors.text }]}>{label}</Text>
      <Text style={[styles.macroValue, { color: colors.text }]}>
        {value}
        <Text style={[styles.macroUnit, { color: colors.mutedForeground }]}>{unit}</Text>
      </Text>
    </View>
  );
}

function SummaryItem({
  colors,
  label,
  value,
}: {
  colors: ReturnType<typeof useColors>;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.sumItem}>
      <Text style={[styles.sumItemValue, { color: colors.text }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.sumItemLabel, { color: colors.mutedForeground }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
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
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  content: { padding: 16, gap: 16 },

  todayBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  todayBtnText: { flex: 1, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  todayCalBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  todayCalBadgeText: { fontSize: 12, fontFamily: "Inter_700Bold" },

  todayFoodsCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  todayEmpty: {
    alignItems: "center",
    gap: 8,
    padding: 24,
  },
  todayEmptyText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  addFoodBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 4,
  },
  addFoodBtnText: { color: "#FFFFFF", fontSize: 14, fontFamily: "Inter_600SemiBold" },

  todayFoodsSummary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#0001",
  },
  todayFoodsSummaryText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  todayFoodsSummaryBold: { fontFamily: "Inter_700Bold" },
  addMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  addMoreText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  foodRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  foodIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  foodThumb: { width: 40, height: 40 },
  foodEmoji: { fontSize: 20 },
  foodName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  foodMeta: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  foodRight: { alignItems: "flex-end", gap: 2 },
  foodCal: { fontSize: 14, fontFamily: "Inter_700Bold" },
  foodMacros: { fontSize: 10, fontFamily: "Inter_500Medium" },

  toggleWrap: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 4,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 9,
  },
  toggleText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  sumCard: {
    flexBasis: "47%",
    flexGrow: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 4,
  },
  sumIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  sumValue: { fontSize: 22, fontFamily: "Inter_700Bold" },
  sumLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  sumSub: { fontSize: 11, fontFamily: "Inter_400Regular" },
  chartCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  chartHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  chartTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  legendRow: { flexDirection: "row", gap: 10 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  chartScroll: { paddingTop: 8 },
  chartArea: {
    height: 200,
    position: "relative",
    paddingTop: 18,
  },
  goalLine: {
    position: "absolute",
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderStyle: "dashed",
    height: 1,
    zIndex: 1,
  },
  goalLabel: {
    position: "absolute",
    right: 0,
    top: -8,
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    paddingHorizontal: 4,
  },
  barsRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
    height: 180,
  },
  barCol: {
    alignItems: "center",
    justifyContent: "flex-end",
    height: "100%",
    gap: 4,
  },
  barValue: { fontSize: 10, fontFamily: "Inter_500Medium" },
  bar: { width: "70%", borderRadius: 6, minHeight: 2 },
  barLabel: { fontFamily: "Inter_500Medium" },
  macroCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  macroRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    gap: 10,
  },
  macroDot: { width: 10, height: 10, borderRadius: 5 },
  macroLabel: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium" },
  macroValue: { fontSize: 16, fontFamily: "Inter_700Bold" },
  macroUnit: { fontSize: 12, fontFamily: "Inter_400Regular" },
  summaryRow: {
    flexDirection: "row",
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    alignItems: "center",
  },
  sumItem: { flex: 1, alignItems: "center", gap: 2 },
  sumItemValue: { fontSize: 16, fontFamily: "Inter_700Bold" },
  sumItemLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },
  divider: { width: 1, height: 32 },
  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    alignItems: "center",
    gap: 6,
  },
  emptyTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  emptySub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
});
