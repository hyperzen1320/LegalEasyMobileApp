import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  View,
  Text,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useFocusEffect, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import {
  partnerListCourts,
  partnerCreateCourt,
  ApiError,
  type PartnerCourt,
} from "../../../lib/api";

export default function CourtHub() {
  const [courts, setCourts] = useState<PartnerCourt[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await partnerListCourts();
      setCourts(data.courts);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    (async () => {
      await load();
      setLoading(false);
    })();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  function handleAdded(c: PartnerCourt) {
    setCourts((prev) =>
      [c, ...prev].sort((a, b) => a.name.localeCompare(b.name))
    );
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return courts;
    return courts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.number || "").toLowerCase().includes(q) ||
        (c.place || "").toLowerCase().includes(q)
    );
  }, [courts, query]);

  return (
    <View className="flex-1 bg-app-canvas">
      <StatusBar style="dark" backgroundColor="#f4ede0" />
      <SafeAreaView className="flex-1" edges={["top"]}>
        <TopBar count={courts.length} />

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1"
        >
          {loading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator color="#c5853a" size="large" />
            </View>
          ) : (
            <ScrollView
              contentContainerClassName="px-5 pt-4 pb-12"
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor="#c5853a"
                />
              }
            >
              <AddCourtForm onAdded={handleAdded} />

              {error ? (
                <View
                  className="mt-4 rounded-md px-4 py-3"
                  style={{
                    backgroundColor: "#f6dccd",
                    borderWidth: 1,
                    borderColor: "rgba(193,74,55,0.3)",
                  }}
                >
                  <Text
                    className="text-[13px]"
                    style={{ fontFamily: "Manrope", color: "#c14a37" }}
                  >
                    {error}
                  </Text>
                </View>
              ) : null}

              {courts.length > 0 ? (
                <View className="mt-5">
                  <View
                    className="flex-row items-center gap-2 rounded-xl bg-app-paper px-3.5 py-2.5"
                    style={{
                      shadowColor: "#0a1124",
                      shadowOpacity: 0.04,
                      shadowRadius: 6,
                      shadowOffset: { width: 0, height: 1 },
                      elevation: 1,
                    }}
                  >
                    <Feather name="search" size={15} color="#a89c80" />
                    <TextInput
                      value={query}
                      onChangeText={setQuery}
                      placeholder="Search by name, number, place..."
                      placeholderTextColor="#a89c80"
                      autoCapitalize="none"
                      autoCorrect={false}
                      className="flex-1 text-[14px] text-app-ink"
                      style={{ fontFamily: "Manrope", paddingVertical: 0 }}
                    />
                    {query.length > 0 ? (
                      <Pressable
                        onPress={() => setQuery("")}
                        hitSlop={8}
                        className="active:opacity-50"
                      >
                        <Feather name="x" size={15} color="#8a5821" />
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              ) : null}

              {courts.length === 0 ? (
                <EmptyHub />
              ) : filtered.length === 0 ? (
                <NoMatches query={query} onClear={() => setQuery("")} />
              ) : (
                <View className="mt-4 gap-3">
                  {filtered.map((c, i) => (
                    <Animated.View
                      key={c.id}
                      entering={FadeInDown.duration(380).delay(
                        Math.min(i, 10) * 35
                      )}
                    >
                      <CourtCard c={c} />
                    </Animated.View>
                  ))}
                </View>
              )}
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

/* ─── Top bar ─── */

function TopBar({ count }: { count: number }) {
  const router = useRouter();
  return (
    <View className="border-b border-app-edge bg-app-canvas px-5 py-3.5 flex-row items-center gap-3">
      <Pressable
        onPress={() => router.back()}
        hitSlop={10}
        className="active:opacity-50"
      >
        <Feather name="arrow-left" size={18} color="#0a1124" />
      </Pressable>
      <View className="flex-1">
        <Text
          className="text-[10px] uppercase text-app-copper-deep"
          style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.8 }}
        >
          The Halls
        </Text>
        <View className="flex-row items-baseline gap-2 mt-0.5">
          <Text
            className="text-[18px] font-semibold tracking-tight text-app-ink leading-none"
            style={{ fontFamily: "Crimson-SemiBold" }}
          >
            Court Hub
          </Text>
          {count > 0 ? (
            <Text
              className="text-[11px] text-app-fg-muted tabular-nums"
              style={{ fontFamily: "DMMono", letterSpacing: 0.5 }}
            >
              · {count}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

/* ─── Add Court ─── */

function AddCourtForm({ onAdded }: { onAdded: (c: PartnerCourt) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [place, setPlace] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  async function save() {
    setError(null);
    if (!name.trim()) {
      setMissing(true);
      setError("Court name is required.");
      return;
    }
    setMissing(false);
    setSubmitting(true);
    try {
      const res = await partnerCreateCourt({
        name: name.trim(),
        number: number.trim(),
        place: place.trim(),
      });
      onAdded(res.court);
      setName("");
      setNumber("");
      setPlace("");
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1400);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <Pressable
        onPress={() => setOpen(true)}
        className="rounded-xl py-3.5 items-center justify-center flex-row gap-2 active:opacity-90"
        style={{
          backgroundColor: "#c5853a",
          shadowColor: "#c5853a",
          shadowOpacity: 0.3,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 4,
        }}
      >
        <Feather name="plus" size={14} color="#2a1c08" />
        <Text
          className="text-[13px] font-semibold"
          style={{ fontFamily: "Manrope-SemiBold", color: "#2a1c08" }}
        >
          Add Court
        </Text>
      </Pressable>
    );
  }

  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      className="rounded-2xl bg-app-paper p-5"
      style={{
        shadowColor: "#0a1124",
        shadowOpacity: 0.05,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
      }}
    >
      <View className="flex-row items-center justify-between mb-1">
        <Text
          className="text-[10px] uppercase text-app-copper-deep"
          style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.8 }}
        >
          New court
        </Text>
        {savedFlash ? (
          <Animated.Text
            entering={FadeIn.duration(180)}
            className="text-[10px] uppercase"
            style={{
              fontFamily: "DMMono-Medium",
              letterSpacing: 1.6,
              color: "#56a0a8",
            }}
          >
            Saved ✓
          </Animated.Text>
        ) : null}
      </View>

      <View className="mt-3 gap-3">
        <Field
          label="Court Name"
          required
          value={name}
          onChangeText={(v) => {
            setName(v);
            if (missing && v.trim()) setMissing(false);
          }}
          placeholder="District Court"
          autoCapitalize="words"
          invalid={missing}
        />
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Field
              label="Court Number"
              value={number}
              onChangeText={setNumber}
              placeholder="Hall 3"
            />
          </View>
          <View className="flex-1">
            <Field
              label="Place"
              value={place}
              onChangeText={setPlace}
              placeholder="Chennai"
              autoCapitalize="words"
            />
          </View>
        </View>
      </View>

      {error ? (
        <Text
          className="mt-3 text-[12px]"
          style={{ fontFamily: "Manrope", color: "#c14a37" }}
        >
          {error}
        </Text>
      ) : null}

      <View className="mt-5 flex-row gap-3">
        <Pressable
          onPress={() => {
            setOpen(false);
            setError(null);
            setMissing(false);
          }}
          className="flex-1 rounded-md py-3 items-center active:opacity-50"
          style={{
            backgroundColor: "#ffffff",
            borderWidth: 1,
            borderColor: "#e3d9c0",
          }}
        >
          <Text
            className="text-[13px] font-medium text-app-fg-soft"
            style={{ fontFamily: "Manrope-Medium" }}
          >
            Done
          </Text>
        </Pressable>
        <Pressable
          onPress={save}
          disabled={submitting}
          className="flex-[1.4] rounded-md py-3 items-center justify-center flex-row gap-2"
          style={{
            backgroundColor: "#c5853a",
            opacity: submitting ? 0.6 : 1,
            shadowColor: "#c5853a",
            shadowOpacity: 0.3,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
            elevation: 4,
          }}
        >
          {submitting ? (
            <ActivityIndicator color="#2a1c08" size="small" />
          ) : (
            <>
              <Feather name="plus" size={13} color="#2a1c08" />
              <Text
                className="text-[13px] font-semibold"
                style={{ fontFamily: "Manrope-SemiBold", color: "#2a1c08" }}
              >
                Save
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </Animated.View>
  );
}

/* ─── Court card ─── */

function CourtCard({ c }: { c: PartnerCourt }) {
  const subtitle = [c.number, c.place].filter(Boolean).join(" · ");
  return (
    <View
      className="rounded-2xl bg-app-paper p-4 flex-row items-center gap-3"
      style={{
        shadowColor: "#0a1124",
        shadowOpacity: 0.05,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 1 },
        elevation: 1,
      }}
    >
      <View
        className="h-12 w-12 items-center justify-center rounded-md"
        style={{ backgroundColor: "#efe5d0" }}
      >
        <Feather name="home" size={20} color="#8a5821" />
      </View>
      <View className="flex-1 min-w-0">
        <Text
          className="text-[18px] font-semibold tracking-tight leading-[1.2] text-app-ink"
          style={{ fontFamily: "Crimson-SemiBold" }}
          numberOfLines={1}
        >
          {c.name}
        </Text>
        {subtitle ? (
          <Text
            className="mt-0.5 text-[11px] text-app-fg-muted"
            style={{
              fontFamily: "DMMono",
              letterSpacing: 0.4,
            }}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {c.caseCount > 0 ? (
        <View
          className="rounded-md px-2 py-1"
          style={{ backgroundColor: "#d2e6e7" }}
        >
          <Text
            className="text-[10px] font-semibold uppercase tabular-nums"
            style={{
              fontFamily: "DMMono-Medium",
              letterSpacing: 1.2,
              color: "#56a0a8",
            }}
          >
            {c.caseCount} {c.caseCount === 1 ? "matter" : "matters"}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/* ─── Field ─── */

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  required,
  invalid,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  invalid?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
}) {
  return (
    <View>
      <Text
        className="text-[10px] font-semibold uppercase text-app-fg-muted"
        style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.6 }}
      >
        {label}
        {required ? <Text style={{ color: "#c5853a" }}>{"  *"}</Text> : null}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#a89c80"
        autoCapitalize={autoCapitalize ?? "none"}
        autoCorrect={false}
        className="mt-1.5 rounded-md border bg-app-paper px-3.5 py-3 text-[15px] text-app-ink"
        style={{
          fontFamily: "Manrope",
          borderColor: invalid ? "#c14a37" : "#e3d9c0",
        }}
      />
    </View>
  );
}

/* ─── Empty / no matches ─── */

function EmptyHub() {
  return (
    <View className="items-center pt-12">
      <View
        className="h-14 w-14 items-center justify-center rounded-full"
        style={{ backgroundColor: "#efe5d0" }}
      >
        <Feather name="home" size={22} color="#8a5821" />
      </View>
      <Text
        className="mt-5 text-[24px] font-semibold tracking-tight text-app-ink text-center"
        style={{ fontFamily: "Crimson-SemiBold" }}
      >
        No courts yet.
      </Text>
      <Text
        className="mt-2 text-[13px] text-app-fg-muted text-center max-w-[300px]"
        style={{ fontFamily: "Manrope" }}
      >
        Add the courts your office practises in. Once added, they're reusable
        across the case vault, hearing track and exports.
      </Text>
    </View>
  );
}

function NoMatches({
  query,
  onClear,
}: {
  query: string;
  onClear: () => void;
}) {
  return (
    <View
      className="mt-6 rounded-xl px-5 py-10 items-center"
      style={{
        backgroundColor: "#ffffff",
        borderWidth: 1,
        borderColor: "#e3d9c0",
        borderStyle: "dashed",
      }}
    >
      <Feather name="search" size={20} color="#a89c80" />
      <Text
        className="mt-3 text-[13px] text-app-fg-muted text-center"
        style={{ fontFamily: "Manrope" }}
      >
        No matches for{" "}
        <Text
          style={{
            fontFamily: "Manrope-SemiBold",
            color: "#0a1124",
          }}
        >
          “{query}”
        </Text>
      </Text>
      <Pressable
        onPress={onClear}
        className="mt-3 rounded-md px-3 py-1.5 active:opacity-50"
        style={{ backgroundColor: "#efe5d0" }}
      >
        <Text
          className="text-[11px] uppercase"
          style={{
            fontFamily: "DMMono-Medium",
            letterSpacing: 1.5,
            color: "#8a5821",
          }}
        >
          Clear search
        </Text>
      </Pressable>
    </View>
  );
}
