import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

interface SelectionCardProps {
  label: string;
  sublabel?: string;
  icon?: string;
  selected: boolean;
  onPress: () => void;
  multi?: boolean;
}

export function SelectionCard({ label, sublabel, icon, selected, onPress, multi }: SelectionCardProps) {
  const colors = useColors();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: selected ? colors.primary : colors.card,
          borderColor: selected ? colors.primary : colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      {icon ? (
        <Feather
          name={icon as keyof typeof Feather.glyphMap}
          size={20}
          color={selected ? colors.primaryForeground : colors.mutedForeground}
          style={styles.icon}
        />
      ) : null}
      <View style={styles.labelWrap}>
        <Text
          style={[
            styles.label,
            { color: selected ? colors.primaryForeground : colors.text },
          ]}
        >
          {label}
        </Text>
        {sublabel ? (
          <Text style={[styles.sublabel, { color: selected ? colors.primaryForeground + "CC" : colors.mutedForeground }]}>
            {sublabel}
          </Text>
        ) : null}
      </View>
      {selected && !multi ? (
        <Feather name="check" size={18} color={colors.primaryForeground} />
      ) : null}
      {multi && selected ? (
        <View style={[styles.checkbox, { backgroundColor: colors.accent }]}>
          <Feather name="check" size={14} color="#fff" />
        </View>
      ) : multi ? (
        <View style={[styles.checkbox, { borderColor: colors.border, borderWidth: 1.5 }]} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    marginBottom: 10,
  },
  icon: { marginRight: 12 },
  labelWrap: { flex: 1 },
  label: {
    fontSize: 16,
    fontFamily: "Inter_500Medium",
  },
  sublabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
});
