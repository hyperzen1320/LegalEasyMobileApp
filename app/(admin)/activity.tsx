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
import { useFocusEffect, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { adminListActivity, type AdminActivity } from "../../lib/api";

type FilterKey = "all" | "created" | "updated" | "password" | "danger" | "plan";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "created", label: "Created" },
  { key: "updated", label: "Updated" },
  { key: "plan", label: "Plans" },
  { key: "password", label: "Password" },
  { key: "danger", label: "Danger" },
];

export default function AdminActivity() {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [activities, setActivities] = useState<AdminActivity[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (f: FilterKey) => {
    try {
      const data = await adminListActivity(f, 50);
      setActivities(data.activities);
      setTotal(data.total);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    (async () => {
      await load(filter);
      setLoading(false);
    })();
  }, [filter, load]);

  useFocusEffect(
    useCallback(() => {
      load(filter);
    }, [filter, load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(filter);
    setRefreshing(false);
  }, [filter, load]);

  return (
    <View className="flex-1 bg-admin-bg">
      <StatusBar style="dark" backgroundColor="#fafaf7" />
      <SafeAreaView className="flex-1" edges={["top"]}>
        <TopBar total={total} />
        <FilterPills active={filter} onChange={setFilter} />

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#0e7c4a" size="large" />
          </View>
        ) : (
          <ScrollView
            contentContainerClassName="px-5 pt-4 pb-8"
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#0e7c4a"
              />
            }
          >
            {error ? (
              <View className="rounded-md border border-admin-danger/30 bg-admin-danger-soft px-4 py-3 mb-4">
                <Text className="font-plex text-[13px] text-admin-fg">
                  {error}
                </Text>
              </View>
            ) : null}

            {activities.length === 0 ? (
              <EmptyState />
            ) : (
              <Timeline activities={activities} />
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

function TopBar({ total }: { total: number }) {
  return (
    <View className="bg-admin-surface border-b border-admin-border">
      <View className="h-[2px] bg-admin-accent" />
      <View className="px-5 py-3.5">
        <Text
          className="font-plex-mono-medium text-[10px] uppercase text-admin-accent"
          style={{ letterSpacing: 1.8 }}
        >
          Audit log
        </Text>
        <View className="flex-row items-baseline gap-2 mt-0.5">
          <Text className="font-plex-bold text-[18px] text-admin-fg">
            Activity
          </Text>
          {total > 0 ? (
            <Text className="font-plex-mono text-[11px] text-admin-fg-soft tabular-nums">
              · {total} total · tap to expand
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function FilterPills({
  active,
  onChange,
}: {
  active: FilterKey;
  onChange: (k: FilterKey) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingVertical: 12,
        gap: 8,
      }}
      className="bg-admin-surface border-b border-admin-border-soft"
      style={{ flexGrow: 0 }}
    >
      {FILTERS.map((f) => {
        const isActive = f.key === active;
        return (
          <Pressable
            key={f.key}
            onPress={() => onChange(f.key)}
            className={`px-3.5 py-1.5 rounded-full border ${
              isActive
                ? "bg-admin-fg border-admin-fg"
                : "bg-admin-surface border-admin-border"
            }`}
          >
            <Text
              className={`font-plex-medium text-[12px] ${
                isActive ? "text-white" : "text-admin-fg-muted"
              }`}
            >
              {f.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function Timeline({ activities }: { activities: AdminActivity[] }) {
  const grouped = groupByDay(activities);
  return (
    <View className="relative">
      <View
        className="absolute left-[10px] top-3 bottom-3 w-px bg-admin-border"
        aria-hidden
      />
      {grouped.map((g, gi) => (
        <View key={g.label} className="mb-6 last:mb-0">
          <View className="flex-row items-center gap-3 pl-7 mb-3">
            <Text
              className="font-plex-mono-medium text-[10px] uppercase text-admin-fg-soft"
              style={{ letterSpacing: 1.5 }}
            >
              {g.label}
            </Text>
            <View className="flex-1 h-px bg-admin-border-soft" />
          </View>

          {g.items.map((a, i) => (
            <Row
              key={a.id}
              activity={a}
              delay={Math.min(0.3, gi * 0.04 + i * 0.02)}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

type DiffEntry = { field: string; before: unknown; after: unknown };

function Row({
  activity: a,
  delay,
}: {
  activity: AdminActivity;
  delay: number;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const colors = actionColor(a.action);
  const created = new Date(a.createdAt);
  const dateStr = created.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const timeStr = created.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  const rel = relativeTime(created);
  const targetLink =
    a.targetType === "partner" && a.targetId
      ? `/(admin)/partners/${a.targetId}`
      : null;

  const rawChanges = (a.metadata?.changes ?? []) as unknown[];
  const diffs: DiffEntry[] = rawChanges.filter(
    (c): c is DiffEntry =>
      typeof c === "object" && c !== null && "field" in (c as object)
  );
  const legacyFields: string[] = rawChanges.filter(
    (c): c is string => typeof c === "string"
  );

  const hasDiffs = diffs.length > 0;

  return (
    <Animated.View
      entering={FadeInDown.duration(450).delay(delay * 1000)}
      className="flex-row gap-4 mb-3 last:mb-0"
    >
      {/* Dot */}
      <View className="z-10 mt-1">
        <View
          className={`h-[22px] w-[22px] rounded-full bg-admin-bg items-center justify-center border-[3px] ${colors.border}`}
        >
          <View className={`h-1.5 w-1.5 rounded-full ${colors.dot}`} />
        </View>
      </View>

      {/* Card */}
      <View className="flex-1 bg-admin-surface border border-admin-border rounded-lg overflow-hidden">
        <Pressable
          onPress={() => {
            if (hasDiffs) {
              setExpanded((s) => !s);
            } else if (targetLink) {
              router.push(targetLink as never);
            }
          }}
          className="p-4 active:bg-admin-bg"
        >
          {/* Top row */}
          <View className="flex-row items-start justify-between gap-3">
            <View className={`px-2 py-0.5 rounded-sm ${colors.tag}`}>
              <Text
                className={`font-plex-mono-medium text-[9px] uppercase ${colors.tagText}`}
                style={{ letterSpacing: 1.2 }}
              >
                {a.action.replace(/_/g, " ")}
              </Text>
            </View>
            <View className="items-end">
              <Text
                className="font-plex-mono-medium text-[10px] text-admin-fg tabular-nums"
                style={{ letterSpacing: 0.5 }}
              >
                {dateStr}
              </Text>
              <Text
                className="font-plex-mono text-[10px] text-admin-fg-soft tabular-nums"
                style={{ letterSpacing: 0.3 }}
              >
                {timeStr} · {rel}
              </Text>
            </View>
          </View>

          {/* Actor */}
          <View className="mt-2.5 flex-row items-baseline flex-wrap gap-x-2">
            <Text className="font-plex-bold text-[12px] text-admin-fg">
              {a.actorName}
            </Text>
            <Text
              className="font-plex-mono text-[10px] text-admin-fg-soft"
              style={{ letterSpacing: 0.3 }}
            >
              {a.actorEmail}
            </Text>
          </View>

          {/* Message */}
          <Text className="mt-2 font-plex text-[13px] leading-[19px] text-admin-fg">
            {a.message}
          </Text>

          {/* Footer with target link, change pills, expand chevron */}
          {(targetLink || hasDiffs || legacyFields.length > 0) ? (
            <View className="mt-3 pt-2.5 border-t border-admin-border-soft flex-row items-center flex-wrap gap-1.5">
              {targetLink && a.targetName ? (
                <View className="flex-row items-center gap-1 mr-2">
                  <Feather name="arrow-right" size={11} color="#0e7c4a" />
                  <Text className="font-plex-medium text-[11px] text-admin-accent">
                    {a.targetName}
                  </Text>
                </View>
              ) : null}

              {/* Compact diff pills (first 2) */}
              {diffs.slice(0, 2).map((d, i) => (
                <DiffPillCompact key={i} diff={d} />
              ))}
              {diffs.length > 2 ? (
                <Text
                  className="font-plex-mono text-[10px] text-admin-fg-soft"
                  style={{ letterSpacing: 0.3 }}
                >
                  +{diffs.length - 2} more
                </Text>
              ) : null}

              {/* Legacy fields */}
              {!hasDiffs &&
                legacyFields.map((f, i) => (
                  <View
                    key={i}
                    className="px-1.5 py-0.5 rounded-sm border border-admin-border-soft bg-admin-bg"
                  >
                    <Text
                      className="font-plex-mono text-[9px] text-admin-fg-muted"
                      style={{ letterSpacing: 0.3 }}
                    >
                      changed: <Text className="text-admin-fg">{f}</Text>
                    </Text>
                  </View>
                ))}

              {hasDiffs ? (
                <View className="ml-auto flex-row items-center gap-1 rounded-md bg-admin-bg px-2 py-0.5">
                  <Text
                    className="font-plex-mono-medium text-[9px] uppercase text-admin-fg-muted"
                    style={{ letterSpacing: 1 }}
                  >
                    {expanded ? "Hide" : "Diff"}
                  </Text>
                  <Feather
                    name={expanded ? "chevron-up" : "chevron-down"}
                    size={11}
                    color="#5a6470"
                  />
                </View>
              ) : null}
            </View>
          ) : null}
        </Pressable>

        {/* Expanded diff */}
        {expanded && hasDiffs ? (
          <View className="border-t border-admin-border-soft bg-admin-bg/40 px-4 py-3">
            <Text
              className="font-plex-mono-medium text-[10px] uppercase text-admin-fg-soft mb-2"
              style={{ letterSpacing: 1.5 }}
            >
              Changes ({diffs.length})
            </Text>
            <View className="gap-2">
              {diffs.map((d, i) => (
                <DiffRow key={i} diff={d} />
              ))}
            </View>
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}

/* ─────────── Diff helpers ─────────── */

function DiffPillCompact({ diff }: { diff: DiffEntry }) {
  const before = formatValue(diff.before);
  const after = formatValue(diff.after);
  return (
    <View
      className="flex-row items-center gap-1 px-1.5 py-0.5 rounded-sm border border-admin-border-soft bg-admin-bg max-w-full"
    >
      <Text
        className="font-plex-mono text-[9px] text-admin-fg-soft"
        style={{ letterSpacing: 0.3 }}
        numberOfLines={1}
      >
        {prettyField(diff.field)}:
      </Text>
      <Text
        className="font-plex-mono text-[9px] text-admin-danger"
        style={{ letterSpacing: 0.3, textDecorationLine: "line-through" }}
        numberOfLines={1}
      >
        {truncate(before, 14)}
      </Text>
      <Text className="font-plex-mono text-[9px] text-admin-fg-soft">→</Text>
      <Text
        className="font-plex-mono text-[9px] font-medium text-admin-accent"
        style={{ letterSpacing: 0.3 }}
        numberOfLines={1}
      >
        {truncate(after, 14)}
      </Text>
    </View>
  );
}

function DiffRow({ diff }: { diff: DiffEntry }) {
  // Features array — show count + add/remove
  if (
    diff.field === "features" &&
    Array.isArray(diff.before) &&
    Array.isArray(diff.after)
  ) {
    const before = diff.before as string[];
    const after = diff.after as string[];
    const added = after.filter((x) => !before.includes(x));
    const removed = before.filter((x) => !after.includes(x));
    return (
      <View className="rounded-md border border-admin-border bg-admin-surface p-3">
        <View className="flex-row items-baseline justify-between">
          <Text
            className="font-plex-mono-medium text-[10px] uppercase text-admin-fg"
            style={{ letterSpacing: 1.2 }}
          >
            features
          </Text>
          <Text
            className="font-plex-mono text-[10px] text-admin-fg-soft tabular-nums"
            style={{ letterSpacing: 0.3 }}
          >
            {before.length} → {after.length}
          </Text>
        </View>
        {added.length > 0 || removed.length > 0 ? (
          <View className="mt-2 gap-1">
            {added.map((x, i) => (
              <View
                key={`a-${i}`}
                className="flex-row items-baseline gap-2"
              >
                <Text className="font-plex-mono text-[10px] text-admin-accent">
                  +
                </Text>
                <Text className="font-plex text-[12px] text-admin-accent flex-1">
                  {x}
                </Text>
              </View>
            ))}
            {removed.map((x, i) => (
              <View
                key={`r-${i}`}
                className="flex-row items-baseline gap-2"
              >
                <Text className="font-plex-mono text-[10px] text-admin-danger">
                  −
                </Text>
                <Text
                  className="font-plex text-[12px] text-admin-danger flex-1"
                  style={{ textDecorationLine: "line-through", opacity: 0.7 }}
                >
                  {x}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    );
  }

  // Booleans — render with chips
  if (typeof diff.before === "boolean" && typeof diff.after === "boolean") {
    return (
      <View className="rounded-md border border-admin-border bg-admin-surface px-3 py-2.5">
        <Text
          className="font-plex-mono-medium text-[10px] uppercase text-admin-fg mb-2"
          style={{ letterSpacing: 1.2 }}
        >
          {prettyField(diff.field)}
        </Text>
        <View className="flex-row items-center gap-2">
          <View
            className={`px-2 py-0.5 rounded-full ${
              diff.before
                ? "bg-admin-accent-soft"
                : "bg-admin-border-soft"
            }`}
          >
            <Text
              className={`font-plex-mono-medium text-[9px] uppercase ${
                diff.before
                  ? "text-admin-accent"
                  : "text-admin-fg-soft"
              }`}
              style={{ letterSpacing: 1.2 }}
            >
              {diff.before ? "On" : "Off"}
            </Text>
          </View>
          <Text className="text-admin-fg-soft">→</Text>
          <View
            className={`px-2 py-0.5 rounded-full ${
              diff.after ? "bg-admin-accent-soft" : "bg-admin-border-soft"
            }`}
          >
            <Text
              className={`font-plex-mono-medium text-[9px] uppercase ${
                diff.after ? "text-admin-accent" : "text-admin-fg-soft"
              }`}
              style={{ letterSpacing: 1.2 }}
            >
              {diff.after ? "On" : "Off"}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  // Long strings — vertical layout
  const before = formatValue(diff.before);
  const after = formatValue(diff.after);
  const isLong = before.length > 30 || after.length > 30;

  if (isLong) {
    return (
      <View className="rounded-md border border-admin-border bg-admin-surface p-3">
        <Text
          className="font-plex-mono-medium text-[10px] uppercase text-admin-fg mb-2"
          style={{ letterSpacing: 1.2 }}
        >
          {prettyField(diff.field)}
        </Text>
        <View className="rounded bg-admin-danger-soft/50 px-2.5 py-1.5">
          <Text
            className="font-plex-mono-medium text-[8px] uppercase text-admin-danger"
            style={{ letterSpacing: 1.2 }}
          >
            Was
          </Text>
          <Text className="mt-0.5 font-plex text-[12px] leading-[18px] text-admin-fg">
            {before}
          </Text>
        </View>
        <View className="mt-1.5 rounded bg-admin-accent-soft/60 px-2.5 py-1.5">
          <Text
            className="font-plex-mono-medium text-[8px] uppercase text-admin-accent"
            style={{ letterSpacing: 1.2 }}
          >
            Now
          </Text>
          <Text className="mt-0.5 font-plex text-[12px] leading-[18px] text-admin-fg">
            {after}
          </Text>
        </View>
      </View>
    );
  }

  // Short value — single row
  return (
    <View className="rounded-md border border-admin-border bg-admin-surface px-3 py-2.5">
      <Text
        className="font-plex-mono-medium text-[10px] uppercase text-admin-fg mb-1"
        style={{ letterSpacing: 1.2 }}
      >
        {prettyField(diff.field)}
      </Text>
      <View className="flex-row items-center gap-2">
        <Text
          className="font-plex-mono text-[12px] text-admin-fg-muted tabular-nums flex-1"
          style={{
            letterSpacing: 0.3,
            textDecorationLine: "line-through",
            opacity: 0.7,
          }}
          numberOfLines={1}
        >
          {before}
        </Text>
        <Text className="text-admin-fg-soft">→</Text>
        <Text
          className="font-plex-mono-medium text-[12px] text-admin-accent tabular-nums flex-1"
          style={{ letterSpacing: 0.3 }}
          numberOfLines={1}
        >
          {after}
        </Text>
      </View>
    </View>
  );
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return v.toLocaleString("en-IN");
  if (typeof v === "string") return v.length === 0 ? "—" : v;
  if (Array.isArray(v)) return `[${v.length} items]`;
  return JSON.stringify(v);
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

function prettyField(f: string): string {
  const map: Record<string, string> = {
    priceLabel: "Price",
    priceAmount: "Amount",
    priceSuffix: "Suffix",
    seatLimit: "Seats",
    matterLimit: "Matters",
    sortOrder: "Order",
    isPopular: "Popular",
    showOnLanding: "Landing",
    isActive: "Active",
    ctaLabel: "CTA",
    billingCycle: "Cycle",
    primaryContactName: "Contact",
    trialEndDate: "Trial end",
    trialExtendedBy: "Extended",
    label: "Label",
    tagline: "Tagline",
    description: "Description",
    name: "Name",
    phone: "Phone",
    city: "City",
    state: "State",
    plan: "Plan",
    status: "Status",
    features: "Features",
  };
  return map[f] ?? f;
}

function actionColor(action: string): {
  border: string;
  dot: string;
  tag: string;
  tagText: string;
} {
  if (action === "partner_created" || action === "plan_updated")
    return {
      border: "border-admin-accent",
      dot: "bg-admin-accent",
      tag: "bg-admin-accent-soft",
      tagText: "text-admin-accent",
    };
  if (action === "partner_password_reset")
    return {
      border: "border-admin-warning",
      dot: "bg-admin-warning",
      tag: "bg-admin-warning-soft",
      tagText: "text-admin-warning",
    };
  if (action === "partner_suspended" || action === "partner_deleted")
    return {
      border: "border-admin-danger",
      dot: "bg-admin-danger",
      tag: "bg-admin-danger-soft",
      tagText: "text-admin-danger",
    };
  if (
    action === "partner_updated" ||
    action === "partner_plan_changed" ||
    action === "partner_trial_extended" ||
    action === "partner_unsuspended"
  )
    return {
      border: "border-admin-saffron",
      dot: "bg-admin-saffron",
      tag: "bg-admin-saffron-soft",
      tagText: "text-admin-saffron",
    };
  return {
    border: "border-admin-border",
    dot: "bg-admin-fg-soft",
    tag: "bg-admin-bg",
    tagText: "text-admin-fg-muted",
  };
}

function relativeTime(d: Date): string {
  const diff = Date.now() - d.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  const week = Math.floor(day / 7);
  if (week < 5) return `${week}w ago`;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function groupByDay<T extends { createdAt: string }>(items: T[]): {
  label: string;
  items: T[];
}[] {
  const groups: { label: string; items: T[] }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  function dayLabel(d: Date): string {
    const ds = new Date(d);
    ds.setHours(0, 0, 0, 0);
    if (ds.getTime() === today.getTime()) return "Today";
    if (ds.getTime() === yesterday.getTime()) return "Yesterday";
    return d.toLocaleDateString("en-IN", {
      weekday: "long",
      day: "2-digit",
      month: "long",
    });
  }

  for (const it of items) {
    const label = dayLabel(new Date(it.createdAt));
    const last = groups[groups.length - 1];
    if (last && last.label === label) {
      last.items.push(it);
    } else {
      groups.push({ label, items: [it] });
    }
  }
  return groups;
}

function EmptyState() {
  return (
    <View className="items-center pt-16">
      <View className="h-12 w-12 rounded-full bg-admin-accent-soft items-center justify-center">
        <Feather name="activity" size={20} color="#0e7c4a" />
      </View>
      <Text className="mt-4 font-plex-bold text-[16px] text-admin-fg">
        Nothing to show yet
      </Text>
      <Text className="mt-1 font-plex text-[13px] text-admin-fg-muted text-center max-w-xs">
        Partner creations, edits, password resets, and suspensions land here.
      </Text>
    </View>
  );
}
