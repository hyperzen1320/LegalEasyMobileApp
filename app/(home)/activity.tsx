import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { FlashList } from "@shopify/flash-list";
import {
  ApiError,
  partnerActivityHistory,
  type ActivityHistoryRow,
} from "../../lib/api";
import { useAuth } from "../../lib/auth-context";

// Office-wide audit log (admin only, like the web sidebar item) —
// cursor-paginated, with a date range and free-text/area narrowing.
//
// The complaint was that it "only shows one day". It never had a date
// limit: it asked for one page of 50 rows and, for a busy office, 50 rows
// IS about a day. The web client has always had range presets; the app
// had none and no way to say how far back it went. Both are here now, and
// the range is applied server-side (the route has always accepted from/to
// — see api/app/activity/route.ts) rather than fetched-then-thrown-away.

const PAGE = 50;

type RangeKey = "any" | "today" | "7d" | "30d" | "month";

// Mirrors DATE_RANGE_PRESETS in the web ActivityClient so both platforms
// mean the same thing by "Last 7 days".
const RANGES: { key: RangeKey; label: string }[] = [
  { key: "any", label: "Any time" },
  { key: "today", label: "Today" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "month", label: "This month" },
];

function rangeBounds(key: RangeKey): { from?: string; to?: string } {
  // en-CA gives yyyy-mm-dd in LOCAL time — using toISOString here would
  // shift the day backwards for anyone in IST before 05:30.
  const iso = (d: Date) => d.toLocaleDateString("en-CA");
  const today = new Date();
  switch (key) {
    case "any":
      return {};
    case "today":
      return { from: iso(today), to: iso(today) };
    case "7d": {
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      return { from: iso(start), to: iso(today) };
    }
    case "30d": {
      const start = new Date(today);
      start.setDate(start.getDate() - 29);
      return { from: iso(start), to: iso(today) };
    }
    case "month":
      return {
        from: iso(new Date(today.getFullYear(), today.getMonth(), 1)),
        to: iso(today),
      };
  }
}

const AREA_FILTERS: { key: string; label: string; match: (t: string) => boolean }[] = [
  { key: "all", label: "All", match: () => true },
  { key: "cases", label: "Cases", match: (t) => t === "case" || t === "case_document" },
  { key: "clients", label: "Clients", match: (t) => t === "client" || t === "court" },
  {
    key: "boards",
    label: "Boards",
    match: (t) => t === "board" || t === "task" || t === "list",
  },
  { key: "chat", label: "Desk", match: (t) => t === "chat_room" || t === "reminder" },
  { key: "team", label: "Team", match: (t) => t === "user" || t === "partner" },
];

