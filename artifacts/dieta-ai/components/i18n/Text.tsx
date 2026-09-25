import React, { forwardRef } from "react";
import {
  Text as RNText,
  TextInput as RNTextInput,
  type TextInputProps,
  type TextProps,
} from "react-native";
import { trText } from "@/lib/i18n";

function translateChildren(children: React.ReactNode): React.ReactNode {
  if (typeof children === "string") return trText(children);
  if (Array.isArray(children)) {
    return children.map((c) => (typeof c === "string" ? trText(c) : c));
  }
  return children;
}

/**
 * Drop-in for react-native's Text that shows its string children in the
 * user's language (see lib/i18n). Non-string children render unchanged.
 */
export const Text = forwardRef<RNText, TextProps>(function Text(props, ref) {
  return <RNText ref={ref} {...props}>{translateChildren(props.children)}</RNText>;
});

/** TextInput whose placeholder follows the user's language. */
export const TextInput = forwardRef<RNTextInput, TextInputProps>(function TextInput(props, ref) {
  return (
    <RNTextInput
      ref={ref}
      {...props}
      placeholder={typeof props.placeholder === "string" ? trText(props.placeholder) : props.placeholder}
    />
  );
});
