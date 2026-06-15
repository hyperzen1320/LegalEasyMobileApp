import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import Sheet from "./Sheet";

// House-style confirmation sheet for irreversible actions (permanent case
// delete in the vault + archive, bulk delete). Replaces the native
// Alert.alert with the Midnight Counsel bottom-sheet chrome and an explicit
// danger action, so a destructive tap always reads the same way.

export default function ConfirmSheet({
  visible,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Delete",
  busy = false,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  busy?: boolean;
}) {
  return (
    <Sheet
      visible={visible}
      onClose={busy ? () => {} : onClose}
      showClose={!busy}
      title={title}
    >
      <View className="px-5 pt-4">
        <View className="flex-row gap-3.5">
          <View
            className="h-11 w-11 items-center justify-center rounded-full"
            style={{ backgroundColor: "#f6dccd" }}
          >
            <Feather name="trash-2" size={19} color="#c14a37" />
          </View>
          <Text
            className="flex-1 text-[14px] leading-[21px] text-app-fg-soft"
            style={{ fontFamily: "Manrope" }}
          >
            {message}
          </Text>
        </View>

        <View className="mt-6 flex-row gap-3">
          <Pressable
            onPress={onClose}
            disabled={busy}
            className="flex-1 rounded-md py-3.5 items-center active:opacity-60"
            style={{
              backgroundColor: "#ffffff",
              borderWidth: 1,
              borderColor: "#e3d9c0",
            }}
          >
            <Text
              className="text-[13px]"
              style={{ fontFamily: "Manrope-Medium", color: "#4d4538" }}
            >
              Cancel
            </Text>
          </Pressable>
          <Pressable
            onPress={onConfirm}
            disabled={busy}
            className="flex-[1.4] rounded-md py-3.5 items-center justify-center flex-row gap-2"
            style={{ backgroundColor: "#c14a37", opacity: busy ? 0.7 : 1 }}
            accessibilityRole="button"
            accessibilityLabel={confirmLabel}
          >
            {busy ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Feather name="trash-2" size={14} color="#ffffff" />
            )}
            <Text
              className="text-[13px]"
              style={{ fontFamily: "Manrope-SemiBold", color: "#ffffff" }}
            >
              {confirmLabel}
            </Text>
          </Pressable>
        </View>
      </View>
    </Sheet>
  );
}
