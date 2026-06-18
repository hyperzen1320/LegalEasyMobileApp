import { useCallback, useMemo, useRef, useState } from "react";
import { View, Text } from "react-native";
import { Gesture } from "react-native-gesture-handler";
import Animated, {
  scrollTo,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  runOnJS,
  type AnimatedRef,
  type SharedValue,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import type { CanvasList } from "../../../lib/api";

// Long-press drag & drop for whole LISTS/COLUMNS on the horizontal Kanban.
// This is the column-level sibling of useBoardDnd (which drags cards) and
// it deliberately reuses the same trick stack so the two never fight:
//  • Gesture.Pan().activateAfterLongPress(280) attached ONLY to the list
//    HEADER (stripe + title row). Before activation any movement belongs
//    to the horizontal ScrollView, so scrolling is untouched; after
//    activation the board flips `scrollEnabled` off (programmatic scrollTo
//    still works — that's what autoscroll needs).
//  • The board's columns are fixed width with a known gap + content
//    padding, so the target slot is pure arithmetic: take the finger's
//    content-space X (panX + horizontal scroll offset), divide by the
//    column stride, clamp into range.
//  • While dragging we publish a live `previewOrder` (the ordered list-id
//    array with the grabbed column moved to the hovered slot). The board
//    renders columns in that order so the others physically shift to make
//    room, the grabbed one rides as a dimmed placeholder, and a floating
//    clone of the header follows the finger above everything.
//  • Horizontal autoscroll runs on the UI thread (frame callback +
//    scrollTo) exactly like the card hook.
// Card drag (useBoardDnd) owns the cards body; this hook owns the header.
// They share neither gesture nor scroll-disable path beyond the board
// toggling `scrollEnabled`, so there is no cross-talk.

const EDGE_BAND = 56; // px from screen edge that triggers h-autoscroll
const HIT_THROTTLE_MS = 60;
const CONTENT_PADDING = 16; // horizontal ScrollView contentContainer padding
const COLUMN_GAP = 12;

function moveItem<T>(arr: T[], from: number, to: number): T[] {
  if (from === to) return arr.slice();
  const next = arr.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function useListDnd(opts: {
  listWidth: number;
  screenWidth: number;
  lists: CanvasList[]; // sorted by sortOrder
  isTemp: (id: string) => boolean;
  onReorder: (orderedListIds: string[]) => void;
  // The board mounts a single horizontal Animated.ScrollView; the card-drag
  // hook owns its ref/handler and we share its offset so column autoscroll
  // and hit-testing read the exact same scroll position.
  hScrollRef: AnimatedRef<Animated.ScrollView>;
  hScrollOffset: SharedValue<number>;
}) {
  const {
    listWidth,
    screenWidth,
    lists,
    isTemp,
    onReorder,
    hScrollRef,
    hScrollOffset,
  } = opts;

  // The grabbed list and the live preview order (ids), or null when idle.
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [previewOrder, setPreviewOrder] = useState<string[] | null>(null);

  const draggingIdRef = useRef<string | null>(null);
  const previewOrderRef = useRef<string[] | null>(null);
  const baseOrderRef = useRef<string[]>([]); // ids in their pre-drag order
  const lastHitRef = useRef(0);

  // The header content we float as the clone (title + stripe colour).
  const [ghost, setGhost] = useState<{
    title: string;
    color: string;
    count: number;
  } | null>(null);

  // Shared values driving the overlay + autoscroll on the UI thread.
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const grabDX = useSharedValue(0);
  const grabDY = useSharedValue(0);
  const draggingSV = useSharedValue(false);
  const screenWSV = useSharedValue(screenWidth);
  screenWSV.value = screenWidth;

  // Keep a stable, sorted snapshot of the *real* ids for index math. We
  // read from `lists` directly so it always reflects the latest props.
  const realIds = useMemo(() => lists.map((l) => l.id), [lists]);

  /* ─── Hit-testing (JS, throttled) ─── */
  const hitTest = useCallback(
    (ax: number) => {
      const dragId = draggingIdRef.current;
      const base = baseOrderRef.current;
      if (!dragId || base.length === 0) return;
      const now = Date.now();
      if (now - lastHitRef.current < HIT_THROTTLE_MS) return;
      lastHitRef.current = now;

      // Hovered slot from content-space X. Stride is column width + gap.
      const contentX = ax + hScrollOffset.value;
      const stride = listWidth + COLUMN_GAP;
      const raw = Math.floor((contentX - CONTENT_PADDING) / stride);
      const targetIdx = Math.max(0, Math.min(raw, base.length - 1));

      const next = moveItem(
        base,
        base.indexOf(dragId),
        targetIdx
      );
      const prev = previewOrderRef.current;
      // Only publish when the order actually changes — avoids churning
      // the board's render tree every throttled tick.
      if (!prev || !sameOrder(prev, next)) {
        previewOrderRef.current = next;
        setPreviewOrder(next);
        Haptics.selectionAsync();
      }
    },
    [listWidth, hScrollOffset]
  );

  /* ─── Drag lifecycle (JS) ─── */
  const beginDrag = useCallback(
    (list: CanvasList, count: number) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      // Snapshot the real order at grab time; all index math runs against
      // this so a stray live-feed refetch can't desync the preview.
      const base = realIds.slice();
      baseOrderRef.current = base;
      draggingIdRef.current = list.id;
      previewOrderRef.current = base;
      setDraggingId(list.id);
      setPreviewOrder(base);
      setGhost({
        title: list.title,
        color: list.color || "#c5853a",
        count,
      });
      lastHitRef.current = 0;
    },
    [realIds]
  );

  const endDrag = useCallback(() => {
    const dragId = draggingIdRef.current;
    const base = baseOrderRef.current;
    const final = previewOrderRef.current;
    draggingIdRef.current = null;
    previewOrderRef.current = null;
    setDraggingId(null);
    setPreviewOrder(null);
    setGhost(null);
    if (!dragId || !final) return;
    // No-op drop (released in the same slot) — skip the network call.
    if (sameOrder(base, final)) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onReorder(final);
  }, [onReorder]);

  /* ─── Per-header gesture ─── */
  const makeHeaderGesture = useCallback(
    (list: CanvasList, count: number) =>
      Gesture.Pan()
        .enabled(!isTemp(list.id) && lists.length > 1)
        .activateAfterLongPress(280)
        .shouldCancelWhenOutside(false)
        .onStart((e) => {
          dragX.value = e.absoluteX;
          dragY.value = e.absoluteY;
          grabDX.value = e.x;
          grabDY.value = e.y;
          draggingSV.value = true;
          runOnJS(beginDrag)(list, count);
        })
        .onUpdate((e) => {
          dragX.value = e.absoluteX;
          dragY.value = e.absoluteY;
          runOnJS(hitTest)(e.absoluteX);
        })
        .onFinalize(() => {
          draggingSV.value = false;
          runOnJS(endDrag)();
        }),
    [
      isTemp,
      lists.length,
      beginDrag,
      hitTest,
      endDrag,
      dragX,
      dragY,
      grabDX,
      grabDY,
      draggingSV,
    ]
  );

  /* ─── Horizontal autoscroll (UI thread) ─── */
  useFrameCallback(() => {
    "worklet";
    if (!draggingSV.value) return;
    const x = dragX.value;
    let delta = 0;
    if (x < EDGE_BAND) {
      delta = -(8 + Math.round((EDGE_BAND - x) / 5));
    } else if (x > screenWSV.value - EDGE_BAND) {
      delta = 8 + Math.round((x - (screenWSV.value - EDGE_BAND)) / 5);
    }
    if (delta !== 0) {
      const next = Math.max(0, hScrollOffset.value + delta);
      scrollTo(hScrollRef, next, 0, false);
    }
  }, true);

  /* ─── Floating clone (column header) ─── */
  const overlayStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: dragX.value - grabDX.value },
      { translateY: dragY.value - grabDY.value },
      { scale: 1.05 },
    ],
  }));

  const overlay = useMemo(() => {
    if (!ghost) return null;
    return (
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: "absolute",
            top: 0,
            left: 0,
            width: listWidth,
            backgroundColor: "rgba(255,255,255,0.98)",
            borderRadius: 14,
            overflow: "hidden",
            shadowColor: "#0a1124",
            shadowOpacity: 0.3,
            shadowRadius: 18,
            shadowOffset: { width: 0, height: 10 },
            elevation: 16,
          },
          overlayStyle,
        ]}
      >
        {/* Top stripe mirrors the real column header */}
        <View style={{ height: 4, backgroundColor: ghost.color }} />
        <View
          className="px-3 pt-3 pb-3 flex-row items-center"
          style={{ gap: 6 }}
        >
          <Text
            className="flex-1 text-[14px] tracking-tight text-app-ink"
            style={{ fontFamily: "Crimson-SemiBold" }}
            numberOfLines={1}
          >
            {ghost.title}
          </Text>
          {ghost.count > 0 ? (
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
                {ghost.count}
              </Text>
            </View>
          ) : null}
        </View>
      </Animated.View>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ghost, listWidth]);

  return {
    draggingListId: draggingId,
    isDragging: draggingId !== null,
    // Ordered id array to render columns by while dragging (null when idle).
    previewOrder,
    overlay,
    makeHeaderGesture,
  };
}

function sameOrder(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
