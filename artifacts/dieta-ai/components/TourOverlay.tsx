import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  Dimensions,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

const { width: SW, height: SH } = Dimensions.get("window");
const PAD = 10;
const OVERLAY = "rgba(0,0,0,0.78)";

export interface TourStep {
  ref: React.RefObject<View | null>;
  title: string;
  description: string;
}

interface TourOverlayProps {
  steps: TourStep[];
  visible: boolean;
  onFinish: () => void;
  primaryColor: string;
  textColor: string;
  cardBg: string;
  mutedColor: string;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function TourOverlay({
  steps,
  visible,
  onFinish,
  primaryColor,
  textColor,
  cardBg,
  mutedColor,
}: TourOverlayProps) {
  const [stepIdx, setStepIdx] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const measureTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const measureCurrent = (idx: number) => {
    if (measureTimer.current) clearTimeout(measureTimer.current);
    measureTimer.current = setTimeout(() => {
      const step = steps[idx];
      if (!step?.ref?.current) {
        setRect(null);
        return;
      }
      step.ref.current.measureInWindow((x, y, w, h) => {
        setRect({ x, y, w, h });
      });
    }, Platform.OS === "android" ? 160 : 80);
  };

  useEffect(() => {
    if (!visible) {
      setStepIdx(0);
      setRect(null);
      return;
    }
    measureCurrent(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    measureCurrent(stepIdx);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIdx]);

  useEffect(() => {
    return () => {
      if (measureTimer.current) clearTimeout(measureTimer.current);
    };
  }, []);

  if (!visible || steps.length === 0) return null;

  const step = steps[stepIdx];
  const isLast = stepIdx >= steps.length - 1;

  const goNext = () => {
    if (isLast) {
      onFinish();
    } else {
      setStepIdx((s) => s + 1);
    }
  };

  const tooltipAbove = rect ? rect.y + rect.h > SH * 0.55 : false;
  const tooltipTop = rect
    ? tooltipAbove
      ? undefined
      : rect.y + rect.h + PAD + 12
    : SH * 0.35;
  const tooltipBottom = rect && tooltipAbove
    ? SH - rect.y + PAD + 12
    : undefined;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onFinish}
      statusBarTranslucent
    >
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {rect ? (
          <>
            <View style={[styles.dim, { top: 0, left: 0, right: 0, height: Math.max(0, rect.y - PAD) }]} />
            <View style={[styles.dim, { top: rect.y + rect.h + PAD, left: 0, right: 0, bottom: 0 }]} />
            <View style={[styles.dim, { top: rect.y - PAD, left: 0, width: Math.max(0, rect.x - PAD), height: rect.h + PAD * 2 }]} />
            <View style={[styles.dim, { top: rect.y - PAD, left: rect.x + rect.w + PAD, right: 0, height: rect.h + PAD * 2 }]} />
            <View
              style={[
                styles.spotBorder,
                {
                  top: rect.y - PAD,
                  left: rect.x - PAD,
                  width: rect.w + PAD * 2,
                  height: rect.h + PAD * 2,
                  borderColor: primaryColor,
                },
              ]}
            />
          </>
        ) : (
          <View style={[styles.dim, StyleSheet.absoluteFill]} />
        )}

        <View
          style={[
            styles.tooltip,
            { backgroundColor: cardBg },
            tooltipTop !== undefined ? { top: tooltipTop } : {},
            tooltipBottom !== undefined ? { bottom: tooltipBottom } : {},
          ]}
        >
          <View style={styles.tooltipHeader}>
            <View style={[styles.stepDots]}>
              {steps.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    {
                      backgroundColor: i === stepIdx ? primaryColor : primaryColor + "30",
                      width: i === stepIdx ? 18 : 6,
                    },
                  ]}
                />
              ))}
            </View>
            <Pressable
              onPress={onFinish}
              hitSlop={8}
              style={({ pressed }) => [styles.closeBtn, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Feather name="x" size={18} color={mutedColor} />
            </Pressable>
          </View>

          <Text style={[styles.title, { color: primaryColor }]}>{step.title}</Text>
          <Text style={[styles.desc, { color: textColor }]}>{step.description}</Text>

          <View style={styles.footer}>
            <Text style={[styles.counter, { color: mutedColor }]}>
              {stepIdx + 1} / {steps.length}
            </Text>
            <Pressable
              onPress={goNext}
              style={({ pressed }) => [
                styles.nextBtn,
                { backgroundColor: primaryColor, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={styles.nextBtnText}>
                {isLast ? "Tamom" : "Keyingi"}
              </Text>
              <Feather
                name={isLast ? "check" : "arrow-right"}
                size={16}
                color="#FFFFFF"
              />
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dim: {
    position: "absolute",
    backgroundColor: OVERLAY,
  },
  spotBorder: {
    position: "absolute",
    borderRadius: 14,
    borderWidth: 2.5,
  },
  tooltip: {
    position: "absolute",
    left: 16,
    right: 16,
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 20,
    gap: 10,
  },
  tooltipHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stepDots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  closeBtn: {
    padding: 4,
  },
  title: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
  },
  desc: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  counter: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 14,
  },
  nextBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
});
