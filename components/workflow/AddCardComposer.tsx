import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, TextInput } from "react-native";
import { Feather } from "@expo/vector-icons";

/**
 * In-place "+ Add a card" composer pinned at the bottom of each list.
 * Tap to expand → multi-line input + Add / Cancel. Enter on the
 * software keyboard submits.
 */
export default function AddCardComposer({
  onSubmit,
}: {
  onSubmit: (title: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (open) {
      // small delay so the layout settles before focus animates
      const t = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [open]);

  function commit() {
    const trimmed = title.trim();
    if (!trimmed) {
      setOpen(false);
      setTitle("");
      return;
    }
    onSubmit(trimmed);
    setTitle("");
    setOpen(false);
  }

  if (!open) {
    return (
      <Pressable
        onPress={() => setOpen(true)}
        className="active:opacity-50 flex-row items-center"
        style={{
          paddingHorizontal: 12,
          paddingVertical: 10,
          gap: 6,
        }}
        accessibilityRole="button"
        accessibilityLabel="Add a card to this list"
      >
        <Feather name="plus" size={13} color="#7a7060" />
        <Text
          className="text-[12px] text-app-fg-muted"
          style={{ fontFamily: "Manrope" }}
        >
          Add a card
        </Text>
      </Pressable>
    );
  }

  return (
    <View
      style={{
        backgroundColor: "#ffffff",
        borderRadius: 10,
        padding: 8,
        borderWidth: 2,
        borderColor: "rgba(197,133,58,0.35)",
      }}
    >
      <TextInput
        ref={inputRef}
        value={title}
        onChangeText={setTitle}
        placeholder="Title of this card…"
        placeholderTextColor="#a89c80"
        multiline
        autoCorrect={false}
        autoCapitalize="sentences"
        returnKeyType="done"
        blurOnSubmit
        onSubmitEditing={commit}
        style={{
          fontFamily: "Manrope",
          fontSize: 14,
          color: "#0a1124",
          paddingVertical: 4,
          paddingHorizontal: 4,
          minHeight: 36,
        }}
      />
      <View className="mt-1 flex-row items-center" style={{ gap: 6 }}>
        <Pressable
          onPress={commit}
          className="active:opacity-80 rounded-md flex-row items-center"
          style={{
            backgroundColor: "#c5853a",
            paddingHorizontal: 12,
            paddingVertical: 6,
            gap: 4,
          }}
          accessibilityLabel="Add card"
        >
          <Feather name="plus" size={12} color="#2a1c08" />
          <Text
            className="text-[11px]"
            style={{ fontFamily: "Manrope-SemiBold", color: "#2a1c08" }}
          >
            Add card
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            setOpen(false);
            setTitle("");
          }}
          className="active:opacity-50"
          style={{ paddingHorizontal: 8, paddingVertical: 6 }}
          accessibilityLabel="Cancel"
        >
          <Text
            className="text-[10px] uppercase"
            style={{
              fontFamily: "DMMono-Medium",
              letterSpacing: 1.2,
              color: "#7a7060",
            }}
          >
            Cancel
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
