import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { OnboardingLayout } from "@/components/OnboardingLayout";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

const ITEM_H = 44;
const VISIBLE = 5;
const MONTHS = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
];
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 80 }, (_, i) => currentYear - 5 - i);

interface WheelProps {
  data: (string | number)[];
  initialIndex: number;
  onSelect: (index: number) => void;
  width: number;
}

function Wheel({ data, initialIndex, onSelect, width }: WheelProps) {
  const colors = useColors();
  const ref = useRef<ScrollView>(null);
  const [selected, setSelected] = useState(initialIndex);

  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTo({ y: initialIndex * ITEM_H, animated: false });
    }
  }, []);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const idx = Math.max(0, Math.min(data.length - 1, Math.round(y / ITEM_H)));
    if (idx !== selected) {
      setSelected(idx);
      onSelect(idx);
    }
  };

  return (
    <View style={[styles.wheel, { width }]}>
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingVertical: ITEM_H * 2 }}
      >
        {data.map((item, i) => {
          const isSelected = i === selected;
          return (
            <View key={i} style={styles.wheelItem}>
              <Text
                style={[
                  styles.wheelText,
                  {
                    color: isSelected ? colors.text : colors.mutedForeground,
                    fontSize: isSelected ? 19 : 15,
                    fontFamily: isSelected ? "Inter_700Bold" : "Inter_400Regular",
                    opacity: isSelected ? 1 : 0.5,
                  },
                ]}
              >
                {item}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default function BirthdateScreen() {
  const { profile, setProfile } = useApp();
  const colors = useColors();
  const initialMonth = profile.birthDate?.month ?? 5;
  const initialDay = (profile.birthDate?.day ?? 15) - 1;
  const initialYearIdx = YEARS.indexOf(profile.birthDate?.year ?? 2000);

  const [month, setMonth] = useState(initialMonth);
  const [day, setDay] = useState(initialDay);
  const [yearIdx, setYearIdx] = useState(initialYearIdx >= 0 ? initialYearIdx : 25);

  const handleNext = () => {
    setProfile({
      birthDate: {
        month,
        day: day + 1,
        year: YEARS[yearIdx] ?? 2000,
      },
    });
    router.push("/onboarding/height");
  };

  return (
    <OnboardingLayout
      step={5}
      total={18}
      title="Tug'ilgan sanani kiriting"
      subtitle="Bu sizga shaxsiy kundalik reja yaratish uchun kerak"
      onNext={handleNext}
      onBack={() => router.back()}
    >
      <View style={styles.wheelsWrap}>
        <View
          pointerEvents="none"
          style={[
            styles.highlight,
            { borderColor: colors.primary, backgroundColor: colors.secondary },
          ]}
        />
        <View style={styles.wheelsRow}>
          <Wheel data={MONTHS} initialIndex={initialMonth} onSelect={setMonth} width={130} />
          <Wheel
            data={DAYS}
            initialIndex={initialDay}
            onSelect={setDay}
            width={70}
          />
          <Wheel
            data={YEARS}
            initialIndex={initialYearIdx >= 0 ? initialYearIdx : 25}
            onSelect={setYearIdx}
            width={90}
          />
        </View>
      </View>
      <Text style={[styles.hint, { color: colors.mutedForeground }]}>↕ surib tanlang</Text>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  wheelsWrap: {
    height: ITEM_H * VISIBLE,
    marginTop: 16,
    position: "relative",
    justifyContent: "center",
  },
  highlight: {
    position: "absolute",
    top: ITEM_H * 2,
    left: 8,
    right: 8,
    height: ITEM_H,
    borderRadius: 12,
    borderWidth: 1.5,
    zIndex: 0,
  },
  wheelsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    zIndex: 1,
  },
  wheel: { height: ITEM_H * VISIBLE, overflow: "hidden" },
  wheelItem: { height: ITEM_H, alignItems: "center", justifyContent: "center" },
  wheelText: { textAlign: "center" },
  hint: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 16 },
});
