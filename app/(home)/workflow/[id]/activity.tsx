import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";

import {
  partnerActivityHistory,
  partnerListDeleteRequests,
  partnerGetBoardFull,
  type ActivityHistoryRow,
  type DeleteRequestRow,
} from "../../../../lib/api";
import { useBoardLiveFeed } from "../../../../lib/useBoardLiveFeed";
import { useAuth } from "../../../../lib/auth-context";
import {
  DeleteRequestCard,
  useDeleteRequestReview,
} from "../../../../components/workflow/DeleteRequestReview";

/**
 * Bell drawer — board-scoped activity feed + admin's delete-request
 * inbox. Lives at /workflow/[id]/activity, pushed by the bell icon on
 * the board detail header. Polls activity via the live feed; pending
 * requests via a slow 8s timer (state, not events).
 */
export default function BoardActivity() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const boardId = String(id);
  const router = useRouter();
  const { isPartnerAdmin, status } = useAuth();

  // The audit trail is the office admin's, here as much as on the office
  // Activity screen — which has always guarded itself this way. This one
  // never did, so any junior with a board open could read the whole feed
  // through the bell.
  useEffect(() => {
    if (status === "authenticated" && !isPartnerAdmin) router.back();
  }, [status, isPartnerAdmin, router]);

  const [tab, setTab] = useState<"activity" | "requests">("activity");
  const [history, setHistory] = useState<ActivityHistoryRow[]>([]);
  const [requests, setRequests] = useState<DeleteRequestRow[]>([]);
  const [stats, setStats] = useState<{
    lists: number;
    cards: number;
    perList: { id: string; title: string; count: number }[];
  } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const live = useBoardLiveFeed({ boardId });

  /* ─── Load history (one-shot) + stats + role ─── */
  const loadInitial = useCallback(async () => {
    try {
      const [hist, board] = await Promise.all([
        partnerActivityHistory({ boardId, limit: 80 }),
        partnerGetBoardFull(boardId),
      ]);
      setHistory(hist.activity);
      setIsAdmin(board.role === "admin");
      const counts = new Map<string, number>();
      for (const t of board.tasks) {
        counts.set(t.listId, (counts.get(t.listId) ?? 0) + 1);
      }
      setStats({
        lists: board.lists.length,
        cards: board.tasks.length,
        perList: board.lists
          .slice()
          .sort((a, b) => a.position.x - b.position.x)
          .map((l) => ({
            id: l.id,
            title: l.title,
            count: counts.get(l.id) ?? 0,
          })),
      });
    } catch {
      /* leave the empty state visible */
    }
  }, [boardId]);

  /* ─── Pending requests poll ─── */
  const loadRequests = useCallback(async () => {
    try {
      const res = await partnerListDeleteRequests({
        status: "pending",
        boardId,
        limit: 80,
      });
      setRequests(res.requests);
    } catch {
      /* ignore */
    }
  }, [boardId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      await Promise.all([loadInitial(), loadRequests()]);
      if (alive) setLoading(false);
    })();
    const t = setInterval(loadRequests, 8000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [loadInitial, loadRequests]);

  // Merge live rows with history (newest first, dedupe by id)
  const mergedActivity = useMemo<ActivityHistoryRow[]>(() => {
    const seen = new Set<string>();
    const out: ActivityHistoryRow[] = [];
    const live2 = live.newRows.slice().reverse();
    for (const r of live2) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      out.push(r as unknown as ActivityHistoryRow);
    }
    for (const r of history) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      out.push(r);
    }
    return out;
  }, [live.newRows, history]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadInitial(), loadRequests()]);
    setRefreshing(false);
  }, [loadInitial, loadRequests]);

  /* ─── Approve / reject ─── */
  // Shared with the office-wide Delete Requests inbox so the two
  // screens can't drift on what a request looks like or what reviewing
  // one does. This drawer only ever showed board-scoped requests —
  // cases, documents, clients and courts carry no boardId and were
  // invisible here, which is what the inbox now covers.
  const { open: openReview, sheet: reviewSheet } = useDeleteRequestReview(
    (id) => setRequests((prev) => prev.filter((r) => r.id !== id))
  );

  return (
    <View className="flex-1 bg-app-canvas">
      <StatusBar style="dark" backgroundColor="#f4ede0" />
      <SafeAreaView className="flex-1" edges={["top"]}>
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
              className="text-[9px] uppercase text-app-copper-deep"
              style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.6 }}
            >
              Board pulse
            </Text>
            <Text
              className="text-[15px] tracking-tight text-app-ink"
              style={{ fontFamily: "Crimson-SemiBold" }}
              numberOfLines={1}
            >
              Activity
            </Text>
          </View>
          <View className="flex-row items-center" style={{ gap: 4 }}>
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: live.isLive ? "#56a0a8" : "#a89c80",
              }}
            />
            <Text
              className="text-[10px] uppercase"
              style={{
                fontFamily: "DMMono-Medium",
                letterSpacing: 1.2,
                color: "#7a7060",
              }}
            >
              {live.isLive ? "Live" : "Offline"}
            </Text>
          </View>
        </View>

        {/* Stats */}
        {stats ? (
          <View className="px-4 pt-3">
            <View
              className="rounded-xl p-3 flex-row"
              style={{
                backgroundColor: "#ffffff",
                borderWidth: 1,
                borderColor: "#e3d9c0",
                gap: 12,
              }}
            >
              <Stat label="Lists" value={stats.lists} />
              <View
                style={{
                  width: 1,
                  alignSelf: "stretch",
                  backgroundColor: "#efe5d0",
                }}
              />
              <Stat label="Cards" value={stats.cards} />
            </View>
          </View>
        ) : null}

        {/* Tabs */}
        <View className="px-4 pt-3 flex-row" style={{ gap: 6 }}>
          <Tab
            active={tab === "activity"}
            label="Activity"
            badge={live.unreadCount}
            onPress={() => {
              setTab("activity");
              live.markSeen();
            }}
          />
          <Tab
            active={tab === "requests"}
            label={isAdmin ? "Requests" : "My requests"}
            badge={requests.length}
            onPress={() => setTab("requests")}
          />
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#c5853a" />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#c5853a"
              />
            }
            showsVerticalScrollIndicator={false}
          >
            {tab === "activity" ? (
              mergedActivity.length === 0 ? (
                <EmptyState
                  icon="activity"
                  title="Nothing yet"
                  body="Add a card, move one between lists, or connect two lists — it'll all show up here."
                />
              ) : (
                <View style={{ gap: 8 }}>
                  {mergedActivity.map((row) => (
                    <ActivityRow key={row.id} row={row} />
                  ))}
                </View>
              )
            ) : requests.length === 0 ? (
              <EmptyState
                icon="check-circle"
                title="Nothing pending"
                body={
                  isAdmin
                    ? "When someone in the office asks to delete a non-empty list or card, you'll review it here."
                    : "When you can't direct-delete something, your reason lands here for the admin to approve."
                }
              />
            ) : (
              <View style={{ gap: 10 }}>
                {requests.map((r) => (
                  <DeleteRequestCard
                    key={r.id}
                    row={r}
                    isAdmin={isAdmin}
                    onApprove={() => openReview(r.id, "approve")}
                    onReject={() => openReview(r.id, "reject")}
                  />
                ))}
              </View>
            )}
          </ScrollView>
        )}
      </SafeAreaView>

      {/* Review note modal */}
      {reviewSheet}
    </View>
  );
}

