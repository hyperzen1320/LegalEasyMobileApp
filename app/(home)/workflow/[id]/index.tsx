import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

import {
  partnerGetBoardFull,
  partnerCreateList,
  partnerCreateTask,
  partnerMoveTask,
  partnerDeleteTask,
  partnerDeleteRequestCount,
  deleteRequestRequired,
  ApiError,
  type BoardFullResponse,
  type CanvasList,
  type CanvasEdge,
  type PreviewTask,
  type DeleteRequestRequiredError,
} from "../../../../lib/api";
import { BOARD_COLOR_STYLES } from "../../../../components/BoardColors";
import { useBoardLiveFeed } from "../../../../lib/useBoardLiveFeed";
import { useBoardPresence } from "../../../../lib/useBoardPresence";

import CardItem from "../../../../components/workflow/CardItem";
import AddCardComposer from "../../../../components/workflow/AddCardComposer";
import AddListComposer from "../../../../components/workflow/AddListComposer";
import EdgePill from "../../../../components/workflow/EdgePill";
import CardActionsSheet from "../../../../components/workflow/CardActionsSheet";
import RequestDeleteSheet from "../../../../components/workflow/RequestDeleteSheet";
import { useBreakpoint } from "../../../../lib/useBreakpoint";
import ExportSheet from "../../../../components/ExportSheet";
import { exportBoardXlsx } from "../../../../lib/exports";

const TEMP_PREFIX = "tmp:";

