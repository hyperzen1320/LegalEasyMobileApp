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
// cursor-paginated, with client-side narrowing by area and free text.
// The server returns newest-first with `nextCursor` for the next page.

const PAGE = 50;

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

  // The web nav hides Activity from non-admins; mirror that here.
  useEffect(() => {
    if (status === "authenticated" && !isPartnerAdmin) router.back();
  }, [status, isPartnerAdmin, router]);

  const load = useCallback(async (mode: "reset" | "more", before?: string) => {
    try {
      const res = await partnerActivityHistory({
        limit: PAGE,
        before: mode === "more" ? before : undefined,
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
  }, []);

  useEffect(() => {
    (async () => {
      await load("reset");
      setLoading(false);
    })();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load("reset");
    setRefreshing(false);
  }, [load]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || loading || !cursor) return;
    setLoadingMore(true);
    await load("more", cursor);
    setLoadingMore(false);
  }, [hasMore, loadingMore, loading, cursor, load]);

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
                ) : null
              }
              ListEmptyComponent={
                <View className="items-center pt-14 px-8">
                  <Feather name="activity" size={20} color="#a89c80" />
                  <Text
                    className="mt-3 text-[13px] text-app-fg-muted text-center"
                    style={{ fontFamily: "Manrope" }}
                  >
                    {query || area !== "all"
                      ? "Nothing matches this slice of the ledger."
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
