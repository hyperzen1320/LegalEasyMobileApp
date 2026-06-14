import { useCallback, useEffect, useState } from "react";
import {
  ScrollView,
  View,
  Text,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import Svg, { Line, Path, Circle, G } from "react-native-svg";
import { useFocusEffect, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import {
  partnerDashboard,
  partnerListBoards,
  type PartnerDashboardData,
} from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { useChatUnread } from "../../lib/chat-unread";
import { useNotificationCount } from "../../lib/notification-count";
import { LiveOverview } from "../../components/LiveOverview";
import BellSheet from "../../components/BellSheet";

export default function PartnerHome() {
  const { user, partner } = useAuth();
  const { unread } = useChatUnread();
  const [data, setData] = useState<PartnerDashboardData | null>(null);
  const [boardCount, setBoardCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bellOpen, setBellOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      // Boards ride alongside the dashboard so the Work Flow tile shows a
      // live count; a board failure must not blank the whole screen.
      const [dash, boards] = await Promise.all([
        partnerDashboard(),
        partnerListBoards().catch(() => ({ boards: [] })),
      ]);
      setData(dash);
      setBoardCount(boards.boards.length);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
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

  if (loading) {
    return (
      <View
        className="flex-1 items-center justify-center"
        style={{ backgroundColor: "#f4ede0" }}
      >
        <ActivityIndicator color="#c5853a" size="large" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-app-canvas">
      <StatusBar style="dark" backgroundColor="#f4ede0" />
      <SafeAreaView className="flex-1" edges={["top"]}>
        <TopBar
          partnerName={partner?.name ?? "Your chambers"}
          onOpenBell={() => setBellOpen(true)}
        />
        <ScrollView
          contentContainerClassName="px-5 pt-5 pb-8"
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
            <View className="rounded-md border border-app-danger/30 bg-app-danger-soft px-4 py-3 mb-4">
              <Text
                className="text-[13px] text-app-fg"
                style={{ fontFamily: "Manrope" }}
              >
                {error}
              </Text>
            </View>
          ) : null}

          <Hero
            firstName={user?.firstName ?? "Counsel"}
            stats={data?.stats}
          />

          <StatsGrid
            stats={data?.stats}
            boardCount={boardCount}
            unreadCount={unread.totalUnread}
          />

          <TodaysBoard board={data?.todaysBoard ?? []} />

          <LiveOverview onOpenBell={() => setBellOpen(true)} />
        </ScrollView>
      </SafeAreaView>

      <BellSheet visible={bellOpen} onClose={() => setBellOpen(false)} />
    </View>
  );
}

/* ───────── Top bar ───────── */
function TopBar({
  partnerName,
  onOpenBell,
}: {
  partnerName: string;
  onOpenBell: () => void;
}) {
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
  const { count } = useNotificationCount();
  return (
    <View
      className="border-b border-app-edge bg-app-canvas px-5 py-3.5 flex-row items-center justify-between"
    >
      <View>
        <Text
          className="text-[10px] uppercase text-app-copper-deep"
          style={{
            fontFamily: "DMMono-Medium",
            letterSpacing: 1.8,
          }}
        >
          {today}
        </Text>
        <Text
          className="mt-0.5 text-[18px] font-semibold tracking-tight text-app-ink leading-none"
          style={{ fontFamily: "Crimson-SemiBold" }}
          numberOfLines={1}
        >
          {partnerName}
        </Text>
      </View>
      <View className="relative">
        <Pressable
          onPress={onOpenBell}
          className="h-10 w-10 items-center justify-center rounded-full active:opacity-50"
          style={{ backgroundColor: "rgba(10,17,36,0.05)" }}
          accessibilityLabel={
            count > 0
              ? `Notifications, ${count} pending`
              : "Notifications"
          }
        >
          <Feather name="bell" size={18} color="#0a1124" />
        </Pressable>
        {count > 0 ? (
          <View
            className="absolute -right-0.5 -top-0.5 min-w-[16px] h-[16px] px-1 items-center justify-center rounded-full"
            style={{ backgroundColor: "#c14a37" }}
          >
            <Text
              className="text-[9px] tabular-nums"
              style={{
                fontFamily: "DMMono-Medium",
                color: "#f5ebd6",
                letterSpacing: 0.4,
              }}
            >
              {count > 99 ? "99+" : count}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/* ───────── Hero greeting card ───────── */
function Hero({
  firstName,
  stats,
}: {
  firstName: string;
  stats?: PartnerDashboardData["stats"];
}) {
  const hour = new Date().getHours();
  const greeting =
    hour < 5
      ? "Late night"
      : hour < 12
        ? "Good morning"
        : hour < 17
          ? "Good afternoon"
          : "Good evening";
  const today = new Date()
    .toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "long",
    })
    .toUpperCase();

  const todayCount = stats?.todayHearings ?? 0;
  const pendingCount = stats?.pendingDates ?? 0;

  return (
    <Animated.View
      entering={FadeInDown.duration(700).springify().damping(14)}
      className="relative overflow-hidden rounded-2xl px-6 py-7"
      style={{
        backgroundColor: "#0a1124",
        shadowColor: "#0a1124",
        shadowOpacity: 0.2,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
        elevation: 6,
      }}
    >
      {/* decorative scales SVG, low opacity */}
      <View
        pointerEvents="none"
        style={{ position: "absolute", right: -30, top: -30, opacity: 0.18 }}
      >
        <Svg width={200} height={200} viewBox="0 0 200 200" fill="none">
          <G stroke="#c5853a" strokeWidth={0.6} fill="none">
            <Line x1="100" y1="30" x2="100" y2="160" />
            <Line x1="60" y1="160" x2="140" y2="160" strokeWidth={1} />
            <Line x1="40" y1="65" x2="160" y2="65" strokeWidth={0.8} />
            <Path d="M55 65 L40 110 a5 5 0 0 0 30 0 L55 65 Z" />
            <Path d="M145 65 L130 110 a5 5 0 0 0 30 0 L145 65 Z" />
            <Circle cx="100" cy="30" r={2.5} fill="#c5853a" fillOpacity={0.4} />
            <Circle cx="100" cy="100" r={80} strokeOpacity={0.2} />
          </G>
        </Svg>
      </View>

      <Text
        className="text-[10px] uppercase text-app-copper-bright"
        style={{ fontFamily: "DMMono-Medium", letterSpacing: 2.5 }}
      >
        {today}
      </Text>

      <Text
        className="mt-4 text-[36px] font-semibold leading-[1.04] tracking-tight text-app-ivory"
        style={{ fontFamily: "Crimson-SemiBold" }}
      >
        {greeting},
      </Text>
      <Text
        className="text-[36px] leading-[1.04] tracking-tight"
        style={{
          fontFamily: "Crimson-SemiBoldItalic",
          color: "#ddb074",
          fontStyle: "italic",
        }}
      >
        {firstName}.
      </Text>

      <Text
        className="mt-4 text-[14px] leading-[22px] text-app-ivory-soft"
        style={{ fontFamily: "Manrope" }}
      >
        {todayCount === 0 && pendingCount === 0 ? (
          "A clear desk today. The perfect moment to add new matters or attend to long-term work."
        ) : (
          <>
            You have{" "}
            <Text
              className="font-semibold tabular-nums"
              style={{
                fontFamily: "Crimson-SemiBold",
                color: "#ddb074",
                fontSize: 16,
              }}
            >
              {todayCount}
            </Text>{" "}
            {todayCount === 1 ? "hearing" : "hearings"} today
            {pendingCount > 0 ? (
              <>
                {" "}and{" "}
                <Text
                  className="font-semibold tabular-nums"
                  style={{
                    fontFamily: "Crimson-SemiBold",
                    color: "#ddb074",
                    fontSize: 16,
                  }}
                >
                  {pendingCount}
                </Text>{" "}
                {pendingCount === 1 ? "matter" : "matters"} awaiting next date
              </>
            ) : null}
            .
          </>
        )}
      </Text>
    </Animated.View>
  );
}

/* ───────── Stats grid (2x2) ───────── */
function StatsGrid({
  stats,
  boardCount,
  unreadCount,
}: {
  stats?: PartnerDashboardData["stats"];
  boardCount: number;
  unreadCount: number;
}) {
  const router = useRouter();
  const items: Array<{
    label: string;
    value: number;
    variant: "copper" | "ink" | "paper";
    icon: keyof typeof Feather.glyphMap;
    href: string;
  }> = [
    {
      label: "Today",
      value: stats?.todayHearings ?? 0,
      variant: "copper",
      icon: "calendar",
      href: "/(home)/hearings",
    },
    {
      label: "Tomorrow",
      value: stats?.tomorrowHearings ?? 0,
      variant: "ink",
      icon: "calendar",
      href: "/(home)/hearings?bucket=tomorrow",
    },
    {
      label: "Pending",
      value: stats?.pendingDates ?? 0,
      variant: "copper",
      icon: "alert-triangle",
      href: "/(home)/hearings?bucket=pending",
    },
    {
      label: "Case Vault",
      value: stats?.caseVault ?? 0,
      variant: "paper",
      icon: "briefcase",
      href: "/(home)/cases",
    },
    {
      label: "Work Flow",
      value: boardCount,
      variant: "ink",
      icon: "trello",
      href: "/(home)/workflow",
    },
    {
      label: "Senior Desk",
      value: unreadCount,
      variant: "paper",
      icon: "message-square",
      href: "/(home)/senior-desk",
    },
  ];

  return (
    <View className="mt-6 flex-row flex-wrap gap-3">
      {items.map((it, i) => (
        <Animated.View
          key={it.label}
          entering={FadeInDown.duration(500).delay(80 + i * 60)}
          // flexBasis under 50% leaves room for the 12px gap, flexGrow
          // stretches the pair back to the full row — a true 2-up grid
          // on any phone width (4-up never wraps oddly on tablets).
          style={{ flexGrow: 1, flexBasis: "44%" }}
        >
          <StatCard {...it} onPress={() => router.push(it.href as never)} />
        </Animated.View>
      ))}
    </View>
  );
}

function StatCard({
  label,
  value,
  variant,
  icon,
  onPress,
}: {
  label: string;
  value: number;
  variant: "copper" | "ink" | "paper";
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
}) {
  const styles = {
    copper: {
      bg: "#c5853a",
      text: "#2a1c08",
      label: "#2a1c08",
      iconBg: "rgba(0,0,0,0.12)",
      iconColor: "#2a1c08",
    },
    ink: {
      bg: "#0a1124",
      text: "#f5ebd6",
      label: "#ddb074",
      iconBg: "rgba(255,255,255,0.07)",
      iconColor: "#ddb074",
    },
    paper: {
      bg: "#ffffff",
      text: "#0a1124",
      label: "#7a7060",
      iconBg: "#efe5d0",
      iconColor: "#8a5821",
    },
  }[variant];

  return (
    <Pressable
      onPress={onPress}
      className="rounded-xl p-5 active:opacity-90"
      style={{
        backgroundColor: styles.bg,
        shadowColor: "#0a1124",
        shadowOpacity: variant === "paper" ? 0.04 : 0.18,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: variant === "paper" ? 1 : 4,
      }}
    >
      <View
        className="h-8 w-8 items-center justify-center rounded-md"
        style={{ backgroundColor: styles.iconBg }}
      >
        <Feather name={icon} size={14} color={styles.iconColor} />
      </View>
      <Text
        className="mt-4 text-[36px] leading-none tracking-tight tabular-nums"
        style={{ fontFamily: "Crimson-SemiBold", color: styles.text }}
      >
        {value}
      </Text>
      <Text
        className="mt-2 text-[10px] uppercase"
        style={{
          fontFamily: "DMMono-Medium",
          letterSpacing: 1.6,
          color: styles.label,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/* ───────── Today's Board ───────── */
function TodaysBoard({
  board,
}: {
  board: PartnerDashboardData["todaysBoard"];
}) {
  const router = useRouter();
  return (
    <Animated.View entering={FadeInDown.duration(700).delay(420)} className="mt-7">
      <View className="flex-row items-baseline justify-between mb-3">
        <Text
          className="text-[24px] font-semibold tracking-tight text-app-ink"
          style={{ fontFamily: "Crimson-SemiBold" }}
        >
          Today&rsquo;s Board
        </Text>
        <Pressable
          onPress={() => router.push("/(home)/cases")}
          hitSlop={6}
          className="active:opacity-50"
        >
          <Text
            className="text-[12px] font-medium text-app-copper-deep"
            style={{ fontFamily: "Manrope-Medium" }}
          >
            View all →
          </Text>
        </Pressable>
      </View>

      {board.length === 0 ? (
        <EmptyBoard />
      ) : (
        <View className="gap-3">
          {board.map((c) => (
            <BoardRow key={c.id} c={c} />
          ))}
        </View>
      )}
    </Animated.View>
  );
}

function BoardRow({
  c,
}: {
  c: PartnerDashboardData["todaysBoard"][0];
}) {
  const router = useRouter();
  const next = c.nextHearingDate ? new Date(c.nextHearingDate) : null;
  const isToday =
    next && next.toDateString() === new Date().toDateString();

  return (
    <Pressable
      onPress={() => router.push(`/(home)/cases/${c.id}` as never)}
      className="rounded-xl bg-app-paper p-4 active:opacity-90"
      style={{
        shadowColor: "#0a1124",
        shadowOpacity: 0.05,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 1 },
        elevation: 1,
        borderLeftWidth: 3,
        borderLeftColor: "#c5853a",
      }}
    >
      <View className="flex-row items-baseline gap-2 flex-wrap">
        <Text
          className="text-[17px] font-semibold tracking-tight text-app-ink"
          style={{ fontFamily: "Crimson-SemiBold" }}
        >
          {c.caseNo}
        </Text>
        {c.status ? (
          <View
            className="rounded-md px-1.5 py-0.5"
            style={{ backgroundColor: "#d2e6e7" }}
          >
            <Text
              className="text-[9px] uppercase"
              style={{
                fontFamily: "DMMono-Medium",
                letterSpacing: 1.2,
                color: "#56a0a8",
              }}
            >
              {c.status}
            </Text>
          </View>
        ) : null}
        {isToday ? (
          <View
            className="rounded-md px-1.5 py-0.5"
            style={{ backgroundColor: "rgba(197,133,58,0.18)" }}
          >
            <Text
              className="text-[9px] uppercase"
              style={{
                fontFamily: "DMMono-Medium",
                letterSpacing: 1.2,
                color: "#8a5821",
              }}
            >
              Today
            </Text>
          </View>
        ) : null}
      </View>
      {(c.clientName || c.courtName) && (
        <Text
          className="mt-1.5 text-[12px] text-app-fg-soft"
          style={{ fontFamily: "Manrope" }}
        >
          {c.clientName ? (
            <Text style={{ fontFamily: "Manrope-Medium" }}>{c.clientName}</Text>
          ) : null}
          {c.clientName && (c.courtName || c.courtPlace) ? " · " : ""}
          {[c.courtName, c.courtPlace].filter(Boolean).join(", ")}
        </Text>
      )}
    </Pressable>
  );
}

function EmptyBoard() {
  const router = useRouter();
  return (
    <View
      className="rounded-xl px-5 py-9 items-center"
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
        <Feather name="briefcase" size={20} color="#8a5821" />
      </View>
      <Text
        className="mt-4 text-[20px] font-semibold tracking-tight text-app-ink text-center"
        style={{ fontFamily: "Crimson-SemiBold" }}
      >
        Nothing on the board yet.
      </Text>
      <Text
        className="mt-1.5 text-[12px] text-app-fg-muted text-center max-w-[280px]"
        style={{ fontFamily: "Manrope" }}
      >
        Add cases with a next hearing date to see them line up here in
        chronological order.
      </Text>
      <Pressable
        onPress={() => router.push("/(home)/cases/new")}
        className="mt-5 rounded-md flex-row items-center gap-2 px-5 py-2.5 active:opacity-90"
        style={{
          backgroundColor: "#0a1124",
          shadowColor: "#0a1124",
          shadowOpacity: 0.2,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
          elevation: 4,
        }}
      >
        <Feather name="plus" size={14} color="#f5ebd6" />
        <Text
          className="text-[13px] font-semibold text-app-ivory"
          style={{ fontFamily: "Manrope-SemiBold" }}
        >
          Add the first case
        </Text>
      </Pressable>
    </View>
  );
}
