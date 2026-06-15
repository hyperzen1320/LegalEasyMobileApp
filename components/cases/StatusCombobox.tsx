import { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  View,
  Text,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";

// Typeable status field — mirrors the web StatusCombobox. Opens a sheet with
// a text box (accepts ANY value) plus the standard stage suggestions; if the
// typed value isn't one of them, a "Use …" row commits the custom value.
// Same chrome as the SheetField picker in CaseFields so it sits seamlessly in
// the case forms and the Update-Hearing panel.

const DEFAULT_OPTIONS = [
  "Filed",
  "Notice",
  "Pleadings",
  "Issues",
  "Evidence",
  "Arguments",
  "Reserved",
  "Judgment",
  "Disposed",
];

export default function StatusCombobox({
  label = "Status",
  value,
  onChange,
  options = DEFAULT_OPTIONS,
  multiline = false,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  options?: string[];
  // Hearing statuses are long free-text cause-list notes; multiline opens a
  // tall editor pre-filled with the current value, with the stages kept as
  // one-tap quick-picks below.
  multiline?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const trimmed = query.trim();
  const filtered = useMemo(() => {
    // Long notes don't filter the stage quick-picks — they stay listed.
    if (multiline) return options;
    const q = trimmed.toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [multiline, trimmed, options]);

  const exact = options.some((o) => o.toLowerCase() === trimmed.toLowerCase());
  const canUseCustom = trimmed.length > 0 && !exact;

  function commit(v: string) {
    onChange(v);
    setQuery("");
    setOpen(false);
  }

  return (
    <View>
      <Text
        className="text-[10px] font-semibold uppercase text-app-fg-muted"
        style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.6 }}
      >
        {label}
      </Text>
      <Pressable
        onPress={() => {
          setQuery(multiline ? value : "");
          setOpen(true);
        }}
        className="mt-1.5 flex-row justify-between gap-2 rounded-md border bg-app-paper px-3.5 py-3 active:opacity-70"
        style={{
          borderColor: "#e3d9c0",
          alignItems: multiline ? "flex-start" : "center",
        }}
      >
        <Text
          className="flex-1 text-[15px] text-app-ink"
          style={{ fontFamily: "Manrope", lineHeight: multiline ? 20 : undefined }}
          numberOfLines={multiline ? 4 : 1}
        >
          {value || "Set status"}
        </Text>
        <Feather
          name="chevron-down"
          size={16}
          color="#8a5821"
          style={{ marginTop: multiline ? 2 : 0 }}
        />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
        statusBarTranslucent
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
        <Pressable
          onPress={() => setOpen(false)}
          className="flex-1"
          style={{ backgroundColor: "rgba(10,17,36,0.55)" }}
        >
          <View
            className="mt-auto rounded-t-3xl bg-app-paper px-5 pt-3 pb-8"
            style={{
              shadowColor: "#0a1124",
              shadowOpacity: 0.2,
              shadowRadius: 20,
              shadowOffset: { width: 0, height: -6 },
              elevation: 12,
            }}
            onStartShouldSetResponder={() => true}
          >
            <View
              className="self-center mb-3 h-1.5 w-12 rounded-full"
              style={{ backgroundColor: "#e3d9c0" }}
            />
            <Text
              className="text-[10px] uppercase text-app-copper-deep mb-3"
              style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.8 }}
            >
              {label}
            </Text>

            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={
                multiline
                  ? "Type the status / next step…"
                  : "Filed, Evidence… or type your own"
              }
              placeholderTextColor="#a89c80"
              autoFocus
              autoCapitalize={multiline ? "sentences" : "words"}
              autoCorrect={false}
              multiline={multiline}
              returnKeyType={multiline ? "default" : "done"}
              blurOnSubmit={!multiline}
              onSubmitEditing={() => {
                if (!multiline && trimmed) commit(trimmed);
              }}
              className="rounded-md border bg-white px-3.5 py-3 text-[15px] text-app-ink"
              style={[
                { fontFamily: "Manrope", borderColor: "#c5853a" },
                multiline
                  ? {
                      minHeight: 104,
                      maxHeight: 180,
                      textAlignVertical: "top",
                      lineHeight: 21,
                    }
                  : null,
              ]}
            />

            <ScrollView
              style={{ maxHeight: 300 }}
              className="mt-2"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {canUseCustom ? (
                <Pressable
                  onPress={() => commit(trimmed)}
                  className="flex-row items-center gap-2 py-3.5 active:opacity-50"
                  style={{ borderBottomWidth: 1, borderBottomColor: "#efe5d0" }}
                >
                  <Feather name="plus" size={15} color="#c5853a" />
                  <Text
                    className="flex-1"
                    numberOfLines={2}
                    style={{
                      fontFamily: "Manrope-SemiBold",
                      fontSize: 15,
                      color: "#0a1124",
                    }}
                  >
                    {multiline ? "Use this status" : `Use “${trimmed}”`}
                  </Text>
                </Pressable>
              ) : null}

              {filtered.map((opt) => {
                const active = value === opt;
                return (
                  <Pressable
                    key={opt}
                    onPress={() => commit(opt)}
                    className="flex-row items-center justify-between py-3.5 active:opacity-50"
                    style={{ borderBottomWidth: 1, borderBottomColor: "#efe5d0" }}
                  >
                    <Text
                      style={{
                        fontFamily: active ? "Manrope-SemiBold" : "Manrope",
                        fontSize: 15,
                        color: active ? "#0a1124" : "#4d4538",
                      }}
                    >
                      {opt}
                    </Text>
                    {active ? (
                      <Feather name="check" size={16} color="#c5853a" />
                    ) : null}
                  </Pressable>
                );
              })}

              {filtered.length === 0 && !canUseCustom ? (
                <Text
                  className="py-4 text-center"
                  style={{ fontFamily: "Manrope", fontSize: 13, color: "#a89c80" }}
                >
                  Type a custom status above.
                </Text>
              ) : null}
            </ScrollView>
          </View>
        </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
