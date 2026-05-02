import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";

import {
  partnerActivityHistory,
  partnerListDeleteRequests,
  partnerApproveDeleteRequest,
  partnerRejectDeleteRequest,
  partnerGetBoardFull,
  type ActivityHistoryRow,
  type DeleteRequestRow,
} from "../../../../lib/api";
import { useBoardLiveFeed } from "../../../../lib/useBoardLiveFeed";

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
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewMode, setReviewMode] = useState<"approve" | "reject" | null>(
    null
  );

  function openReview(id: string, mode: "approve" | "reject") {
    setReviewingId(id);
    setReviewNote("");
    setReviewMode(mode);
  }

  async function commitReview() {
    if (!reviewingId || !reviewMode) return;
    try {
      if (reviewMode === "approve") {
        await partnerApproveDeleteRequest(reviewingId, reviewNote);
      } else {
        await partnerRejectDeleteRequest(reviewingId, reviewNote);
      }
      setRequests((prev) => prev.filter((r) => r.id !== reviewingId));
    } catch (err) {
      Alert.alert(
        "Couldn't submit review",
        err instanceof Error ? err.message : "Try again."
      );
    } finally {
      setReviewingId(null);
      setReviewNote("");
      setReviewMode(null);
    }
  }

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
                  <RequestRow
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
      <Modal
        visible={Boolean(reviewingId && reviewMode)}
        transparent
        animationType="fade"
        onRequestClose={() => setReviewingId(null)}
      >
        <Pressable
          onPress={() => setReviewingId(null)}
          className="flex-1 justify-center"
          style={{
            backgroundColor: "rgba(10,17,36,0.55)",
            paddingHorizontal: 20,
          }}
        >
          <Pressable
            className="rounded-2xl"
            style={{
              backgroundColor: "#ffffff",
              padding: 18,
            }}
            onPress={() => {
              /* swallow */
            }}
          >
            <Text
              className="text-[10px] uppercase text-app-copper-deep"
              style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.6 }}
            >
              {reviewMode === "approve" ? "Approve" : "Reject"}
            </Text>
            <Text
              className="mt-0.5 text-[18px] tracking-tight text-app-ink"
              style={{ fontFamily: "Crimson-SemiBold" }}
            >
              Add a note (optional)
            </Text>
            <TextInput
              value={reviewNote}
              onChangeText={setReviewNote}
              placeholder="Optional context for the requester."
              placeholderTextColor="#a89c80"
              multiline
              style={{
                marginTop: 12,
                borderWidth: 1,
                borderColor: "#e3d9c0",
                borderRadius: 8,
                paddingHorizontal: 12,
                paddingVertical: 10,
                fontFamily: "Manrope",
                fontSize: 13,
                color: "#0a1124",
                minHeight: 64,
                textAlignVertical: "top",
              }}
            />
            <View className="mt-3 flex-row" style={{ gap: 8 }}>
              <Pressable
                onPress={() => {
                  setReviewingId(null);
                  setReviewMode(null);
                }}
                className="flex-1 rounded-md py-3 items-center active:opacity-50"
                style={{
                  backgroundColor: "#ffffff",
                  borderWidth: 1,
                  borderColor: "#e3d9c0",
                }}
              >
                <Text
                  className="text-[13px]"
                  style={{ fontFamily: "Manrope-Medium", color: "#4d4538" }}
                >
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={commitReview}
                className="flex-[1.4] rounded-md py-3 items-center"
                style={{
                  backgroundColor:
                    reviewMode === "approve" ? "#56a0a8" : "#c14a37",
                }}
              >
                <Text
                  className="text-[13px]"
                  style={{ fontFamily: "Manrope-SemiBold", color: "#ffffff" }}
                >
                  {reviewMode === "approve" ? "Approve" : "Reject"}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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

function RequestRow({
  row,
  isAdmin,
  onApprove,
  onReject,
}: {
  row: DeleteRequestRow;
  isAdmin: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
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
          style={{ backgroundColor: "#c14a37" }}
        >
          <Feather name="trash-2" size={11} color="#ffffff" />
        </View>
        <View className="flex-1">
          <Text
            className="text-[13px] text-app-ink"
            style={{ fontFamily: "Manrope-SemiBold" }}
            numberOfLines={1}
          >
            {row.requesterName}
          </Text>
          <Text
            className="text-[10px] uppercase mt-0.5"
            style={{
              fontFamily: "DMMono-Medium",
              letterSpacing: 1.2,
              color: "#7a7060",
            }}
          >
            wants to delete {row.targetType} · {row.targetName}
          </Text>
        </View>
      </View>
      <Text
        className="mt-2 text-[12px] text-app-fg-soft"
        style={{ fontFamily: "Manrope", fontStyle: "italic" }}
      >
        “{row.reason}”
      </Text>

      {isAdmin ? (
        <View className="mt-3 flex-row" style={{ gap: 8 }}>
          <Pressable
            onPress={onReject}
            className="flex-1 rounded-md py-2.5 items-center active:opacity-70"
            style={{
              backgroundColor: "#ffffff",
              borderWidth: 1,
              borderColor: "#c14a37",
            }}
          >
            <Text
              className="text-[12px]"
              style={{ fontFamily: "Manrope-SemiBold", color: "#c14a37" }}
            >
              Reject
            </Text>
          </Pressable>
          <Pressable
            onPress={onApprove}
            className="flex-1 rounded-md py-2.5 items-center active:opacity-70"
            style={{ backgroundColor: "#56a0a8" }}
          >
            <Text
              className="text-[12px]"
              style={{ fontFamily: "Manrope-SemiBold", color: "#ffffff" }}
            >
              Approve
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
