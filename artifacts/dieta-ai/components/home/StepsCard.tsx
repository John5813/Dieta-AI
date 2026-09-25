import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { Pedometer } from "expo-sensors";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { NumberSheet } from "@/components/profile/ProfileSheets";
import { useTracker } from "@/context/TrackerContext";
import { useColors } from "@/hooks/useColors";

const STEP_GOAL = 10000;
const STEPS = "#F97316";

type SensorState = "checking" | "ready" | "needs-permission" | "unavailable";

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Today's steps: read from the phone's step history on iOS, counted live
 * while the app is open on Android (no history API there without Health
 * Connect), and always editable by hand.
 */
export function StepsCard({ dateKey, isToday, weightKg }: { dateKey: string; isToday: boolean; weightKg: number }) {
  const colors = useColors();
  const { stepsByDate, setSteps } = useTracker();
  const [sensor, setSensor] = useState<SensorState>("checking");
  const [editOpen, setEditOpen] = useState(false);
  const steps = stepsByDate[dateKey] ?? 0;
  const stepsRef = useRef(steps);
  stepsRef.current = steps;

  useEffect(() => {
    if (Platform.OS === "web") {
      setSensor("unavailable");
      return;
    }
    (async () => {
      try {
        if (!(await Pedometer.isAvailableAsync())) return setSensor("unavailable");
        const perm = await Pedometer.getPermissionsAsync();
        setSensor(perm.granted ? "ready" : "needs-permission");
      } catch {
        setSensor("unavailable");
      }
    })();
  }, []);

  const connect = async () => {
    try {
      const perm = await Pedometer.requestPermissionsAsync();
      setSensor(perm.granted ? "ready" : "needs-permission");
    } catch {
      setSensor("unavailable");
    }
  };

  // iOS keeps a week of step history — refresh today's total on focus and every minute.
  useFocusEffect(
    useCallback(() => {
      if (!isToday || sensor !== "ready" || Platform.OS !== "ios") return;
      const pull = () =>
        Pedometer.getStepCountAsync(startOfToday(), new Date())
          .then((r) => setSteps(Math.max(r.steps, stepsRef.current)))
          .catch(() => {});
      pull();
      const t = setInterval(pull, 60_000);
      return () => clearInterval(t);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isToday, sensor]),
  );

  // Android only reports steps while subscribed; add them on top of what is saved.
  useEffect(() => {
    if (!isToday || sensor !== "ready" || Platform.OS !== "android") return;
    const base = stepsRef.current;
    const sub = Pedometer.watchStepCount((r) => setSteps(base + r.steps));
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isToday, sensor, dateKey]);

  const kcal = Math.round(steps * 0.04 * (weightKg / 70));
  const km = (steps * 0.75) / 1000;
  const pct = Math.min(1, steps / STEP_GOAL);

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.head}>
        <View style={[styles.icon, { backgroundColor: "#FFEDD5" }]}>
          <MaterialCommunityIcons name="walk" size={20} color={STEPS} />
        </View>
        <Pressable onPress={() => setEditOpen(true)} style={styles.flex1} accessibilityLabel="Qadamlarni kiritish">
          <Text style={[styles.title, { color: colors.text }]}>
            {steps.toLocaleString("ru-RU")} <Text style={[styles.goal, { color: colors.mutedForeground }]}>/ {STEP_GOAL.toLocaleString("ru-RU")} qadam</Text>
          </Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>
            ~{kcal} kkal · {km.toFixed(1)} km
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setEditOpen(true)}
          hitSlop={8}
          accessibilityLabel="Qadamlarni tahrirlash"
          style={[styles.editBtn, { borderColor: colors.border }]}
        >
          <Feather name="edit-2" size={15} color={colors.mutedForeground} />
        </Pressable>
      </View>
      <View style={[styles.track, { backgroundColor: "#FFEDD5" }]}>
        <View style={[styles.fill, { width: `${pct * 100}%` }]} />
      </View>
      {isToday && sensor === "needs-permission" ? (
        <Pressable onPress={connect} style={[styles.connect, { borderColor: STEPS }]}>
          <Feather name="link" size={14} color={STEPS} />
          <Text style={[styles.connectText, { color: STEPS }]}>Qadam hisoblagichni ulash</Text>
        </Pressable>
      ) : isToday && sensor === "ready" && Platform.OS === "android" ? (
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          Android'da qadamlar ilova ochiq turganda sanaladi — telefoningizdagi Fit ilovasidagi sonni ✏️ orqali kiritsangiz
          ham bo'ladi.
        </Text>
      ) : null}

      <NumberSheet
        visible={editOpen}
        onClose={() => setEditOpen(false)}
        icon="activity"
        title="Qadamlar"
        desc="Telefon yoki soatingizdagi bugungi qadamlar sonini kiriting."
        unit="qadam"
        min={0}
        max={100000}
        integer
        initial={steps || undefined}
        onSave={(v) => {
          setSteps(v, dateKey);
          setEditOpen(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  card: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 10, marginBottom: 12 },
  head: { flexDirection: "row", alignItems: "center", gap: 10 },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 16, fontFamily: "Inter_700Bold" },
  goal: { fontSize: 12.5, fontFamily: "Inter_500Medium" },
  sub: { fontSize: 12.5, fontFamily: "Inter_500Medium", marginTop: 1 },
  editBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  track: { height: 6, borderRadius: 3, overflow: "hidden" },
  fill: { height: 6, borderRadius: 3, backgroundColor: STEPS },
  connect: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 9,
  },
  connectText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  hint: { fontSize: 11.5, fontFamily: "Inter_400Regular", lineHeight: 16 },
});