export default function OfficeActivity() {
  const router = useRouter();
  const { isPartnerAdmin, status } = useAuth();
  const [rows, setRows] = useState<ActivityHistoryRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [area, setArea] = useState("all");
  const [range, setRange] = useState<RangeKey>("any");

  // The web nav hides Activity from non-admins; mirror that here.
  useEffect(() => {
    if (status === "authenticated" && !isPartnerAdmin) router.back();
  }, [status, isPartnerAdmin, router]);

  const load = useCallback(
    async (mode: "reset" | "more", before?: string, forRange?: RangeKey) => {
    try {
      const res = await partnerActivityHistory({
        limit: PAGE,
        before: mode === "more" ? before : undefined,
        ...rangeBounds(forRange ?? "any"),
      });
      setRows((prev) =>
        mode === "more" ? [...prev, ...res.activity] : res.activity
      );
      setCursor(res.nextCursor);
      setHasMore(res.hasMore);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load");
    }
  },
    []
  );

  // Reload whenever the range changes — the bound is applied server-side,
  // so this is a different query, not a client-side filter of what we have.
  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      await load("reset", undefined, range);
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [load, range]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load("reset", undefined, range);
    setRefreshing(false);
  }, [load, range]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || loading || !cursor) return;
    setLoadingMore(true);
    // Carry the range — otherwise page 2 would quietly come back
    // unbounded and the list would mix scopes.
    await load("more", cursor, range);
    setLoadingMore(false);
  }, [hasMore, loadingMore, loading, cursor, load, range]);

  const filtered = useMemo(() => {
    const match = AREA_FILTERS.find((f) => f.key === area)?.match;
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (match && !match(r.targetType)) return false;
      if (!q) return true;
      return (
        r.actorName.toLowerCase().includes(q) ||
        r.targetName.toLowerCase().includes(q) ||
        r.message.toLowerCase().includes(q)
      );
    });
  }, [rows, area, query]);

  return (
    <View className="flex-1 bg-app-canvas">
      <StatusBar style="dark" backgroundColor="#f4ede0" />
      <SafeAreaView className="flex-1" edges={["top"]}>
        {/* Top bar */}
        <View
          className="border-b border-app-edge bg-app-canvas px-4 py-3 flex-row items-center"
          style={{ gap: 10 }}
        >
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            className="active:opacity-50 h-9 w-9 items-center justify-center rounded-md"
            style={{ backgroundColor: "#ffffff" }}
            accessibilityLabel="Back"
          >
            <Feather name="arrow-left" size={17} color="#0a1124" />
          </Pressable>
          <View className="flex-1">
            <Text
              className="text-[10px] uppercase text-app-copper-deep"
              style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.8 }}
            >
              The Ledger
            </Text>
            <Text
              className="text-[18px] tracking-tight text-app-ink leading-none mt-0.5"
              style={{ fontFamily: "Crimson-SemiBold" }}
            >
              Office Activity
            </Text>
          </View>
        </View>

        {/* Search + area chips */}
        <View className="px-5 pt-3.5 pb-1">
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
              placeholder="Search who or what..."
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
          {/* How far back to look. Applied server-side, so this is the
              answer to "it only shows one day" — it never had a limit, it
              just never asked for more than a page. */}
          <View className="flex-row flex-wrap mt-2.5" style={{ gap: 6 }}>
            {RANGES.map((r) => {
              const on = r.key === range;
              return (
                <Pressable
                  key={r.key}
                  onPress={() => setRange(r.key)}
                  className="rounded-full px-3 active:opacity-80"
                  style={{
                    paddingVertical: 5,
                    backgroundColor: on ? "#c5853a" : "#ffffff",
                    borderWidth: 1,
                    borderColor: on ? "#c5853a" : "#e3d9c0",
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                >
                  <Text
                    className="text-[11px]"
                    style={{
                      fontFamily: on ? "Manrope-SemiBold" : "Manrope",
                      color: on ? "#2a1c08" : "#0a1124",
                    }}
                  >
                    {r.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View className="flex-row flex-wrap mt-2.5" style={{ gap: 6 }}>
            {AREA_FILTERS.map((f) => {
              const on = f.key === area;
              return (
                <Pressable
                  key={f.key}
                  onPress={() => setArea(f.key)}
                  className="rounded-full px-3 active:opacity-80"
                  style={{
                    paddingVertical: 5,
                    backgroundColor: on ? "#0a1124" : "#ffffff",
                    borderWidth: 1,
                    borderColor: on ? "#0a1124" : "#e3d9c0",
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                >
                  <Text
                    className="text-[11px]"
                    style={{
                      fontFamily: on ? "Manrope-SemiBold" : "Manrope",
                      color: on ? "#f5ebd6" : "#0a1124",
                    }}
                  >
                    {f.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#c5853a" size="large" />
          </View>
        ) : (
          <Animated.View entering={FadeInDown.duration(380)} className="flex-1">
            <FlashList
              data={filtered}
              keyExtractor={(r) => r.id}
              renderItem={({ item }) => <ActivityRow r={item} />}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              onEndReached={loadMore}
              onEndReachedThreshold={0.4}
              contentContainerStyle={{
                paddingHorizontal: 20,
                paddingTop: 10,
                paddingBottom: 32,
              }}
              ListHeaderComponent={
                error ? (
                  <View
                    className="rounded-md px-4 py-3 mb-3"
                    style={{ backgroundColor: "#f6dccd" }}
                  >
                    <Text
                      className="text-[13px]"
                      style={{ fontFamily: "Manrope", color: "#c14a37" }}
                    >
                      {error}
                    </Text>
                  </View>
                ) : null
              }
              ListFooterComponent={
                loadingMore ? (
                  <View className="items-center py-5">
                    <ActivityIndicator color="#c5853a" size="small" />
                  </View>
                ) : rows.length > 0 ? (
                  // Say what's on screen and whether there's more behind
                  // it. Infinite scroll with no marker is exactly why this
                  // read as "only one day".
                  <Pressable
                    onPress={hasMore ? loadMore : undefined}
                    disabled={!hasMore}
                    className="items-center py-6 active:opacity-70"
                  >
                    <Text
                      className="text-[11px] uppercase"
                      style={{
                        fontFamily: "DMMono-Medium",
                        letterSpacing: 1.4,
                        color: hasMore ? "#8a5821" : "#a89c80",
                      }}
                    >
                      {hasMore
                        ? `Showing ${rows.length} · tap for more`
                        : `That's all ${rows.length} — end of the ledger`}
                    </Text>
                  </Pressable>
                ) : null
              }
              ListEmptyComponent={
                <View className="items-center pt-14 px-8">
                  <Feather name="activity" size={20} color="#a89c80" />
                  <Text
                    className="mt-3 text-[13px] text-app-fg-muted text-center"
                    style={{ fontFamily: "Manrope" }}
                  >
                    {query || area !== "all" || range !== "any"
                      ? "Nothing matches this slice of the ledger. Try a wider date range."
                      : "No activity recorded yet."}
                  </Text>
                </View>
              }
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor="#c5853a"
                />
              }
            />
          </Animated.View>
        )}
      </SafeAreaView>
    </View>
  );
}

const ACTION_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  case: "briefcase",
  case_document: "file-text",
  client: "users",
  court: "home",
  board: "layout",
  task: "square",
  list: "columns",
  chat_room: "message-square",
  reminder: "bell",
  user: "user",
  partner: "shield",
};

function ActivityRow({ r }: { r: ActivityHistoryRow }) {
  const when = new Date(r.createdAt);
  const time = `${when.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  })} · ${when.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })}`;
  // The server writes markdown-ish **bold** in messages — strip for now.
  const message = r.message.replace(/\*\*/g, "");

  return (
    <View
      className="flex-row items-start gap-3 py-3"
      style={{ borderBottomWidth: 1, borderBottomColor: "#efe5d0" }}
    >
      <View
        className="h-8 w-8 items-center justify-center rounded-md mt-0.5"
        style={{ backgroundColor: "#efe5d0" }}
      >
        <Feather
          name={ACTION_ICONS[r.targetType] ?? "activity"}
          size={13}
          color="#8a5821"
        />
      </View>
      <View className="flex-1 min-w-0">
        <Text
          className="text-[13px] leading-[19px] text-app-ink"
          style={{ fontFamily: "Manrope" }}
        >
          <Text style={{ fontFamily: "Manrope-SemiBold" }}>{r.actorName}</Text>{" "}
          {message}
        </Text>
        <Text
          className="mt-1 text-[9.5px] text-app-fg-muted"
          style={{ fontFamily: "DMMono", letterSpacing: 0.4 }}
        >
          {time}
        </Text>
      </View>
    </View>
  );
}
