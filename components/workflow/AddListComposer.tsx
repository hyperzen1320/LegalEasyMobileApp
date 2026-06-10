import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, TextInput } from "react-native";
import { Feather } from "@expo/vector-icons";

const DEFAULT_LIST_WIDTH = 280;

/**
 * "+ Add list" tile that lives at the end of the horizontal lane row.
 * Tap once to inflate into an inline input + Add/Cancel. `width` follows
 * the board's adaptive column width so the tile lines up with real lists.
 */
export default function AddListComposer({
  accent,
  width = DEFAULT_LIST_WIDTH,
  onSubmit,
}: {
  accent: string;
  width?: number;
  onSubmit: (title: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (open) {
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
        className="active:opacity-70 items-center justify-center"
        style={{
          width,
          minHeight: 100,
          borderRadius: 14,
          backgroundColor: "rgba(255,255,255,0.6)",
          borderWidth: 1.5,
          borderStyle: "dashed",
          borderColor: "#e3d9c0",
        }}
        accessibilityRole="button"
        accessibilityLabel="Add a new list"
      >
        <View
          className="h-10 w-10 items-center justify-center rounded-full"
          style={{ backgroundColor: "#efe5d0" }}
        >
          <Feather name="plus" size={18} color="#8a5821" />
        </View>
        <Text
          className="mt-2 text-[13px] tracking-tight text-app-ink"
          style={{ fontFamily: "Crimson-SemiBold" }}
        >
          Add list
        </Text>
        <Text
          className="text-[10px] uppercase mt-0.5"
          style={{
            fontFamily: "DMMono",
            letterSpacing: 1.2,
            color: "#a89c80",
          }}
        >
          New stage
        </Text>
      </Pressable>
    );
  }

  return (
    <View
      style={{
        width,
        backgroundColor: "rgba(255,255,255,0.92)",
        borderRadius: 14,
        padding: 12,
        borderWidth: 2,
        borderColor: accent,
      }}
    >
      <TextInput
        ref={inputRef}
        value={title}
        onChangeText={setTitle}
        placeholder="Name this list…"
        placeholderTextColor="#a89c80"
        autoCapitalize="sentences"
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={commit}
        style={{
          fontFamily: "Manrope",
          fontSize: 14,
          color: "#0a1124",
          padding: 6,
        }}
      />
      <View className="mt-2 flex-row items-center" style={{ gap: 8 }}>
        <Pressable
          onPress={commit}
          className="active:opacity-80 rounded-md flex-row items-center"
          style={{
            backgroundColor: "#c5853a",
            paddingHorizontal: 14,
            paddingVertical: 8,
            gap: 4,
          }}
          accessibilityLabel="Add list"
        >
          <Feather name="plus" size={13} color="#2a1c08" />
          <Text
            className="text-[12px]"
            style={{ fontFamily: "Manrope-SemiBold", color: "#2a1c08" }}
          >
            Add list
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            setOpen(false);
            setTitle("");
          }}
          className="active:opacity-50"
          style={{ paddingHorizontal: 8, paddingVertical: 8 }}
          accessibilityLabel="Cancel"
        >
          <Text
            className="text-[11px] uppercase"
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
