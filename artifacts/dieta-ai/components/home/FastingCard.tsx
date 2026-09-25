import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTracker } from "@/context/TrackerContext";
import { useColors } from "@/hooks/useColors";
import { confirmAction } from "@/lib/confirm";
import { cancelOneOff, scheduleOneOff } from "@/lib/notifications";

const PRESETS = [
  { hours: 12, label: "12:12", desc: "Boshlovchi" },
  { hours: 14, label: "14:10", desc: "Yengil" },
  { hours: 16, label: "16:8", desc: "Ommabop" },
  { hours: 18, label: "18:6", desc: "Qattiq" },
];
const FAST = "#7C3AED";
const HOUR = 3600_000;

function hms(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}

function clock(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Intermittent fasting: pick a window, start, watch the timer, get notified at the end. */
export function FastingCard() {
  const colors = useColors();
  const { fasting, startFast, endFast, setFastTarget } = useTracker();
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const active = fasting.startedAt != null;

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);

  const begin = () => {
    const start = Date.now();
    setNow(start);
    startFast();
    setOpen(false);
    scheduleOneOff(
      "fast-end",
      new Date(start + fasting.targetHours * HOUR),
      "🎉 Ochlik yakunlandi!",
      `${fasting.targetHours} soatlik ochlikni bajardingiz. Endi ovqatlanish oynasi ochiq.`,
    ).catch(() => {});
  };

  const finish = async () => {
    const elapsed = now - (fasting.startedAt ?? now);
    if (elapsed < fasting.targetHours * HOUR) {
      const ok = await confirmAction({
        title: "Ochlikni tugatish",
        message: `Maqsadga hali ${hms(fasting.targetHours * HOUR - elapsed)} qoldi. Baribir tugatasizmi?`,
        confirmText: "Tugatish",
      });
      if (!ok) return;
    }
    endFast();
    cancelOneOff("fast-end").catch(() => {});
  };

  const last = fasting.history[0];

  if (!active) {
    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Pressable onPress={() => setOpen((o) => !o)} style={styles.head} accessibilityRole="button">
          <View style={[styles.icon, { backgroundColor: "#EDE9FE" }]}>
            <MaterialCommunityIcons name="timer-sand" size={20} color={FAST} />
          </View>
          <View style={styles.flex1}>
            <Text style={[styles.title, { color: colors.text }]}>Intervalli ochlik</Text>
            <Text style={[styles.sub, { color: colors.mutedForeground }]}>
              {last
                ? `Oxirgisi: ${((last.end - last.start) / HOUR).toFixed(1)} soat ${
                    last.end - last.start >= last.targetHours * HOUR ? "✅" : ""
                  }`
                : `${fasting.targetHours} soatlik ochlikni boshlang`}
            </Text>
          </View>
          <Feather name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.mutedForeground} />
        </Pressable>
        {open ? (
          <>
            <View style={styles.presets}>
              {PRESETS.map((p) => {
                const on = p.hours === fasting.targetHours;
                return (
                  <Pressable
                    key={p.hours}
                    onPress={() => setFastTarget(p.hours)}
                    style={[
                      styles.preset,
                      { backgroundColor: on ? FAST : colors.background, borderColor: on ? FAST : colors.border },
                    ]}
                  >
                    <Text style={[styles.presetLabel, { color: on ? "#FFFFFF" : colors.text }]}>{p.label}</Text>
                    <Text style={[styles.presetDesc, { color: on ? "#EDE9FE" : colors.mutedForeground }]}>{p.desc}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              Oxirgi ovqatdan keyin boshlang. Ochlik vaqtida suv, shakarsiz choy va qahva mumkin. Homiladorlik, qandli
              diabet yoki boshqa kasalliklarda avval shifokor bilan maslahatlashing.
            </Text>
            <Pressable
              onPress={begin}
              style={({ pressed }) => [styles.primary, { backgroundColor: FAST, opacity: pressed ? 0.85 : 1 }]}
            >
              <Feather name="play" size={16} color="#FFFFFF" />
              <Text style={styles.primaryText}>{fasting.targetHours} soatlik ochlikni boshlash</Text>
            </Pressable>
          </>
        ) : null}
      </View>
    );
  }

  const start = fasting.startedAt!;
  const target = fasting.targetHours * HOUR;
  const elapsed = now - start;
  const pct = Math.min(1, elapsed / target);
  const done = elapsed >= target;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: FAST }]}>
      <View style={styles.head}>
        <View style={[styles.icon, { backgroundColor: done ? "#DCFCE7" : "#EDE9FE" }]}>
          <MaterialCommunityIcons name={done ? "check-bold" : "timer-sand"} size={20} color={done ? "#16A34A" : FAST} />
        </View>
        <View style={styles.flex1}>
          <Text style={[styles.timer, { color: done ? "#16A34A" : FAST }]}>{hms(elapsed)}</Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>
            {done
              ? `${fasting.targetHours} soatlik maqsad bajarildi — ovqatlanishingiz mumkin`
              : `${clock(start)} da boshlandi · ${clock(start + target)} da tugaydi · ${Math.round(pct * 100)}%`}
          </Text>
        </View>
      </View>
      <View style={[styles.track, { backgroundColor: "#EDE9FE" }]}>
        <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: done ? "#16A34A" : FAST }]} />
      </View>
      <Pressable
        onPress={finish}
        style={({ pressed }) => [
          styles.primary,
          done ? { backgroundColor: "#16A34A" } : { backgroundColor: colors.background, borderWidth: 1.5, borderColor: FAST },
          { opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Feather name="square" size={14} color={done ? "#FFFFFF" : FAST} />
        <Text style={[styles.primaryText, !done && { color: FAST }]}>Ochlikni tugatish</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  card: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 10, marginBottom: 12 },
  head: { flexDirection: "row", alignItems: "center", gap: 10 },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 15, fontFamily: "Inter_700Bold" },
  sub: { fontSize: 12.5, fontFamily: "Inter_500Medium", marginTop: 1 },
  timer: { fontSize: 22, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  presets: { flexDirection: "row", gap: 6 },
  preset: { flex: 1, alignItems: "center", borderWidth: 1, borderRadius: 12, paddingVertical: 8 },
  presetLabel: { fontSize: 14, fontFamily: "Inter_700Bold" },
  presetDesc: { fontSize: 10.5, fontFamily: "Inter_500Medium", marginTop: 1 },
  hint: { fontSize: 11.5, fontFamily: "Inter_400Regular", lineHeight: 16 },
  track: { height: 8, borderRadius: 4, overflow: "hidden" },
  fill: { height: 8, borderRadius: 4 },
  primary: { flexDirection: "row", height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", gap: 8 },
  primaryText: { color: "#FFFFFF", fontSize: 14, fontFamily: "Inter_700Bold" },
});
