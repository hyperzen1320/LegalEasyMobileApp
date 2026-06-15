import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  View,
  Text,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import {
  partnerListCourts,
  partnerCreateCourt,
  type PartnerCourt,
} from "../../lib/api";

// Typeable court picker — mirrors the web CourtCombobox. Tapping the field
// opens a sheet listing the office's courts (name, place · number, matter
// count) plus a search box that doubles as free-text entry: type a court
// that isn't on the list and a "Use …" row commits it. Keyboard-aware so the
// search box is never hidden behind the keyboard (the bug the plain Status /
// Court fields had: the sheet sat under the keyboard while typing).

export default function CourtCombobox({
  label = "Court",
  required,
  value,
  onChange,
  invalid,
}: {
  label?: string;
  required?: boolean;
  value: string;
  // Free text passes just the name; picking an existing court also carries
  // its place so the "Court Place" field can be filled in lock-step.
  onChange: (name: string, place?: string) => void;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [courts, setCourts] = useState<PartnerCourt[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [creating, setCreating] = useState(false);

  // Lazy-load the office's courts the first time the sheet opens.
  useEffect(() => {
    if (!open || loaded) return;
    let alive = true;
    setLoading(true);
    partnerListCourts()
      .then((data) => {
        if (alive) {
          setCourts(data.courts);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (alive) setLoaded(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open, loaded]);

  const trimmed = query.trim();
  const filtered = useMemo(() => {
    const q = trimmed.toLowerCase();
    if (!q) return courts;
    return courts.filter((c) =>
      `${c.name} ${c.number} ${c.place}`.toLowerCase().includes(q)
    );
  }, [trimmed, courts]);

  const exact = courts.some(
    (c) => c.name.toLowerCase() === trimmed.toLowerCase()
  );
  const canUseCustom = trimmed.length > 0 && !exact;

  function pick(c: PartnerCourt) {
    onChange(c.name, c.place || undefined);
    setQuery("");
    setOpen(false);
  }
  async function useCustom(v: string) {
    const name = v.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      // Persist the new court to Court Hub so it's reusable everywhere and
      // actually appears there — then select it on this case. (Previously
      // this only carried the free text, so the court never got saved.)
      const { court } = await partnerCreateCourt({ name });
      setCourts((prev) => [court, ...prev]);
      onChange(court.name, court.place || undefined);
    } catch {
      // Couldn't persist (offline / server) — still carry the typed name on
      // the case so the user isn't blocked.
      onChange(name);
    } finally {
      setCreating(false);
      setQuery("");
      setOpen(false);
    }
  }

  return (
    <View>
      <Text
        className="text-[10px] font-semibold uppercase text-app-fg-muted"
        style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.6 }}
      >
        {label}
        {required ? <Text style={{ color: "#c5853a" }}>{"  *"}</Text> : null}
      </Text>
      <Pressable
        onPress={() => {
          setQuery("");
          setOpen(true);
        }}
        className="mt-1.5 flex-row items-center justify-between rounded-md border bg-app-paper px-3.5 py-3 active:opacity-70"
        style={{ borderColor: invalid ? "#c14a37" : "#e3d9c0" }}
      >
        <Text
          className="text-[15px]"
          style={{
            fontFamily: "Manrope",
            color: value ? "#0a1124" : "#a89c80",
          }}
          numberOfLines={1}
        >
          {value || "Pick or type a court"}
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
                {label}
              </Text>

              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search courts… or type a court name"
                placeholderTextColor="#a89c80"
                autoFocus
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={() => {
                  if (trimmed) useCustom(trimmed);
                }}
                className="rounded-md border bg-white px-3.5 py-3 text-[15px] text-app-ink"
                style={{ fontFamily: "Manrope", borderColor: "#c5853a" }}
              />

              <ScrollView
                style={{ maxHeight: 320 }}
                className="mt-2"
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {canUseCustom ? (
                  <Pressable
                    onPress={() => useCustom(trimmed)}
                    disabled={creating}
                    className="flex-row items-center gap-2 py-3.5 active:opacity-50"
                    style={{
                      borderBottomWidth: 1,
                      borderBottomColor: "#efe5d0",
                      opacity: creating ? 0.6 : 1,
                    }}
                  >
                    {creating ? (
                      <ActivityIndicator size="small" color="#c5853a" />
                    ) : (
                      <Feather name="plus" size={15} color="#c5853a" />
                    )}
                    <Text
                      style={{
                        fontFamily: "Manrope-SemiBold",
                        fontSize: 15,
                        color: "#0a1124",
                      }}
                    >
                      {creating
                        ? "Adding to Court Hub…"
                        : `Add “${trimmed}” to Court Hub`}
                    </Text>
                  </Pressable>
                ) : null}

                {loading ? (
                  <View className="py-6 items-center">
                    <ActivityIndicator color="#c5853a" />
                  </View>
                ) : null}

                {filtered.map((c) => {
                  const active = value.toLowerCase() === c.name.toLowerCase();
                  const sub = [c.place, c.number].filter(Boolean).join(" · ");
                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => pick(c)}
                      className="flex-row items-center justify-between py-3 active:opacity-50"
                      style={{
                        borderBottomWidth: 1,
                        borderBottomColor: "#efe5d0",
                      }}
                    >
                      <View className="flex-1 min-w-0 pr-3">
                        <Text
                          style={{
                            fontFamily: active
                              ? "Manrope-SemiBold"
                              : "Manrope-Medium",
                            fontSize: 15,
                            color: active ? "#0a1124" : "#1f2a44",
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
                      {active ? (
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

                {!loading && loaded && filtered.length === 0 && !canUseCustom ? (
                  <Text
                    className="py-4 text-center"
                    style={{
                      fontFamily: "Manrope",
                      fontSize: 13,
                      color: "#a89c80",
                    }}
                  >
                    No courts yet — type a court name above.
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
