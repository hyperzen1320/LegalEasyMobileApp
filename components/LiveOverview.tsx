import { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import {
  partnerActivityHistory,
  type ActivityHistoryRow,
} from "../lib/api";
import { useNotificationCount } from "../lib/notification-count";
import { useAuth } from "../lib/auth-context";

// "What's happening today" strip that lives on the Partner home screen.
//
// Styling note: this component is written with NativeWind `className` for all
// layout/spacing (matching the rest of the app) — an earlier StyleSheet-based
// version rendered the row as a column on-device (avatar stacked above the
// text) while every className flex-row elsewhere was fine, so the row is laid
// out the proven way: avatar left, text vertically centred beside it.

const PREVIEW_LIMIT = 4;

// Left row padding + avatar + gap — the divider starts here so the hairline
// lines up under the text, not under the avatar.
const ROW_INSET = 16 + 44 + 14;

type Props = {
  onOpenBell: () => void;
};

export function LiveOverview({ onOpenBell }: Props) {
  const { isPartnerAdmin } = useAuth();
  const { count: pendingCount } = useNotificationCount();
  const [rows, setRows] = useState<ActivityHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRows = useCallback(async () => {
    try {
      const res = await partnerActivityHistory({ limit: PREVIEW_LIMIT });
      setRows(res.activity);
    } catch {
      // Stay quiet on failure — the home screen already shows its own
      // error banner if the dashboard fetch fails, and the bell badge
      // is a "nice to have" rather than load-bearing. The next focus
      // tick or pull-to-refresh will retry.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  useFocusEffect(
    useCallback(() => {
      fetchRows();
    }, [fetchRows])
  );

  const showAdminBanner = isPartnerAdmin && pendingCount > 0;

  return (
    <Animated.View
      entering={FadeInDown.duration(550).delay(220)}
      className="mt-6"
    >
      {showAdminBanner ? (
        <Pressable
          onPress={onOpenBell}
          className="flex-row items-center rounded-2xl px-4 py-3.5 mb-4 active:opacity-90"
          style={{
            backgroundColor: "#c5853a",
            gap: 12,
            shadowColor: "#0a1124",
            shadowOpacity: 0.16,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
            elevation: 4,
          }}
        >
          <View
            className="h-8 w-8 items-center justify-center rounded-lg"
            style={{ backgroundColor: "rgba(255,255,255,0.25)" }}
          >
            <Feather name="bell" size={16} color="#2a1c08" />
          </View>
          <View className="flex-1">
            <Text
              className="text-[15px]"
              style={{ fontFamily: "Crimson-SemiBold", color: "#2a1c08" }}
            >
              {pendingCount === 1
                ? "1 request needs your review"
                : `${pendingCount} requests need your review`}
            </Text>
            <Text
              className="text-[11px] mt-0.5"
              style={{ fontFamily: "Manrope", color: "#2a1c08", opacity: 0.78 }}
            >
              Open the bell to approve or reject pending deletions.
            </Text>
          </View>
          <Feather name="chevron-right" size={16} color="#2a1c08" />
        </Pressable>
      ) : null}

      <View className="flex-row items-baseline justify-between mb-2.5">
        <Text
          className="text-[10px] uppercase"
          style={{
            fontFamily: "DMMono-Medium",
            letterSpacing: 1.8,
            color: "#8a5821",
          }}
        >
          Recent activity
        </Text>
        {rows.length > 0 ? (
          <Pressable hitSlop={6} onPress={onOpenBell}>
            <Text
              className="text-[12px]"
              style={{ fontFamily: "Manrope-Medium", color: "#8a5821" }}
            >
              View all →
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View
        className="rounded-2xl overflow-hidden"
        style={{
          backgroundColor: "#ffffff",
          shadowColor: "#0a1124",
          shadowOpacity: 0.05,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 3 },
          elevation: 2,
        }}
      >
        {loading ? (
          <ActivitySkeleton />
        ) : rows.length === 0 ? (
          <EmptyChambers isAdmin={isPartnerAdmin} />
        ) : (
          rows.map((row, i) => (
            <View key={row.id}>
              <ActivityRow row={row} onPress={onOpenBell} />
              {i < rows.length - 1 ? <Divider /> : null}
            </View>
          ))
        )}
      </View>
    </Animated.View>
  );
}

function Divider() {
  return (
    <View
      style={{ height: 1, backgroundColor: "#ece1ca", marginLeft: ROW_INSET }}
    />
  );
}

function ActivityRow({
  row,
  onPress,
}: {
  row: ActivityHistoryRow;
  onPress: () => void;
}) {
  const { action, file } = splitActivity(row.message);
  const accent = ACTION_ACCENT[classifyAction(row.message)];
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center px-4 py-3.5 active:bg-[#faf6ee]"
      style={{ minHeight: 74 }}
    >
      {/* Avatar (left) carries the actor; the corner badge carries the verb.
          mr-3.5 is the breathing room to the right of the logo; px-4 on the
          row gives the matching space on the left. shrink-0 keeps the box a
          fixed 44px so the text column always flexes beside it — never below. */}
      <View
        className="relative mr-3.5 shrink-0"
        style={{ width: 44, height: 44 }}
      >
        <View
          className="h-11 w-11 items-center justify-center rounded-full"
          style={{
            backgroundColor: "#0a1124",
            borderWidth: 1,
            borderColor: "rgba(221,176,116,0.22)",
            shadowColor: "#0a1124",
            shadowOpacity: 0.2,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 3 },
            elevation: 3,
          }}
        >
          <Text
            className="text-[14px]"
            style={{
              fontFamily: "Crimson-SemiBold",
              color: "#ddb074",
              letterSpacing: 0.5,
            }}
            maxFontSizeMultiplier={1}
          >
            {initialsOf(row.actorName)}
          </Text>
        </View>
        <View
          className="absolute items-center justify-center rounded-full"
          style={{
            right: -3,
            bottom: -3,
            height: 19,
            width: 19,
            borderWidth: 2,
            borderColor: "#ffffff",
            backgroundColor: accent.color,
          }}
        >
          <Feather name={accent.icon} size={10} color="#ffffff" />
        </View>
      </View>

      {/* Body — centred beside the avatar (the row is items-center). */}
      <View className="flex-1" style={{ minWidth: 0 }}>
        <View className="flex-row items-start justify-between">
          <Text
            className="flex-1 mr-2.5"
            numberOfLines={2}
            maxFontSizeMultiplier={1.2}
          >
            <Text
              className="text-[13.5px]"
              style={{
                fontFamily: "Manrope-SemiBold",
                color: "#0a1124",
                lineHeight: 19,
              }}
            >
              {cleanName(row.actorName)}
            </Text>
            {action ? (
              <Text
                className="text-[13px]"
                style={{
                  fontFamily: "Manrope",
                  color: "#6a6253",
                  lineHeight: 19,
                }}
              >
                {` ${action}`}
              </Text>
            ) : null}
          </Text>
          <Text
            className="text-[10px]"
            style={{
              fontFamily: "DMMono",
              color: "#a89c80",
              letterSpacing: 0.4,
              marginTop: 2,
            }}
            maxFontSizeMultiplier={1.1}
          >
            {timeAgo(row.createdAt)}
          </Text>
        </View>
        {file ? (
          <Text
            className="text-[11.5px] mt-1"
            style={{
              fontFamily: "DMMono",
              color: "#8a7f6b",
              letterSpacing: 0.2,
            }}
            numberOfLines={1}
            maxFontSizeMultiplier={1.2}
          >
            {file}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function ActivitySkeleton() {
  return (
    <View>
      {[0, 1, 2].map((i) => (
        <View key={i}>
          <View
            className="flex-row items-center px-4 py-3.5"
            style={{ minHeight: 74 }}
          >
            <View
              className="mr-3.5 rounded-full"
              style={{ height: 44, width: 44, backgroundColor: "#efe5d0" }}
            />
            <View className="flex-1" style={{ gap: 7 }}>
              <View
                className="rounded-md"
                style={{ height: 12, width: "45%", backgroundColor: "#efe5d0" }}
              />
              <View
                className="rounded-md"
                style={{ height: 10, width: "72%", backgroundColor: "#efe5d0" }}
              />
            </View>
          </View>
          {i < 2 ? <Divider /> : null}
        </View>
      ))}
    </View>
  );
}

function EmptyChambers({ isAdmin }: { isAdmin: boolean }) {
  return (
    <View className="px-[18px] py-5">
      <Text
        className="text-[12px]"
        style={{ fontFamily: "Manrope", color: "#7a7060", lineHeight: 17 }}
      >
        {isAdmin
          ? "A quiet morning in chambers. Activity from cases, clients, workflow and chat will show up here."
          : "Nothing logged yet. Once cases and clients start landing, you'll see what changed here."}
      </Text>
    </View>
  );
}

// Names can carry stray punctuation (e.g. "Tejas —") — initials and the
// display name only consider real words so the avatar never shows "T—".
function wordsOf(name: string): string[] {
  return name
    .trim()
    .split(/\s+/)
    .filter((w) => /\p{L}|\p{N}/u.test(w));
}

function cleanName(name: string): string {
  const words = wordsOf(name);
  return words.length > 0 ? words.join(" ") : name.trim();
}

function initialsOf(name: string): string {
  const words = wordsOf(name);
  if (words.length === 0) return "·";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function stripBoldMarkup(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, "$1");
}

// Document activity messages read "<action> <filename>" (e.g. "removed
// document report-2026.pdf"). Peel the trailing filename onto its own line so
// it ellipsis-truncates instead of wrapping and bloating the row. Messages
// with no trailing file token stay a single line.
function splitActivity(message: string): {
  action: string;
  file: string | null;
} {
  const m = stripBoldMarkup(message).trim();
  const match = m.match(/^(.*\S)\s+(\S+\.[A-Za-z0-9]{2,5})$/);
  if (match) return { action: match[1], file: match[2] };
  return { action: m, file: null };
}

// Read the verb out of the activity line so the avatar badge can colour-code
// what happened. Order matters — "deleted" is checked before generic words.
type ActionKind = "delete" | "restore" | "add" | "update" | "default";

function classifyAction(message: string): ActionKind {
  const m = stripBoldMarkup(message).toLowerCase();
  if (/\b(delete|deleted|removed|remove|purged|discarded)\b/.test(m))
    return "delete";
  if (/\b(reopen|reopened|restored|restore|recovered)\b/.test(m))
    return "restore";
  if (/\b(created|added|new|uploaded|imported|filed|attached)\b/.test(m))
    return "add";
  if (/\b(updated|edited|changed|moved|renamed|disposed|closed|marked)\b/.test(m))
    return "update";
  return "default";
}

const ACTION_ACCENT: Record<
  ActionKind,
  { icon: keyof typeof Feather.glyphMap; color: string }
> = {
  delete: { icon: "trash-2", color: "#c14a37" },
  restore: { icon: "rotate-ccw", color: "#c5853a" },
  add: { icon: "plus", color: "#3f7d5e" },
  update: { icon: "edit-2", color: "#4a6b8a" },
  default: { icon: "activity", color: "#7a7060" },
};

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  if (diff < 60_000) return "now";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });
}