/* ─── Building blocks ─── */

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View className="flex-1">
      <Text
        className="text-[10px] uppercase text-app-fg-muted"
        style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.4 }}
      >
        {label}
      </Text>
      <Text
        className="mt-1 text-[24px] tracking-tight text-app-ink tabular-nums"
        style={{ fontFamily: "Crimson-SemiBold" }}
      >
        {value}
      </Text>
    </View>
  );
}

function Tab({
  active,
  label,
  badge,
  onPress,
}: {
  active: boolean;
  label: string;
  badge: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center rounded-md px-3 py-2 active:opacity-70"
      style={{
        backgroundColor: active ? "#0a1124" : "#ffffff",
        borderWidth: 1,
        borderColor: active ? "#0a1124" : "#e3d9c0",
        gap: 6,
      }}
    >
      <Text
        className="text-[12px]"
        style={{
          fontFamily: "Manrope-SemiBold",
          color: active ? "#f5ebd6" : "#0a1124",
        }}
      >
        {label}
      </Text>
      {badge > 0 ? (
        <View
          className="rounded-full items-center justify-center"
          style={{
            minWidth: 18,
            height: 18,
            paddingHorizontal: 5,
            backgroundColor: active ? "#c5853a" : "#c14a37",
          }}
        >
          <Text
            className="text-[9px]"
            style={{
              fontFamily: "DMMono-Medium",
              color: "#ffffff",
            }}
          >
            {badge > 99 ? "99" : badge}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function EmptyState({
  icon,
  title,
  body,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  body: string;
}) {
  return (
    <View
      className="rounded-xl px-5 py-12 items-center"
      style={{
        backgroundColor: "#ffffff",
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor: "#e3d9c0",
      }}
    >
      <View
        className="h-12 w-12 items-center justify-center rounded-full"
        style={{ backgroundColor: "#efe5d0" }}
      >
        <Feather name={icon} size={20} color="#8a5821" />
      </View>
      <Text
        className="mt-3 text-[16px] tracking-tight text-app-ink"
        style={{ fontFamily: "Crimson-SemiBold" }}
      >
        {title}
      </Text>
      <Text
        className="mt-1 text-[12px] text-app-fg-muted text-center"
        style={{ fontFamily: "Manrope" }}
      >
        {body}
      </Text>
    </View>
  );
}

function ActivityRow({ row }: { row: ActivityHistoryRow }) {
  const stripped = row.message.replace(/\*\*/g, "");
  const time = new Date(row.createdAt);
  const timeLabel = time.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <View
      className="rounded-xl px-3.5 py-3"
      style={{
        backgroundColor: "#ffffff",
        borderWidth: 1,
        borderColor: "#e3d9c0",
      }}
    >
      <View className="flex-row items-center" style={{ gap: 8 }}>
        <View
          className="h-7 w-7 items-center justify-center rounded-full"
          style={{ backgroundColor: "#0a1124" }}
        >
          <Text
            className="text-[10px]"
            style={{
              fontFamily: "Manrope-SemiBold",
              color: "#f5ebd6",
              letterSpacing: 0.5,
            }}
          >
            {initials(row.actorName)}
          </Text>
        </View>
        <Text
          className="flex-1 text-[13px] text-app-ink"
          style={{ fontFamily: "Manrope-SemiBold" }}
          numberOfLines={1}
        >
          {row.actorName}
        </Text>
        <Text
          className="text-[10px] tabular-nums"
          style={{
            fontFamily: "DMMono-Medium",
            color: "#a89c80",
            letterSpacing: 0.4,
          }}
        >
          {timeLabel}
        </Text>
      </View>
      <Text
        className="mt-2 text-[12px] text-app-fg-soft"
        style={{ fontFamily: "Manrope" }}
        numberOfLines={3}
      >
        {stripped}
      </Text>
    </View>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
