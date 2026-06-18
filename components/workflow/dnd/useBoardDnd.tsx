import { useCallback, useMemo, useRef, useState } from "react";
import { type ScrollView as RNScrollView, View } from "react-native";
import { Gesture } from "react-native-gesture-handler";
import Animated, {
  scrollTo,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  runOnJS,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import CardItem from "../CardItem";
import type { CanvasList, PreviewTask } from "../../../lib/api";

// Long-press drag & drop for the horizontal Kanban. The trick stack:
//  • Gesture.Pan().activateAfterLongPress(300) per card — before 300ms
//    any movement belongs to the ScrollViews, so scrolling is untouched;
//    after activation we flip `scrollEnabled` off everywhere (the
//    kill-switch that wins the gesture war) — programmatic scrollTo
//    still works, which is exactly what autoscroll needs.
//  • Drop zones are arithmetic: columns have fixed width/gap/padding, so
//    the hovered column comes from the finger's content-space X; the
//    insertion index comes from per-column card layout registries.
//  • The floating clone is a reanimated transform at the screen root.
//  • Horizontal autoscroll runs on the UI thread (frame callback +
//    scrollTo); vertical autoscroll nudges the hovered column from the
//    throttled JS hit-test.
// The action-sheet Move flow stays untouched as the accessible fallback.

const EDGE_BAND = 56; // px from screen edge that triggers h-autoscroll
const COLUMN_BAND = 64; // px from column top/bottom for v-autoscroll
const HIT_THROTTLE_MS = 70;
const CONTENT_PADDING = 16; // horizontal ScrollView contentContainer padding
const COLUMN_GAP = 12;

export type DropTarget = { listId: string; index: number };

export function useBoardDnd(opts: {
  listWidth: number;
  screenWidth: number;
  lists: CanvasList[]; // sorted by sortOrder
  tasksByList: Map<string, PreviewTask[]>; // sorted per list
  isTemp: (id: string) => boolean;
  onMove: (taskId: string, toListId: string, toIndex: number) => void;
}) {
  const { listWidth, screenWidth, lists, tasksByList, isTemp, onMove } = opts;

  const [dragging, setDragging] = useState<PreviewTask | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const draggingRef = useRef<PreviewTask | null>(null);
  const dropTargetRef = useRef<DropTarget | null>(null);
  const lastHitRef = useRef(0);

  // Shared values driving the overlay + autoscroll on the UI thread.
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const grabDX = useSharedValue(0);
  const grabDY = useSharedValue(0);
  const draggingSV = useSharedValue(false);
  const screenWSV = useSharedValue(screenWidth);
  screenWSV.value = screenWidth;

  // Horizontal scroll plumbing.
  const hScrollRef = useAnimatedRef<Animated.ScrollView>();
  const hScrollOffset = useSharedValue(0);
  const hScrollHandler = useAnimatedScrollHandler((e) => {
    hScrollOffset.value = e.contentOffset.x;
  });

  // Column registries (JS side).
  const columnScrollRefs = useRef(new Map<string, RNScrollView | null>());
  const columnScrollOffsets = useRef(new Map<string, number>());
  const columnTops = useRef(new Map<string, number>());
  const columnViewportH = useRef(new Map<string, number>());
  const cardLayouts = useRef(new Map<string, Map<string, { y: number; h: number }>>());

  const setColumnScrollRef = useCallback(
    (listId: string, ref: RNScrollView | null) => {
      columnScrollRefs.current.set(listId, ref);
    },
    []
  );
  const onColumnScroll = useCallback((listId: string, y: number) => {
    columnScrollOffsets.current.set(listId, y);
  }, []);
  const setColumnWindowTop = useCallback((listId: string, top: number) => {
    columnTops.current.set(listId, top);
  }, []);
  const setColumnViewportH = useCallback((listId: string, h: number) => {
    columnViewportH.current.set(listId, h);
  }, []);
  const registerCardLayout = useCallback(
    (listId: string, cardId: string, y: number, h: number) => {
      let map = cardLayouts.current.get(listId);
      if (!map) {
        map = new Map();
        cardLayouts.current.set(listId, map);
      }
      map.set(cardId, { y, h });
    },
    []
  );

  /* ─── Hit-testing (JS, throttled) ─── */
  const hitTest = useCallback(
    (ax: number, ay: number) => {
      const drag = draggingRef.current;
      if (!drag || lists.length === 0) return;
      const now = Date.now();
      if (now - lastHitRef.current < HIT_THROTTLE_MS) return;
      lastHitRef.current = now;

      // Hovered column from content-space X.
      const contentX = ax + hScrollOffset.value;
      const raw = Math.floor(
        (contentX - CONTENT_PADDING) / (listWidth + COLUMN_GAP)
      );
      const colIdx = Math.max(0, Math.min(raw, lists.length - 1));
      const list = lists[colIdx];
      if (isTemp(list.id)) return;

      // Vertical autoscroll near the column body's edges.
      const top = columnTops.current.get(list.id);
      const viewH = columnViewportH.current.get(list.id) ?? 0;
      const scrollY = columnScrollOffsets.current.get(list.id) ?? 0;
      if (top !== undefined && viewH > 0) {
        const scroller = columnScrollRefs.current.get(list.id);
        if (scroller) {
          if (ay < top + COLUMN_BAND && scrollY > 0) {
            const next = Math.max(0, scrollY - 16);
            scroller.scrollTo({ y: next, animated: false });
            columnScrollOffsets.current.set(list.id, next);
          } else if (ay > top + viewH - COLUMN_BAND) {
            const next = scrollY + 16;
            scroller.scrollTo({ y: next, animated: false });
            columnScrollOffsets.current.set(list.id, next);
          }
        }
      }

      // Insertion index from the card layout registry. The dragged card
      // itself is skipped so the indicator doesn't oscillate around it.
      const cards = (tasksByList.get(list.id) ?? []).filter(
        (t) => t.id !== drag.id
      );
      const layouts = cardLayouts.current.get(list.id);
      const localY = ay - (top ?? 0) + scrollY;
      let index = cards.length;
      if (layouts) {
        for (let i = 0; i < cards.length; i++) {
          const ly = layouts.get(cards[i].id);
          if (!ly) continue;
          if (localY < ly.y + ly.h / 2) {
            index = i;
            break;
          }
        }
      }

      const prev = dropTargetRef.current;
      if (!prev || prev.listId !== list.id || prev.index !== index) {
        const next = { listId: list.id, index };
        dropTargetRef.current = next;
        setDropTarget(next);
      }
    },
    [lists, tasksByList, listWidth, isTemp, hScrollOffset]
  );

  /* ─── Drag lifecycle (JS) ─── */
  const beginDrag = useCallback(
    (task: PreviewTask) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      draggingRef.current = task;
      setDragging(task);
      lastHitRef.current = 0;
      const cards = tasksByList.get(task.listId) ?? [];
      const idx = cards.findIndex((t) => t.id === task.id);
      const initial = {
        listId: task.listId,
        index: idx >= 0 ? idx : cards.length,
      };
      dropTargetRef.current = initial;
      setDropTarget(initial);
    },
    [tasksByList]
  );

  const endDrag = useCallback(() => {
    const drag = draggingRef.current;
    const target = dropTargetRef.current;
    draggingRef.current = null;
    dropTargetRef.current = null;
    setDragging(null);
    setDropTarget(null);
    if (!drag || !target) return;

    // Translate the indicator position into the server's toIndex
    // semantics (index within the target list AFTER the card leaves its
    // source slot).
    const sourceCards = tasksByList.get(drag.listId) ?? [];
    const sourceIdx = sourceCards.findIndex((t) => t.id === drag.id);
    let toIndex = target.index;
    const sameList = target.listId === drag.listId;
    if (sameList && sourceIdx >= 0 && sourceIdx < target.index) {
      toIndex -= 1;
    }
    if (sameList && toIndex === sourceIdx) return; // no-op drop

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onMove(drag.id, target.listId, Math.max(0, toIndex));
  }, [tasksByList, onMove]);

  /* ─── Per-card gesture ─── */
  const makeGesture = useCallback(
    (task: PreviewTask) =>
      Gesture.Pan()
        .enabled(!isTemp(task.id))
        .activateAfterLongPress(300)
        .shouldCancelWhenOutside(false)
        .onStart((e) => {
          dragX.value = e.absoluteX;
          dragY.value = e.absoluteY;
          grabDX.value = e.x;
          grabDY.value = e.y;
          draggingSV.value = true;
          runOnJS(beginDrag)(task);
        })
        .onUpdate((e) => {
          dragX.value = e.absoluteX;
          dragY.value = e.absoluteY;
          runOnJS(hitTest)(e.absoluteX, e.absoluteY);
        })
        .onFinalize(() => {
          draggingSV.value = false;
          runOnJS(endDrag)();
        }),
    [isTemp, beginDrag, hitTest, endDrag, dragX, dragY, grabDX, grabDY, draggingSV]
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

  /* ─── Floating clone ─── */
  const overlayStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: dragX.value - grabDX.value },
      { translateY: dragY.value - grabDY.value },
      { rotate: "2deg" },
      { scale: 1.04 },
    ],
  }));

  const overlay = useMemo(() => {
    if (!dragging) return null;
    return (
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: "absolute",
            top: 0,
            left: 0,
            width: listWidth - 16,
            shadowColor: "#0a1124",
            shadowOpacity: 0.28,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 8 },
            elevation: 12,
          },
          overlayStyle,
        ]}
      >
        <CardItem task={dragging} onPress={() => {}} />
      </Animated.View>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging, listWidth]);

  return {
    dragging,
    draggingTaskId: dragging?.id ?? null,
    isDragging: dragging !== null,
    dropTarget,
    overlay,
    makeGesture,
    hScrollRef,
    hScrollHandler,
    // Exposed so a sibling hook (list/column drag) can share the one and
    // only horizontal scroller — the board mounts a single Animated.ScrollView,
    // so both drag hooks must read/write the same offset & ref.
    hScrollOffset,
    setColumnScrollRef,
    onColumnScroll,
    setColumnWindowTop,
    setColumnViewportH,
    registerCardLayout,
  };
}

/** 3px copper insertion indicator rendered between cards. */
export function DropIndicator() {
  return (
    <View
      style={{
        height: 3,
        borderRadius: 2,
        backgroundColor: "#c5853a",
        marginHorizontal: 2,
      }}
    />
  );
}
