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
import { sortCourts } from "../../lib/court-order";
import type { PartnerCourt } from "../../lib/api";

// Single-select court dropdown for the Case Vault filter. Replaces the old
// chip grid (Img "Filter the rolls"): the rolls are ordered by court number
// (see lib/court-order) and picked from a searchable modal list — the same
// "dropdown" feel as the case-form CourtCombobox, minus the create option (a
// filter only ever picks an existing court). Selecting a court sets courtId;
// the "All courts" row clears it.
export default function CourtFilterField({
  courts,
  selectedId,
  onSelect,
}: {
  courts: PartnerCourt[];
  selectedId?: string;
  onSelect: (courtId: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const ordered = useMemo(() => sortCourts(courts), [courts]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ordered;
    return ordered.filter((c) =>
      `${c.name} ${c.number ?? ""} ${c.place ?? ""}`.toLowerCase().includes(q)
    );
  }, [ordered, query]);

  const selected = courts.find((c) => c.id === selectedId);
  const labelText = selected
    ? selected.number
      ? `${selected.name} · ${selected.number}`
      : selected.name
    : "All courts";

  return (
    <View className="mt-5">
      <Text
        className="text-[10px] uppercase text-app-copper-deep mb-2"
        style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.8 }}
      >
        Court
      </Text>
      <Pressable
        onPress={() => {
          setQuery("");
          setOpen(true);
        }}
        className="flex-row items-center justify-between rounded-md border bg-app-paper px-3.5 py-3 active:opacity-70"
        style={{ borderColor: selected ? "#c5853a" : "#e3d9c0" }}
        accessibilityRole="button"
        accessibilityLabel="Filter by court"
      >
        <Text
          className="text-[14px]"
          style={{
            fontFamily: selected ? "Manrope-SemiBold" : "Manrope",
            color: selected ? "#0a1124" : "#a89c80",
          }}
          numberOfLines={1}
        >
          {labelText}
        </Text>
        <Feather name="chevron-down" size={16} color="#8a5821" />
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
                Court
              </Text>

              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search courts…"
                placeholderTextColor="#a89c80"
                autoFocus
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                className="rounded-md border bg-white px-3.5 py-3 text-[15px] text-app-ink"
                style={{ fontFamily: "Manrope", borderColor: "#c5853a" }}
              />

              <ScrollView
                style={{ maxHeight: 340 }}
                className="mt-2"
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <Pressable
                  onPress={() => {
                    onSelect(undefined);
                    setOpen(false);
                  }}
                  className="flex-row items-center justify-between py-3 active:opacity-50"
                  style={{ borderBottomWidth: 1, borderBottomColor: "#efe5d0" }}
                >
                  <Text
                    style={{
                      fontFamily: !selectedId
                        ? "Manrope-SemiBold"
                        : "Manrope-Medium",
                      fontSize: 15,
                      color: "#1f2a44",
                    }}
                  >
                    All courts
                  </Text>
                  {!selectedId ? (
                    <Feather name="check" size={16} color="#c5853a" />
                  ) : null}
                </Pressable>

                {filtered.map((c) => {
                  const on = c.id === selectedId;
                  const sub = [c.place, c.number].filter(Boolean).join(" · ");
                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => {
                        onSelect(c.id);
                        setOpen(false);
                      }}
                      className="flex-row items-center justify-between py-3 active:opacity-50"
                      style={{
                        borderBottomWidth: 1,
                        borderBottomColor: "#efe5d0",
                      }}
                    >
                      <View className="flex-1 min-w-0 pr-3">
                        <Text
                          style={{
                            fontFamily: on
                              ? "Manrope-SemiBold"
                              : "Manrope-Medium",
                            fontSize: 15,
                            color: on ? "#0a1124" : "#1f2a44",
                          }}
                          numberOfLines={1}
                        >
                          {c.name}
                        </Text>
                        {sub ? (
                          <Text
                            className="mt-0.5"
                            style={{
                              fontFamily: "DMMono",
                              fontSize: 11,
                              color: "#a89c80",
                              letterSpacing: 0.3,
                            }}
                            numberOfLines={1}
                          >
                            {sub}
                          </Text>
                        ) : null}
                      </View>
                      {on ? (
                        <Feather name="check" size={16} color="#c5853a" />
                      ) : c.caseCount > 0 ? (
                        <View
                          className="items-center justify-center rounded-md"
                          style={{
                            minWidth: 22,
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                            backgroundColor: "#efe5d0",
                          }}
                        >
                          <Text
                            style={{
                              fontFamily: "DMMono-Medium",
                              fontSize: 11,
                              color: "#8a5821",
                            }}
                          >
                            {c.caseCount}
                          </Text>
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}

                {filtered.length === 0 ? (
                  <Text
                    className="py-4 text-center"
                    style={{
                      fontFamily: "Manrope",
                      fontSize: 13,
                      color: "#a89c80",
                    }}
                  >
                    No courts match.
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
