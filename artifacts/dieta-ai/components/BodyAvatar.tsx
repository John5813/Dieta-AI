import React from "react";
import { Image, ImageSourcePropType, StyleSheet, View } from "react-native";

const SOURCES: Record<string, ImageSourcePropType> = {
  male_chubby: require("../assets/images/male_before.webp"),
  male_fit: require("../assets/images/male_after.webp"),
  male_skinny: require("../assets/images/male_skinny.webp"),
  male_muscular: require("../assets/images/male_muscular.webp"),
  female_chubby: require("../assets/images/female_before.webp"),
  female_fit: require("../assets/images/female_after.webp"),
  female_skinny: require("../assets/images/female_skinny.webp"),
  female_toned: require("../assets/images/female_fit.webp"),
};

type Goal = "ozish" | "oshirish" | "saqlash";
type Gender = "erkak" | "ayol";
type Variant = "before" | "after";

function pickKey(gender: Gender, goal: Goal, variant: Variant): string {
  const g = gender === "erkak" ? "male" : "female";
  if (goal === "ozish") {
    return variant === "before" ? `${g}_chubby` : `${g}_fit`;
  }
  if (goal === "oshirish") {
    if (gender === "erkak") {
      return variant === "before" ? "male_skinny" : "male_muscular";
    }
    return variant === "before" ? "female_skinny" : "female_toned";
  }
  return `${g}_fit`;
}

interface BodyAvatarProps {
  variant: Variant;
  gender?: Gender;
  goal?: Goal;
  width?: number;
  height?: number;
}

export function BodyAvatar({
  variant,
  gender = "erkak",
  goal = "ozish",
  width = 100,
  height = 180,
}: BodyAvatarProps) {
  const source = SOURCES[pickKey(gender, goal, variant)];
  return (
    <View style={[styles.wrap, { width, height }]}>
      <Image source={source} style={styles.img} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
  img: { width: "100%", height: "100%" },
});
