import { Alert, Platform } from "react-native";
import { trText } from "@/lib/i18n";

/**
 * Yes/no confirmation that also works on web, where react-native-web's
 * Alert.alert is a no-op (so destructive buttons silently did nothing, or
 * code skipped the confirmation there altogether). Text is shown in the
 * user's language.
 */
export function confirmAction(opts: {
  title: string;
  message: string;
  confirmText: string;
  cancelText?: string;
  destructive?: boolean;
}): Promise<boolean> {
  const title = trText(opts.title);
  const message = trText(opts.message);
  if (Platform.OS === "web") {
    const ok = typeof window !== "undefined" && window.confirm(`${title}\n\n${message}`);
    return Promise.resolve(ok);
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: trText(opts.cancelText ?? "Bekor qilish"), style: "cancel", onPress: () => resolve(false) },
        {
          text: trText(opts.confirmText),
          style: opts.destructive ? "destructive" : "default",
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
