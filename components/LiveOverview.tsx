import { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
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
// Replaces the two Phase-2 callouts which lied about Work Flow being
// future work (it's built) and stayed visible after Senior Desk lands
// (it would never have updated itself).
//
// The component is intentionally lightweight: it owns its own fetch
// (the home screen has plenty going on) and refreshes when focused.
// Tapping a row or "View all" hands off to BellSheet via the prop, so
// the home screen owns the sheet's lifecycle.

const PREVIEW_LIMIT = 4;

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
      style={styles.container}
    >
      {showAdminBanner ? (
        <Pressable
          onPress={onOpenBell}
          style={({ pressed }) => [
            styles.adminBanner,
            pressed ? { opacity: 0.9 } : null,
          ]}
        >
          <View style={styles.adminBannerIcon}>
            <Feather name="bell" size={16} color="#2a1c08" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.adminBannerTitle}>
              {pendingCount === 1
                ? "1 request needs your review"
                : `${pendingCount} requests need your review`}
            </Text>
            <Text style={styles.adminBannerBody}>
              Open the bell to approve or reject pending deletions.
            </Text>
          </View>
          <Feather name="chevron-right" size={16} color="#2a1c08" />
        </Pressable>
      ) : null}

      <View style={styles.headerRow}>
        <Text style={styles.eyebrow}>Recent activity</Text>
        {rows.length > 0 ? (
          <Pressable hitSlop={6} onPress={onOpenBell}>
            <Text style={styles.viewAll}>View all →</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.card}>
        {loading ? (
          <ActivitySkeleton />
        ) : rows.length === 0 ? (
          <EmptyChambers isAdmin={isPartnerAdmin} />
        ) : (
          rows.map((row, i) => (
            <View key={row.id}>
              <ActivityRow row={row} onPress={onOpenBell} />
              {i < rows.length - 1 ? <View style={styles.divider} /> : null}
            </View>
          ))
        )}
      </View>
    </Animated.View>
  );
}

function ActivityRow({
  row,
  onPress,
}: {
  row: ActivityHistoryRow;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        pressed ? { opacity: 0.55 } : null,
      ]}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initialsOf(row.actorName)}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.actor} numberOfLines={1}>
          {row.actorName}
        </Text>
        <Text style={styles.message} numberOfLines={2}>
          {stripBoldMarkup(row.message)}
        </Text>
      </View>
      <Text style={styles.timeAgo}>{timeAgo(row.createdAt)}</Text>
    </Pressable>
  );
}

function ActivitySkeleton() {
  return (
    <View>
      {[0, 1, 2].map((i) => (
        <View key={i}>
          <View style={styles.row}>
            <View style={[styles.avatar, styles.skeletonBlock]} />
            <View style={{ flex: 1, gap: 6 }}>
              <View
                style={[styles.skeletonBlock, { height: 12, width: "40%" }]}
              />
              <View
                style={[styles.skeletonBlock, { height: 10, width: "80%" }]}
              />
            </View>
          </View>
          {i < 2 ? <View style={styles.divider} /> : null}
        </View>
      ))}
    </View>
  );
}

function EmptyChambers({ isAdmin }: { isAdmin: boolean }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>
        {isAdmin
          ? "A quiet morning in chambers. Activity from cases, clients, workflow and chat will show up here."
          : "Nothing logged yet. Once cases and clients start landing, you'll see what changed here."}
      </Text>
    </View>
  );
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  const a = parts[0]?.[0] ?? "";
  const b = parts[1]?.[0] ?? "";
  return (a + b).toUpperCase() || "·";
}

function stripBoldMarkup(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, "$1");
}

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

const styles = StyleSheet.create({
  container: {
    marginTop: 24,
  },
  adminBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "#c5853a",
    marginBottom: 18,
    shadowColor: "#0a1124",
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  adminBannerIcon: {
    height: 32,
    width: 32,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  adminBannerTitle: {
    fontFamily: "Crimson-SemiBold",
    fontSize: 15,
    color: "#2a1c08",
  },
  adminBannerBody: {
    fontFamily: "Manrope",
    fontSize: 11,
    color: "#2a1c08",
    opacity: 0.78,
    marginTop: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  eyebrow: {
    fontFamily: "DMMono-Medium",
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: "#8a5821",
  },
  viewAll: {
    fontFamily: "Manrope-Medium",
    fontSize: 12,
    color: "#8a5821",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#0a1124",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  avatar: {
    height: 32,
    width: 32,
    borderRadius: 16,
    backgroundColor: "#0a1124",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontFamily: "Crimson-SemiBold",
    fontSize: 12,
    color: "#ddb074",
  },
  actor: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 13,
    color: "#0a1124",
  },
  message: {
    fontFamily: "Manrope",
    fontSize: 12,
    color: "#4d4538",
    marginTop: 2,
    lineHeight: 17,
  },
  timeAgo: {
    fontFamily: "DMMono",
    fontSize: 10,
    color: "#7a7060",
    letterSpacing: 0.4,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: "#efe5d0",
    marginLeft: 14 + 32 + 12,
  },
  skeletonBlock: {
    backgroundColor: "#efe5d0",
    borderRadius: 6,
  },
  empty: {
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  emptyText: {
    fontFamily: "Manrope",
    fontSize: 12,
    color: "#7a7060",
    lineHeight: 17,
  },
});
