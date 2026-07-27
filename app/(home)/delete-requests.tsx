import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useFocusEffect, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";

import {
  ApiError,
  partnerListDeleteRequests,
  type DeleteRequestRow,
} from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { useNotificationCount } from "../../lib/notification-count";
import {
  DeleteRequestCard,
  targetLabel,
  useDeleteRequestReview,
} from "../../components/workflow/DeleteRequestReview";

// The office admin's delete-request inbox — every pending request in the
// chambers, whatever it's about.
//
// Until now the only review screen was the bell inside a Work Flow board,
// and that one filters by boardId. A request to delete a case, a document,
// a client or a court carries no board, so it could never appear anywhere:
// the requester was told "sent for review" and the admin was never shown
// it. Nothing was lost — the rows have been sitting in the collection —
// they just had no surface.
//
// No new API. GET /api/app/delete-requests?status=pending with boardId
// omitted already returns every pending request across all target types,
// with the target's name resolved server-side.

const FILTERS: { key: string; label: string; types: string[] | null }[] = [
  { key: "all", label: "All", types: null },
  { key: "cases", label: "Cases", types: ["case", "case_document"] },
  { key: "people", label: "Clients & courts", types: ["client", "court"] },
  { key: "boards", label: "Work Flow", types: ["board", "list", "task"] },
];

export default function DeleteRequests() {
  const router = useRouter();
  const { isPartnerAdmin, status } = useAuth();
  const { refresh: refreshBadge } = useNotificationCount();

  const [rows, setRows] = useState<DeleteRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");

  // Approvals are the admin's alone. Same guard the office Activity
  // screen uses, so a deep link can't get a junior in here.
  useEffect(() => {
    if (status === "authenticated" && !isPartnerAdmin) router.back();
  }, [status, isPartnerAdmin, router]);

  const load = useCallback(async () => {
    try {
      // No boardId — that omission is the whole point of this screen.
      const res = await partnerListDeleteRequests({
        status: "pending",
        limit: 100,
      });
      setRows(res.requests);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load");
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

  const { open, sheet } = useDeleteRequestReview((id) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
    // The More-tab badge reads the same partner-wide count; nudge it so it
    // drops immediately rather than on its next 30s tick.
    refreshBadge();
  });

  const visible = useMemo(() => {
    const f = FILTERS.find((x) => x.key === filter);
    if (!f?.types) return rows;
    return rows.filter((r) => f.types!.includes(r.targetType));
  }, [rows, filter]);

  // Only offer a filter chip when there's actually something behind it.
  const availableFilters = useMemo(
    () =>
      FILTERS.filter(
        (f) => !f.types || rows.some((r) => f.types!.includes(r.targetType))
      ),
    [rows]
  );

  return (
    <View className="flex-1 bg-app-canvas">
      <StatusBar style="dark" backgroundColor="#f4ede0" />
      <SafeAreaView className="flex-1" edges={["top"]}>
        {/* Header */}
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
          <View className="flex-1 min-w-0">
            <Text
              className="text-[10px] uppercase text-app-copper-deep"
              style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.8 }}
            >
              Office admin
            </Text>
            <Text
              className="text-[18px] tracking-tight text-app-ink leading-none mt-0.5"
              style={{ fontFamily: "Crimson-SemiBold" }}
            >
              Delete Requests
            </Text>
          </View>
          {rows.length > 0 ? (
            <View
              className="rounded-full px-2 py-1"
              style={{ backgroundColor: "#c14a37" }}
            >
              <Text
                className="text-[11px] tabular-nums"
                style={{ fontFamily: "DMMono-Medium", color: "#ffffff" }}
              >
                {rows.length}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Filter chips */}
        {availableFilters.length > 2 ? (
          <View className="px-5 pt-3">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              {availableFilters.map((f) => {
                const active = f.key === filter;
                return (
                  <Pressable
                    key={f.key}
                    onPress={() => setFilter(f.key)}
                    className="rounded-full px-3.5 active:opacity-75"
                    style={{
                      paddingVertical: 6,
                      backgroundColor: active ? "#0a1124" : "#ffffff",
                      borderWidth: 1,
                      borderColor: active ? "#0a1124" : "#e3d9c0",
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                  >
                    <Text
                      className="text-[12px]"
                      style={{
                        fontFamily: "Manrope-SemiBold",
                        color: active ? "#f5ebd6" : "#4d4538",
                      }}
                    >
                      {f.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#c5853a" size="large" />
          </View>
        ) : (
          <ScrollView
            contentContainerClassName="px-5 pt-4 pb-8"
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#c5853a"
              />
            }
          >
            {error ? (
              <Pressable
                onPress={load}
                className="rounded-md px-4 py-3 mb-4 active:opacity-70"
                style={{ backgroundColor: "#f6dccd" }}
              >
                <Text
                  className="text-[13px]"
                  style={{ fontFamily: "Manrope", color: "#c14a37" }}
                >
                  {error} — tap to retry
                </Text>
              </Pressable>
            ) : null}

            {visible.length === 0 ? (
              <Empty hasAny={rows.length > 0} />
            ) : (
              <View className="gap-3">
                {visible.map((r, i) => (
                  <Animated.View
                    key={r.id}
                    entering={FadeInDown.duration(360).delay(
                      Math.min(i, 8) * 40
                    )}
                  >
                    <DeleteRequestCard
                      row={r}
                      isAdmin={isPartnerAdmin}
                      onApprove={() => open(r.id, "approve")}
                      onReject={() => open(r.id, "reject")}
                    />
                    <Text
                      className="mt-1.5 ml-1 text-[10px] uppercase"
                      style={{
                        fontFamily: "DMMono",
                        letterSpacing: 1.1,
                        color: "#a89c80",
                      }}
                    >
                      {targetLabel(r.targetType)}
                    </Text>
                  </Animated.View>
                ))}
              </View>
            )}
          </ScrollView>
        )}
      </SafeAreaView>

      {sheet}
    </View>
  );
}

function Empty({ hasAny }: { hasAny: boolean }) {
  return (
    <View className="items-center pt-16">
      <View
        className="h-12 w-12 items-center justify-center rounded-full"
        style={{ backgroundColor: "#efe5d0" }}
      >
        <Feather name="check-circle" size={20} color="#8a5821" />
      </View>
      <Text
        className="mt-4 text-[20px] font-semibold tracking-tight text-app-ink text-center"
        style={{ fontFamily: "Crimson-SemiBold" }}
      >
        {hasAny ? "Nothing in this group." : "Nothing waiting on you."}
      </Text>
      <Text
        className="mt-1.5 text-[12.5px] text-app-fg-muted text-center max-w-[290px]"
        style={{ fontFamily: "Manrope" }}
      >
        {hasAny
          ? "Switch filters to see the rest of the pending requests."
          : "When someone in chambers asks to delete a case, a document, a client or a card, it lands here for you to approve or reject."}
      </Text>
    </View>
  );
}
