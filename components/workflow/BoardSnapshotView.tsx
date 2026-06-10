import { type RefObject } from "react";
import { Text, View } from "react-native";
import CardItem from "./CardItem";
import EdgePill from "./EdgePill";
import type { BoardFullResponse } from "../../lib/api";

// Capture-only board render: every list side by side, every card laid
// out in full — no ScrollViews, no maxHeight clipping, so view-shot can
// photograph the whole thing. Mounted only for the moment of capture,
// fully opaque, occluded by a scrim (Android captures attached,
// laid-out views reliably; hidden/detached ones it does not).

const SNAPSHOT_LIST_WIDTH = 300;

export default function BoardSnapshotView({
  data,
  accent,
  innerRef,
  onReady,
}: {
  data: BoardFullResponse;
  accent: string;
  innerRef: RefObject<View | null>;
  onReady: (w: number, h: number) => void;
}) {
  const lists = data.lists.slice().sort((a, b) => a.sortOrder - b.sortOrder);
  const tasksByList = new Map<string, BoardFullResponse["tasks"]>();
  for (const t of data.tasks) {
    const arr = tasksByList.get(t.listId) ?? [];
    arr.push(t);
    tasksByList.set(t.listId, arr);
  }
  for (const arr of tasksByList.values()) {
    arr.sort((a, b) => a.sortOrder - b.sortOrder);
  }
  const listTitleById = new Map(lists.map((l) => [l.id, l.title]));
  const edgesByList = new Map<
    string,
    { incoming: BoardFullResponse["edges"]; outgoing: BoardFullResponse["edges"] }
  >();
  for (const l of lists) {
    edgesByList.set(l.id, { incoming: [], outgoing: [] });
  }
  for (const e of data.edges) {
    edgesByList.get(e.targetListId)?.incoming.push(e);
    edgesByList.get(e.sourceListId)?.outgoing.push(e);
  }

  const dateStr = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <View
      ref={innerRef}
      collapsable={false}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (width > 0 && height > 0) {
          // One frame for fonts/shadows to settle before the capture.
          requestAnimationFrame(() => onReady(width, height));
        }
      }}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        backgroundColor: "#f4ede0",
        padding: 18,
      }}
    >
      {/* Header strip */}
      <View
        className="flex-row items-baseline"
        style={{ gap: 10, marginBottom: 12 }}
      >
        <Text
          className="text-[20px] tracking-tight text-app-ink"
          style={{ fontFamily: "Crimson-SemiBold" }}
        >
          {data.board.title}
        </Text>
        <Text
          className="text-[10px] uppercase text-app-copper-deep"
          style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.4 }}
        >
          {dateStr} · {lists.length} lists · {data.tasks.length} cards
        </Text>
      </View>

      {/* Columns, full height */}
      <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
        {lists.map((list) => {
          const stripe = list.color || accent;
          const tasks = tasksByList.get(list.id) ?? [];
          const edges = edgesByList.get(list.id) ?? {
            incoming: [],
            outgoing: [],
          };
          return (
            <View
              key={list.id}
              style={{
                width: SNAPSHOT_LIST_WIDTH,
                backgroundColor: "rgba(255,255,255,0.92)",
                borderRadius: 14,
                overflow: "hidden",
              }}
            >
              <View style={{ height: 4, backgroundColor: stripe }} />
              <View
                className="px-3 pt-3 pb-2 flex-row items-center"
                style={{ gap: 6 }}
              >
                <Text
                  className="flex-1 text-[14px] tracking-tight text-app-ink"
                  style={{ fontFamily: "Crimson-SemiBold" }}
                >
                  {list.title}
                </Text>
                <Text
                  className="text-[10px] tabular-nums"
                  style={{ fontFamily: "DMMono-Medium", color: "#7a7060" }}
                >
                  {tasks.length}
                </Text>
              </View>

              {edges.incoming.length > 0 || edges.outgoing.length > 0 ? (
                <View className="px-3 pb-1" style={{ gap: 4 }}>
                  {edges.incoming.slice(0, 2).map((e) => (
                    <EdgePill
                      key={`in-${e.id}`}
                      direction="incoming"
                      label={e.label || undefined}
                      otherListTitle={
                        listTitleById.get(e.sourceListId) ?? "another"
                      }
                      color={e.color || stripe}
                    />
                  ))}
                  {edges.outgoing.slice(0, 2).map((e) => (
                    <EdgePill
                      key={`out-${e.id}`}
                      direction="outgoing"
                      label={e.label || undefined}
                      otherListTitle={
                        listTitleById.get(e.targetListId) ?? "another"
                      }
                      color={e.color || stripe}
                    />
                  ))}
                </View>
              ) : null}

              <View
                style={{
                  paddingHorizontal: 8,
                  paddingTop: 4,
                  paddingBottom: 8,
                  gap: 6,
                }}
              >
                {tasks.length === 0 ? (
                  <Text
                    className="text-[11px] text-center py-4"
                    style={{ fontFamily: "Manrope", color: "#a89c80" }}
                  >
                    empty
                  </Text>
                ) : (
                  tasks.map((t) => (
                    <CardItem
                      key={t.id}
                      task={t}
                      onPress={() => {}}
                      onLongPress={() => {}}
                    />
                  ))
                )}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
