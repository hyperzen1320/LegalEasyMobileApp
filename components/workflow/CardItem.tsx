import { View, Text, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import type { PreviewTask } from "../../lib/api";

const PRIORITY_COLOR: Record<string, string> = {
  high: "#c14a37",
  medium: "#c5853a",
  low: "#56a0a8",
};

const PRIORITY_LABEL: Record<string, string> = {
  high: "High",
  medium: "Med",
  low: "Low",
};

function fmtDue(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function dueState(iso: string): "overdue" | "today" | "future" {
  const due = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (due < today) return "overdue";
  if (due.toDateString() === new Date().toDateString()) return "today";
  return "future";
}

/**
 * One Trello card. Tap → push to detail. The "⋯" button opens the
 * caller's action sheet (Move / Edit / Delete) — long-press is reserved
 * for drag & drop, with the sheet's Move flow as the accessible
 * fallback. Optimistic temp:* cards render dim with a small "saving"
 * dot so users know they aren't yet on the server.
 */
export default function CardItem({
  task,
  onPress,
  onLongPress,
  onMore,
}: {
  task: PreviewTask;
  onPress: () => void;
  onLongPress?: () => void;
  onMore?: () => void;
}) {
  const isPending = task.id.startsWith("tmp:");
  const due = task.dueDate ? new Date(task.dueDate) : null;
  const dueLabel = task.dueDate ? fmtDue(task.dueDate) : "";
  const dueColour = task.dueDate
    ? dueState(task.dueDate) === "overdue"
      ? "#c14a37"
      : dueState(task.dueDate) === "today"
        ? "#c5853a"
        : "#7a7060"
    : "#7a7060";

  const checklistTotal = task.checklistSummary?.totalItems ?? 0;
  const checklistDone = task.checklistSummary?.doneItems ?? 0;
  const allDone = checklistTotal > 0 && checklistDone === checklistTotal;

  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      onLongPress={
        onLongPress
          ? () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onLongPress();
            }
          : undefined
      }
      delayLongPress={350}
      className="active:opacity-70"
      style={{
        backgroundColor: "#ffffff",
        borderRadius: 10,
        borderWidth: 1,
        borderColor: "rgba(10,17,36,0.05)",
        padding: 12,
        opacity: isPending ? 0.65 : 1,
        shadowColor: "#0a1124",
        shadowOpacity: 0.05,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 1 },
        elevation: 1,
      }}
      accessibilityRole="button"
      accessibilityLabel={`Card ${task.title}`}
      accessibilityHint="Tap to open · Long-press for actions"
    >
      <View className="flex-row items-start gap-2">
        {task.priority ? (
          <View
            style={{
              marginTop: 5,
              height: 8,
              width: 8,
              borderRadius: 4,
              backgroundColor: PRIORITY_COLOR[task.priority],
              shadowColor: PRIORITY_COLOR[task.priority],
              shadowOpacity: 0.3,
              shadowRadius: 4,
            }}
          />
        ) : null}
        <Text
          className="flex-1 text-[14px] text-app-ink leading-snug"
          style={{
            fontFamily: "Manrope-SemiBold",
            letterSpacing: -0.1,
          }}
          numberOfLines={3}
        >
          {task.title}
        </Text>
        {onMore ? (
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              onMore();
            }}
            hitSlop={8}
            className="active:opacity-50 items-center justify-center"
            style={{ height: 22, width: 22, marginTop: -2, marginRight: -4 }}
            accessibilityRole="button"
            accessibilityLabel={`Actions for ${task.title}`}
          >
            <Feather name="more-horizontal" size={14} color="#a89c80" />
          </Pressable>
        ) : null}
      </View>

      {/* description preview */}
      {task.hasDescription && task.description ? (
        <Text
          className="mt-1.5 text-[12px] text-app-fg-muted leading-snug"
          style={{ fontFamily: "Manrope" }}
          numberOfLines={2}
        >
          {task.description}
        </Text>
      ) : null}

      {/* meta row — due date · checklist · assignee */}
      {(due || checklistTotal > 0 || task.assignee || task.priority) && (
        <View
          className="mt-2.5 flex-row items-center"
          style={{ flexWrap: "wrap", gap: 8 }}
        >
          {due ? (
            <View className="flex-row items-center" style={{ gap: 4 }}>
              <Feather name="calendar" size={11} color={dueColour} />
              <Text
                className="text-[10px] tabular-nums uppercase"
                style={{
                  fontFamily: "DMMono-Medium",
                  letterSpacing: 0.8,
                  color: dueColour,
                }}
              >
                {dueLabel}
              </Text>
            </View>
          ) : null}
          {checklistTotal > 0 ? (
            <View className="flex-row items-center" style={{ gap: 4 }}>
              <Feather
                name={allDone ? "check-square" : "square"}
                size={11}
                color={allDone ? "#56a0a8" : "#7a7060"}
              />
              <Text
                className="text-[10px] tabular-nums uppercase"
                style={{
                  fontFamily: "DMMono-Medium",
                  letterSpacing: 0.8,
                  color: allDone ? "#56a0a8" : "#7a7060",
                }}
              >
                {checklistDone}/{checklistTotal}
              </Text>
            </View>
          ) : null}
          {task.priority && PRIORITY_LABEL[task.priority] ? (
            <View
              className="rounded"
              style={{
                paddingHorizontal: 5,
                paddingVertical: 1,
                backgroundColor: `${PRIORITY_COLOR[task.priority]}1f`,
              }}
            >
              <Text
                className="text-[9px] uppercase"
                style={{
                  fontFamily: "DMMono-Medium",
                  letterSpacing: 1,
                  color: PRIORITY_COLOR[task.priority],
                }}
              >
                {PRIORITY_LABEL[task.priority]}
              </Text>
            </View>
          ) : null}
          {task.assignee ? (
            <View
              className="ml-auto flex-row items-center justify-center rounded-full"
              style={{
                width: 22,
                height: 22,
                backgroundColor: "#0a1124",
              }}
            >
              <Text
                style={{
                  fontFamily: "Manrope-SemiBold",
                  fontSize: 9,
                  color: "#f5ebd6",
                  letterSpacing: 0.5,
                }}
              >
                {initials(task.assignee.name)}
              </Text>
            </View>
          ) : null}
        </View>
      )}

      {/* "Saving" dot for optimistic cards */}
      {isPending ? (
        <View
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: "#c5853a",
          }}
        />
      ) : null}
    </Pressable>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
