import { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";

// Shared keyboard-safe scroll container for form screens.
//
// iOS lifts content via the "padding" behaviour; Android relies on the
// window's adjustPan mode (app.json -> android.softwareKeyboardLayoutMode)
// to slide the focused field above the keyboard. Together these keep every
// input visible while typing, with no native dependency (Expo Go safe).
//
// Drop the screen's body inside this in place of a manual
// KeyboardAvoidingView + ScrollView pair; keep your own SafeAreaView outside.
type Props = {
  children: ReactNode;
  /** Tailwind classes for the scroll content container. */
  contentContainerClassName?: string;
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Extra offset to hold above the keyboard on iOS (e.g. a sticky header). */
  keyboardVerticalOffset?: number;
  /** Escape hatch for any other ScrollView prop. */
  scrollProps?: Partial<ScrollViewProps>;
};

export default function KeyboardAwareScreen({
  children,
  contentContainerClassName,
  contentContainerStyle,
  keyboardVerticalOffset = 0,
  scrollProps,
}: Props) {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={keyboardVerticalOffset}
      style={{ flex: 1 }}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
        contentContainerClassName={contentContainerClassName}
        contentContainerStyle={contentContainerStyle}
        {...scrollProps}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
