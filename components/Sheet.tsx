import { type ReactNode } from "react";
import {
  Modal,
  Pressable,
  View,
  Text,
  StyleSheet,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

// Bottom sheet primitive shared across every sheet in the app — bell
// notifications, action sheets on long-press, status pickers in
// attendance, the new-chat picker, etc. Wraps RN Modal with the
// "Midnight Counsel" sheet chrome:
//
//   ┌─────────────────────────────┐
//   │       — copper handle —      │
//   │  Title           [ ✕ ]      │
//   │  ─────────────────────────  │
//   │                              │
//   │     {children}               │
//   │                              │
//   │   (safe-area bottom pad)     │
//   └─────────────────────────────┘
//
// Backdrop tap dismisses. Content area is intentionally NOT scrollable
// by default — callers wrap their own ScrollView when they need it,
// because they often need refresh controls, sticky headers, or custom
// keyboard handling that a one-size-fits-all scroller would get wrong.

export type SheetProps = {
  visible: boolean;
  onClose: () => void;
  // Optional title row. If omitted, the sheet has only the copper
  // drag handle and nothing else above {children}.
  title?: string;
  // Optional eyebrow above the title (DM Mono uppercase). Used by
  // BellSheet ("NOTIFICATIONS", "DELETE REQUESTS") and others.
  eyebrow?: string;
  // Optional element rendered to the right of the title row — typically
  // a filter button or a counter pill. Replaces the default ✕ when
  // provided; consumers wanting both should include their own ✕.
  rightSlot?: ReactNode;
  // Defaults true. The close ✕ in the top right; suppress it when the
  // sheet has only a backdrop-tap or swipe-down dismiss path.
  showClose?: boolean;
  // Extra style on the inner container — typically used to set a custom
  // maxHeight or backgroundColor when the default canvas isn't right.
  containerStyle?: ViewStyle;
  children: ReactNode;
};

export default function Sheet({
  visible,
  onClose,
  title,
  eyebrow,
  rightSlot,
  showClose = true,
  containerStyle,
  children,
}: SheetProps) {
  const insets = useSafeAreaInsets();
  // Ensure at least 12pt below the content even on devices that report
  // no safe-area inset (older Androids, hardware-button phones).
  const bottomPad = Math.max(insets.bottom, 12);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Backdrop. Touch anywhere outside the sheet to dismiss. */}
      <Pressable
        accessibilityLabel="Close sheet"
        onPress={onClose}
        style={styles.backdrop}
      >
        {/* Stop the dismiss-on-tap from bubbling out of the sheet body.
            The wrapping Pressable above catches taps on the dimmed area;
            this inner Pressable swallows taps on the sheet itself. */}
        <Pressable
          onPress={() => {}}
          style={[
            styles.container,
            { paddingBottom: bottomPad },
            containerStyle,
          ]}
        >
          <View style={styles.handleRow}>
            <View style={styles.handle} />
          </View>

          {title || rightSlot || showClose ? (
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                {eyebrow ? (
                  <Text style={styles.eyebrow}>{eyebrow}</Text>
                ) : null}
                {title ? (
                  <Text style={styles.title} numberOfLines={1}>
                    {title}
                  </Text>
                ) : null}
              </View>
              {rightSlot
                ? rightSlot
                : showClose ? (
                    <Pressable
                      onPress={onClose}
                      hitSlop={10}
                      style={styles.closeBtn}
                      accessibilityLabel="Close"
                    >
                      <Feather name="x" size={18} color="#0a1124" />
                    </Pressable>
                  ) : null}
            </View>
          ) : null}

          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(10,17,36,0.55)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: "#f4ede0",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: "#0a1124",
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -6 },
    elevation: 12,
  },
  handleRow: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 6,
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#c5853a",
    opacity: 0.6,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e3d9c0",
  },
  eyebrow: {
    fontFamily: "DMMono-Medium",
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: "#8a5821",
  },
  title: {
    fontFamily: "Crimson-SemiBold",
    fontSize: 20,
    color: "#0a1124",
    marginTop: 2,
  },
  closeBtn: {
    height: 32,
    width: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "rgba(10,17,36,0.06)",
  },
});
