import { router } from "expo-router";
import React, { useMemo } from "react";
import { Feather } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { BodyAvatar } from "@/components/BodyAvatar";
import { OnboardingLayout } from "@/components/OnboardingLayout";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { calculatePlan, formatUzDate } from "@/lib/nutrition";

function formatDuration(days: number): string {
  if (days <= 0) return "0 kun";
  if (days < 14) return `${days} kun`;
  const weeks = Math.round(days / 7);
  if (weeks < 8) return `${weeks} hafta`;
  const months = Math.round(days / 30);
  return `${months} oy`;
}

export default function TransformationScreen() {
  const colors = useColors();
  const { profile } = useApp();
  const gender = profile.gender ?? "erkak";
  const goal = profile.goal ?? "ozish";
  const isMaintain = goal === "saqlash";

  const plan = useMemo(() => calculatePlan(profile), [profile]);

  const beforeWeight = profile.currentWeight ?? 75;
  const afterWeight = isMaintain ? beforeWeight : (profile.targetWeight ?? 70);

  const totalDays = isMaintain ? 30 : plan.weeksToGoal * 7;
  const totalLabel = isMaintain ? "30 kun" : formatDuration(totalDays);

  // Build a realistic 3-step timeline scaled to total duration
  const milestone1 = Math.max(3, Math.round(totalDays * 0.1));
  const milestone2 = Math.max(milestone1 + 4, Math.round(totalDays * 0.4));
  const milestone3 = Math.max(milestone2 + 1, totalDays);

  const beforeLabel = isMaintain ? "Hozir" : "Bugun";
  const afterLabel = isMaintain ? "30 kun keyin" : "Maqsad";

  const speed = profile.speedKgPerWeek ?? 0.5;
  const title = isMaintain
    ? "Sog'lom vazningizni saqlash uchun ajoyib reja"
    : "Sizda maqsadingizga erishish uchun ajoyib salohiyat bor";

  const infoText = isMaintain
    ? "Sizning vazningiz ideal! Bir Burda sizga sog'lom ovqatlanish odatlarini saqlab qolish va energiyangizni yuqori darajada ushlab turishda yordam beradi."
    : `Sizning ${speed.toFixed(1)} kg/hafta sur'atingizda Bir Burda tarixiy ma'lumotlariga ko'ra, dastlabki natijalar 7-10 kunda ko'rinadi va ${totalLabel} ichida to'liq maqsadga erishasiz.`;

  return (
    <OnboardingLayout
      step={14}
      total={18}
      title={title}
      onNext={() => router.push("/onboarding/meals")}
      onBack={() => router.back()}
    >
      <View style={styles.bodyWrap}>
        <View style={styles.bodiesRow}>
          <View style={styles.bodyCol}>
            <View style={[styles.bodyCard, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <BodyAvatar variant="before" gender={gender} goal={goal} width={110} height={200} />
            </View>
            <Text style={[styles.bodyLabel, { color: colors.mutedForeground }]}>{beforeLabel}</Text>
            <Text style={[styles.bodyWeight, { color: colors.text }]}>{beforeWeight} kg</Text>
          </View>

          <View style={styles.arrowCol}>
            <View style={[styles.arrowCircle, { backgroundColor: colors.primary }]}>
              <Feather name={isMaintain ? "check" : "arrow-right"} size={22} color={colors.primaryForeground} />
            </View>
            <Text style={[styles.arrowLabel, { color: colors.primary }]} numberOfLines={1}>
              {isMaintain ? "Saqlash" : totalLabel}
            </Text>
            {!isMaintain && (
              <Text style={[styles.arrowSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                {formatUzDate(plan.goalDate)}
              </Text>
            )}
          </View>

          <View style={styles.bodyCol}>
            <View style={[styles.bodyCard, { backgroundColor: colors.secondary, borderColor: colors.primary }]}>
              <BodyAvatar variant="after" gender={gender} goal={goal} width={110} height={200} />
            </View>
            <Text style={[styles.bodyLabel, { color: colors.primary }]}>{afterLabel}</Text>
            <Text style={[styles.bodyWeight, { color: colors.text }]}>{afterWeight} kg</Text>
          </View>
        </View>

        <View style={styles.timeline}>
          <View style={styles.timeStep}>
            <View style={[styles.timeDot, { backgroundColor: colors.primary }]} />
            <Text style={[styles.timeLabel, { color: colors.text }]}>{milestone1} kun</Text>
            <Text style={[styles.timeNote, { color: colors.mutedForeground }]}>Boshlash</Text>
          </View>
          <View style={[styles.timeLine, { backgroundColor: colors.border }]} />
          <View style={styles.timeStep}>
            <View style={[styles.timeDot, { backgroundColor: colors.primary }]} />
            <Text style={[styles.timeLabel, { color: colors.text }]}>{milestone2} kun</Text>
            <Text style={[styles.timeNote, { color: colors.mutedForeground }]}>Odat</Text>
          </View>
          <View style={[styles.timeLine, { backgroundColor: colors.border }]} />
          <View style={styles.timeStep}>
            <View style={[styles.timeDot, { backgroundColor: colors.accent }]} />
            <Text style={[styles.timeLabel, { color: colors.text }]}>{milestone3} kun</Text>
            <Text style={[styles.timeNote, { color: colors.mutedForeground }]}>Natija</Text>
          </View>
        </View>
      </View>

      <View style={[styles.infoCard, { backgroundColor: colors.secondary }]}>
        <Text style={[styles.infoText, { color: colors.text }]}>{infoText}</Text>
      </View>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  bodyWrap: { alignItems: "center", marginVertical: 12 },
  bodiesRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 16 },
  bodyCol: { alignItems: "center", gap: 4 },
  bodyCard: {
    width: 120,
    height: 210,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  bodyLabel: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 6 },
  bodyWeight: { fontSize: 16, fontFamily: "Inter_700Bold" },
  arrowCol: { alignItems: "center", gap: 4, maxWidth: 90 },
  arrowCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  arrowLabel: { fontSize: 12, fontFamily: "Inter_700Bold" },
  arrowSub: { fontSize: 9, fontFamily: "Inter_500Medium", textAlign: "center" },
  timeline: {
    flexDirection: "row",
    alignItems: "center",
    width: "92%",
    marginTop: 16,
  },
  timeStep: { alignItems: "center", gap: 4 },
  timeDot: { width: 12, height: 12, borderRadius: 6 },
  timeLabel: { fontSize: 12, fontFamily: "Inter_700Bold" },
  timeNote: { fontSize: 10, fontFamily: "Inter_400Regular" },
  timeLine: { flex: 1, height: 2, marginHorizontal: 4, marginBottom: 22 },
  infoCard: { borderRadius: 14, padding: 16, marginTop: 8 },
  infoText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
});