function tempId(): string {
  return `${TEMP_PREFIX}${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

function isTemp(id: string): boolean {
  return id.startsWith(TEMP_PREFIX);
}

export default function BoardDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const boardId = String(id);
  const router = useRouter();

  // Compact keeps a peek of the next column (the "there's more" cue);
  // bigger windows get fixed, comfortable column widths and free scroll.
  const { bp, width: windowWidth, isExpanded } = useBreakpoint();
  const listWidth =
    bp === "compact"
      ? Math.min(300, Math.round(windowWidth * 0.78))
      : bp === "medium"
        ? 320
        : 340;

  const [data, setData] = useState<BoardFullResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  // Long-press card sheet + smart-delete sheet state
  const [activeCard, setActiveCard] = useState<PreviewTask | null>(null);
  const [requestTarget, setRequestTarget] =
    useState<DeleteRequestRequiredError | null>(null);

  const live = useBoardLiveFeed({ boardId });
  const presence = useBoardPresence(boardId);

  /* ─── Load + refresh ─── */
  const load = useCallback(async () => {
    try {
      const res = await partnerGetBoardFull(boardId);
      setData(res);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load board");
    }
  }, [boardId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      await load();
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [load]);

  // Refresh on focus (returning from card detail / drawer)
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Live-feed reconcile: on any cross-user list/task event, refetch.
  // Debounced via the ref so a burst doesn't spam refetches.
  const lastFeedIndex = useRef(0);
  const resyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const start = lastFeedIndex.current;
    if (start >= live.newRows.length) return;
    const fresh = live.newRows.slice(start);
    lastFeedIndex.current = live.newRows.length;
    const myId = data?.currentUserId;

    let needsResync = false;
    for (const row of fresh) {
      if (myId && row.actorUserId === myId) continue;
      if (
        row.action.startsWith("task.") ||
        row.action.startsWith("list.") ||
        row.action.startsWith("board.") ||
        row.action === "delete_request.approved"
      ) {
        needsResync = true;
        break;
      }
    }
    if (!needsResync) return;
    if (resyncTimer.current) return;
    resyncTimer.current = setTimeout(() => {
      resyncTimer.current = null;
      load();
    }, 800);
  }, [live.newRows, data?.currentUserId, load]);

  // Pending delete-requests badge (admin only effectively)
  useEffect(() => {
    let alive = true;
    const fetchCount = async () => {
      try {
        const res = await partnerDeleteRequestCount({ boardId });
        if (alive) setPendingCount(res.count || 0);
      } catch {
        /* ignore */
      }
    };
    fetchCount();
    const t = setInterval(fetchCount, 10_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [boardId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  /* ─── Derived: tasks grouped by list, edges keyed by list ─── */
  const tasksByList = useMemo(() => {
    const map = new Map<string, PreviewTask[]>();
    if (!data) return map;
    for (const list of data.lists) map.set(list.id, []);
    for (const t of data.tasks) {
      const arr = map.get(t.listId);
      if (arr) arr.push(t);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => a.sortOrder - b.sortOrder);
    }
    return map;
  }, [data]);

  const edgesByList = useMemo(() => {
    const map = new Map<
      string,
      { incoming: CanvasEdge[]; outgoing: CanvasEdge[] }
    >();
    if (!data) return map;
    for (const list of data.lists) {
      map.set(list.id, { incoming: [], outgoing: [] });
    }
    for (const e of data.edges) {
      map.get(e.targetListId)?.incoming.push(e);
      map.get(e.sourceListId)?.outgoing.push(e);
    }
    return map;
  }, [data]);

  const listTitleById = useMemo(() => {
    const m = new Map<string, string>();
    if (!data) return m;
    for (const l of data.lists) m.set(l.id, l.title);
    return m;
  }, [data]);

  /* ─── Mutations: optimistic ─── */
  const addList = useCallback(
    async (title: string) => {
      if (!data) return;
      const tmp = tempId();
      const optimistic: CanvasList = {
        id: tmp,
        title,
        sortOrder: data.lists.length,
        position: { x: 0, y: 0 },
        width: listWidth,
        color: null,
      };
      setData((prev) =>
        prev
          ? {
              ...prev,
              lists: [...prev.lists, optimistic],
            }
          : prev
      );
      try {
        const res = await partnerCreateList(boardId, { title });
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            lists: prev.lists.map((l) =>
              l.id === tmp
                ? { ...l, id: res.list.id, sortOrder: res.list.sortOrder }
                : l
            ),
          };
        });
      } catch (err) {
        setData((prev) =>
          prev
            ? { ...prev, lists: prev.lists.filter((l) => l.id !== tmp) }
            : prev
        );
        Alert.alert(
          "Couldn't create list",
          err instanceof ApiError ? err.message : "Try again."
        );
      }
    },
    [data, boardId, listWidth]
  );

  const addCard = useCallback(
    async (listId: string, title: string) => {
      if (!data) return;
      const tmp = tempId();
      const optimistic: PreviewTask = {
        id: tmp,
        listId,
        title,
        description: "",
        sortOrder: Number.MAX_SAFE_INTEGER,
        assignee: null,
        dueDate: null,
        priority: null,
        checklistSummary: { totalChecklists: 0, totalItems: 0, doneItems: 0 },
        hasDescription: false,
        updatedAt: new Date().toISOString(),
      };
      setData((prev) =>
        prev ? { ...prev, tasks: [...prev.tasks, optimistic] } : prev
      );
      try {
        const res = await partnerCreateTask(boardId, { listId, title });
        setData((prev) =>
          prev
            ? {
                ...prev,
                tasks: prev.tasks.map((t) =>
                  t.id === tmp ? (res.task as PreviewTask) : t
                ),
              }
            : prev
        );
      } catch (err) {
        setData((prev) =>
          prev
            ? { ...prev, tasks: prev.tasks.filter((t) => t.id !== tmp) }
            : prev
        );
        Alert.alert(
          "Couldn't add card",
          err instanceof ApiError ? err.message : "Try again."
        );
      }
    },
    [data, boardId]
  );

  const moveCard = useCallback(
    async (taskId: string, toListId: string) => {
      if (!data) return;
      // Optimistic: update locally first
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          tasks: prev.tasks.map((t) =>
            t.id === taskId ? { ...t, listId: toListId } : t
          ),
        };
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      try {
        const dest = data.tasks.filter(
          (t) => t.listId === toListId && t.id !== taskId
        );
        await partnerMoveTask(taskId, {
          toListId,
          toIndex: dest.length,
        });
      } catch (err) {
        // rollback
        load();
        Alert.alert(
          "Couldn't move card",
          err instanceof ApiError ? err.message : "Try again."
        );
      }
    },
    [data, load]
  );

  const deleteCard = useCallback(
    async (task: PreviewTask) => {
      // Snapshot for rollback
      const snapshot = data;
      setData((prev) =>
        prev ? { ...prev, tasks: prev.tasks.filter((t) => t.id !== task.id) } : prev
      );
      try {
        await partnerDeleteTask(task.id);
      } catch (err) {
        // Restore on any failure (network, 403, …)
        setData(snapshot);
        const reqd = deleteRequestRequired(err);
        if (reqd) {
          setRequestTarget(reqd);
          return;
        }
        Alert.alert(
          "Couldn't delete card",
          err instanceof ApiError ? err.message : "Try again."
        );
      }
    },
    [data]
  );

  /* ─── Header data ─── */
  const board = data?.board;
  const styles = board
    ? BOARD_COLOR_STYLES[board.color] ?? BOARD_COLOR_STYLES.copper
    : BOARD_COLOR_STYLES.copper;
  const totalLists = data?.lists.length ?? 0;
  const totalCards = data?.tasks.length ?? 0;

  return (
    <View className="flex-1 bg-app-canvas">
      <StatusBar style="dark" backgroundColor="#f4ede0" />
      <SafeAreaView className="flex-1" edges={["top"]}>
        <Header
          title={board?.title ?? "…"}
          accent={styles.accent}
          gradient={styles.gradient}
          totalLists={totalLists}
          totalCards={totalCards}
          presenceCount={presence.length}
          unreadCount={live.unreadCount + pendingCount}
          onBack={() => router.back()}
          onExport={data ? () => setExporting(true) : null}
          onBell={() => {
            live.markSeen();
            router.push(
              `/(home)/workflow/${boardId}/activity` as never
            );
          }}
        />

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#c5853a" size="large" />
          </View>
        ) : error ? (
          <View className="flex-1 items-center justify-center px-8">
            <Feather name="alert-circle" size={28} color="#c14a37" />
            <Text
              className="mt-3 text-[14px] text-app-fg-soft text-center"
              style={{ fontFamily: "Manrope" }}
            >
              {error}
            </Text>
            <Pressable
              onPress={load}
              className="mt-4 rounded-md px-4 py-2 active:opacity-50"
              style={{ backgroundColor: "#0a1124" }}
            >
              <Text
                className="text-[12px]"
                style={{
                  fontFamily: "Manrope-SemiBold",
                  color: "#f5ebd6",
                }}
              >
                Retry
              </Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            // Free scroll once three-plus columns fit; snapping fights
            // the user when the viewport already shows several lists.
            snapToInterval={isExpanded ? undefined : listWidth + 12}
            snapToAlignment="start"
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingVertical: 14,
              gap: 12,
              alignItems: "flex-start",
            }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#c5853a"
              />
            }
          >
            {data!.lists
              .slice()
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((list) => (
                <ListColumn
                  key={list.id}
                  list={list}
                  listWidth={listWidth}
                  tasks={tasksByList.get(list.id) || []}
                  edges={
                    edgesByList.get(list.id) || {
                      incoming: [],
                      outgoing: [],
                    }
                  }
                  listTitleById={listTitleById}
                  accent={styles.accent}
                  onAddCard={(title) => addCard(list.id, title)}
                  onCardPress={(task) =>
                    router.push(
                      `/(home)/workflow/${boardId}/card/${task.id}` as never
                    )
                  }
                  onCardLongPress={(task) => setActiveCard(task)}
                />
              ))}
            <AddListComposer
              accent={styles.accent}
              width={listWidth}
              onSubmit={(title) => addList(title)}
            />
            {/* trailing spacer so the last list doesn't sit flush with the edge */}
            <View style={{ width: 4 }} />
          </ScrollView>
        )}
      </SafeAreaView>

      {/* Long-press sheet */}
      <CardActionsSheet
        visible={Boolean(activeCard)}
        cardTitle={activeCard?.title ?? ""}
        currentListId={activeCard?.listId ?? ""}
        lists={(data?.lists ?? []).map((l) => ({ id: l.id, title: l.title }))}
        onClose={() => setActiveCard(null)}
        onMoveToList={(toId) => {
          if (activeCard) moveCard(activeCard.id, toId);
        }}
        onOpen={() => {
          if (activeCard) {
            router.push(
              `/(home)/workflow/${boardId}/card/${activeCard.id}` as never
            );
          }
        }}
        onDelete={() => {
          if (activeCard) deleteCard(activeCard);
        }}
      />

      {/* Smart-delete reason sheet */}
      <RequestDeleteSheet
        target={requestTarget}
        onClose={() => setRequestTarget(null)}
        onSubmitted={() => {
          setRequestTarget(null);
          Alert.alert(
            "Sent for review",
            "The office admin has been notified."
          );
        }}
      />

      {/* Board data export — xlsx is the only server-side board format;
          the PNG/PDF snapshot ships with the drag-drop phase. */}
      <ExportSheet
        visible={exporting}
        onClose={() => setExporting(false)}
        eyebrow="Workflow"
        title="Export board data"
        contextLine={`${totalLists} lists · ${totalCards} cards`}
        formats={["xlsx"]}
        run={() => exportBoardXlsx(boardId, board?.title ?? "board")}
      />
    </View>
  );
}

/* ─── Header ─── */

function Header({
  title,
  accent,
  gradient,
  totalLists,
  totalCards,
  presenceCount,
  unreadCount,
  onBack,
  onExport,
  onBell,
}: {
  title: string;
  accent: string;
  gradient: readonly string[] | string[];
  totalLists: number;
  totalCards: number;
  presenceCount: number;
  unreadCount: number;
  onBack: () => void;
  onExport?: (() => void) | null;
  onBell: () => void;
}) {
  return (
    <View
      className="border-b border-app-edge bg-app-canvas px-4 pt-2 pb-3 flex-row items-center"
      style={{ gap: 10 }}
    >
      <Pressable
        onPress={onBack}
        hitSlop={10}
        className="active:opacity-50 h-9 w-9 items-center justify-center rounded-md"
        style={{ backgroundColor: "#ffffff" }}
        accessibilityLabel="Back"
      >
        <Feather name="arrow-left" size={17} color="#0a1124" />
      </Pressable>
      <View
        className="h-9 w-9 items-center justify-center rounded-md"
        style={{ overflow: "hidden" }}
      >
        <LinearGradient
          colors={gradient as [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderRadius: 6,
          }}
        />
        <Feather name="grid" size={15} color="#ffffff" />
      </View>
      <View className="flex-1 min-w-0">
        <Text
          className="text-[9px] uppercase text-app-copper-deep"
          style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.6 }}
        >
          Workflow
        </Text>
        <Text
          className="text-[15px] tracking-tight text-app-ink"
          style={{ fontFamily: "Crimson-SemiBold" }}
          numberOfLines={1}
        >
          {title}
        </Text>
      </View>

      {/* Stats chip */}
      <View
        className="rounded-md px-2 py-1"
        style={{ backgroundColor: "#efe5d0" }}
      >
        <Text
          className="text-[10px] tabular-nums uppercase"
          style={{
            fontFamily: "DMMono-Medium",
            letterSpacing: 0.6,
            color: "#4d4538",
          }}
        >
          <Text style={{ color: "#0a1124" }}>{totalLists}</Text> ·{" "}
          <Text style={{ color: "#0a1124" }}>{totalCards}</Text>
        </Text>
      </View>

      {/* Presence dot */}
      {presenceCount > 1 ? (
        <View className="flex-row items-center" style={{ gap: 4 }}>
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: "#56a0a8",
            }}
          />
          <Text
            className="text-[10px]"
            style={{ fontFamily: "DMMono-Medium", color: "#4d4538" }}
          >
            {presenceCount}
          </Text>
        </View>
      ) : null}

      {/* Export */}
      {onExport ? (
        <Pressable
          onPress={onExport}
          hitSlop={6}
          className="active:opacity-50 h-9 w-9 items-center justify-center rounded-md"
          style={{ backgroundColor: "#ffffff" }}
          accessibilityLabel="Export board data"
        >
          <Feather name="download" size={15} color={accent} />
        </Pressable>
      ) : null}

      {/* Bell */}
      <Pressable
        onPress={onBell}
        hitSlop={6}
        className="relative active:opacity-50 h-9 w-9 items-center justify-center rounded-md"
        style={{ backgroundColor: "#ffffff" }}
        accessibilityLabel="Open activity"
      >
        <Feather name="bell" size={15} color={accent} />
        {unreadCount > 0 ? (
          <View
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              minWidth: 16,
              height: 16,
              paddingHorizontal: 4,
              borderRadius: 8,
              backgroundColor: "#c14a37",
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 2,
              borderColor: "#f4ede0",
            }}
          >
            <Text
              style={{
                fontFamily: "DMMono-Medium",
                fontSize: 9,
                color: "#ffffff",
              }}
            >
              {unreadCount > 99 ? "99" : unreadCount}
            </Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

/* ─── List column ─── */

function ListColumn({
  list,
  listWidth,
  tasks,
  edges,
  listTitleById,
  accent,
  onAddCard,
  onCardPress,
  onCardLongPress,
}: {
  list: CanvasList;
  listWidth: number;
  tasks: PreviewTask[];
  edges: { incoming: CanvasEdge[]; outgoing: CanvasEdge[] };
  listTitleById: Map<string, string>;
  accent: string;
  onAddCard: (title: string) => void;
  onCardPress: (task: PreviewTask) => void;
  onCardLongPress: (task: PreviewTask) => void;
}) {
  const stripe = list.color || accent;
  const isPending = isTemp(list.id);

  return (
    <View
      style={{
        width: listWidth,
        backgroundColor: "rgba(255,255,255,0.92)",
        borderRadius: 14,
        overflow: "hidden",
        opacity: isPending ? 0.7 : 1,
        shadowColor: "#0a1124",
        shadowOpacity: 0.08,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 3,
      }}
    >
      {/* Top stripe */}
      <View style={{ height: 4, backgroundColor: stripe }} />

      {/* Header */}
      <View
        className="px-3 pt-3 pb-2 flex-row items-center"
        style={{ gap: 6 }}
      >
        <Text
          className="flex-1 text-[14px] tracking-tight text-app-ink"
          style={{ fontFamily: "Crimson-SemiBold" }}
          numberOfLines={1}
        >
          {list.title}
        </Text>
        {tasks.length > 0 ? (
          <View
            className="rounded px-1.5"
            style={{ backgroundColor: "#efe5d0" }}
          >
            <Text
              className="text-[10px] tabular-nums"
              style={{
                fontFamily: "DMMono-Medium",
                color: "#4d4538",
                letterSpacing: 0.4,
              }}
            >
              {tasks.length}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Edges chips */}
      {(edges.incoming.length > 0 || edges.outgoing.length > 0) && (
        <View className="px-3 pb-1" style={{ gap: 4 }}>
          {edges.incoming.slice(0, 2).map((e) => (
            <EdgePill
              key={`in-${e.id}`}
              direction="incoming"
              label={e.label || undefined}
              otherListTitle={listTitleById.get(e.sourceListId) ?? "another"}
              color={e.color || stripe}
            />
          ))}
          {edges.outgoing.slice(0, 2).map((e) => (
            <EdgePill
              key={`out-${e.id}`}
              direction="outgoing"
              label={e.label || undefined}
              otherListTitle={listTitleById.get(e.targetListId) ?? "another"}
              color={e.color || stripe}
            />
          ))}
        </View>
      )}

      {/* Cards body — scrolls vertically inside the list */}
      <ScrollView
        style={{ maxHeight: 480 }}
        contentContainerStyle={{
          paddingHorizontal: 8,
          paddingTop: 4,
          paddingBottom: 4,
          gap: 6,
        }}
        showsVerticalScrollIndicator={false}
      >
        {tasks.length === 0 ? (
          <View
            className="items-center justify-center"
            style={{
              borderWidth: 1,
              borderStyle: "dashed",
              borderColor: "#e3d9c0",
              borderRadius: 8,
              paddingVertical: 18,
            }}
          >
            <Text
              className="text-[10px] uppercase"
              style={{
                fontFamily: "DMMono-Medium",
                letterSpacing: 1.4,
                color: "#a89c80",
              }}
            >
              Empty
            </Text>
          </View>
        ) : (
          tasks.map((t) => (
            <CardItem
              key={t.id}
              task={t}
              onPress={() => onCardPress(t)}
              onLongPress={() => onCardLongPress(t)}
            />
          ))
        )}
      </ScrollView>

      {/* Add card composer */}
      <AddCardComposer onSubmit={onAddCard} />
    </View>
  );
}
