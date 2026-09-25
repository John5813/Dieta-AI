import { Alert, Platform } from "react-native";

/**
 * Yes/no confirmation that also works on web, where react-native-web's
 * Alert.alert is a no-op (so destructive buttons silently did nothing, or
 * code skipped the confirmation there altogether).
 */
export function confirmAction(opts: {
  title: string;
  message: string;
  confirmText: string;
  cancelText?: string;
  destructive?: boolean;
}): Promise<boolean> {
  if (Platform.OS === "web") {
    const ok = typeof window !== "undefined" && window.confirm(`${opts.title}\n\n${opts.message}`);
    return Promise.resolve(ok);
  }
  return new Promise((resolve) => {
    Alert.alert(
      opts.title,
      opts.message,
      [
        { text: opts.cancelText ?? "Bekor qilish", style: "cancel", onPress: () => resolve(false) },
        {
          text: opts.confirmText,
          style: opts.destructive ? "destructive" : "default",
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
