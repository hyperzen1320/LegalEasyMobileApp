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
import { adminListPartners, type AdminPartner } from "../../../lib/api";

export default function PartnersList() {
  const router = useRouter();
  const [partners, setPartners] = useState<AdminPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await adminListPartners();
      setPartners(data.partners);
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

  // Reload when this tab regains focus (e.g., after creating a partner)
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

  return (
    <View className="flex-1 bg-admin-bg">
      <StatusBar style="dark" backgroundColor="#fafaf7" />
      <SafeAreaView className="flex-1" edges={["top"]}>
        <TopBar count={partners.length} />
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#0e7c4a" size="large" />
          </View>
        ) : (
          <ScrollView
            contentContainerClassName="px-5 pt-5 pb-6"
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

            {partners.length === 0 ? (
              <EmptyState onAdd={() => router.push("/(admin)/partners/new")} />
            ) : (
              <View className="gap-3">
                {partners.map((p, i) => (
                  <PartnerCard key={p.id} partner={p} delay={i * 40} />
                ))}
              </View>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

function TopBar({ count }: { count: number }) {
  const router = useRouter();
  return (
    <View className="bg-admin-surface border-b border-admin-border">
      <View className="h-[2px] bg-admin-accent" />
      <View className="px-5 py-3.5 flex-row items-center justify-between">
        <View>
          <Text
            className="font-plex-mono-medium text-[10px] uppercase text-admin-accent"
            style={{ letterSpacing: 1.8 }}
          >
            Subscribers
          </Text>
          <View className="flex-row items-baseline gap-2 mt-0.5">
            <Text className="font-plex-bold text-[18px] text-admin-fg">
              Partners
            </Text>
            {count > 0 ? (
              <Text
                className="font-plex-mono text-[11px] text-admin-fg-soft tabular-nums"
              >
                · {count} total
              </Text>
            ) : null}
          </View>
        </View>
        <Pressable
          onPress={() => router.push("/(admin)/partners/new")}
          hitSlop={6}
          className="bg-admin-accent active:bg-admin-accent-hover rounded-md flex-row items-center gap-1.5 px-3 py-2"
        >
          <Feather name="plus" size={14} color="white" />
          <Text className="font-plex-bold text-[12px] text-white">Add</Text>
        </Pressable>
      </View>
    </View>
  );
}

function PartnerCard({
  partner: p,
  delay,
}: {
  partner: AdminPartner;
  delay: number;
}) {
  const router = useRouter();
  const isTrial = p.status === "trial";
  const isSuspended = p.status === "suspended" || p.status === "cancelled";
  const trialEnd = new Date(p.endDate);
  const trialStart = new Date(p.startDate);
  const now = new Date();
  const totalMs = trialEnd.getTime() - trialStart.getTime();
  const elapsedMs = Math.max(0, now.getTime() - trialStart.getTime());
  const progressPct = Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100));
  const daysLeft = Math.max(
    0,
    Math.ceil((trialEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
  );
  const trialOver = isTrial && daysLeft <= 0;

  return (
    <Animated.View entering={FadeInDown.duration(450).delay(delay)}>
      <Pressable
        onPress={() => router.push(`/(admin)/partners/${p.id}`)}
        className="bg-admin-surface border border-admin-border rounded-lg p-4 active:bg-admin-bg"
      >
        {/* top row */}
        <View className="flex-row items-start justify-between gap-3 mb-3">
          <StatusBadge status={p.status} />
          <PlanBadge plan={p.plan} />
        </View>

        {/* name + slug */}
        <Text className="font-plex-bold text-[18px] text-admin-fg leading-tight">
          {p.name}
        </Text>
        <Text
          className="mt-1 font-plex-mono text-[10px] text-admin-fg-soft"
          style={{ letterSpacing: 0.5 }}
        >
          /{p.slug}
        </Text>

        {/* contact rows */}
        <View className="mt-3 gap-1">
          <View className="flex-row items-center gap-2">
            <Feather name="mail" size={12} color="#5a6470" />
            <Text
              className="font-plex-mono text-[11px] text-admin-fg-muted flex-1"
              style={{ letterSpacing: 0.3 }}
              numberOfLines={1}
            >
              {p.primaryEmail}
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Feather name="phone" size={12} color="#5a6470" />
            <Text
              className="font-plex-mono text-[11px] text-admin-fg-muted"
              style={{ letterSpacing: 0.3 }}
            >
              {p.phone || "—"}
            </Text>
          </View>
          {(p.city || p.state) ? (
            <View className="flex-row items-center gap-2">
              <Feather name="map-pin" size={12} color="#5a6470" />
              <Text className="font-plex text-[11px] text-admin-fg-muted">
                {[p.city, p.state].filter(Boolean).join(", ")}
              </Text>
            </View>
          ) : null}
        </View>

        {/* status footer */}
        <View className="mt-4 pt-3 border-t border-admin-border-soft">
          {isTrial && !trialOver ? (
            <>
              <View className="flex-row items-baseline justify-between">
                <Text className="font-plex text-[11px] text-admin-fg-muted">
                  Trial ends in
                </Text>
                <Text
                  className="font-plex-bold text-[13px] text-admin-saffron tabular-nums"
                >
                  {daysLeft} {daysLeft === 1 ? "day" : "days"}
                </Text>
              </View>
              <View className="mt-1.5 h-[3px] bg-admin-border-soft rounded-full overflow-hidden">
                <View
                  className="h-full bg-admin-saffron"
                  style={{ width: `${progressPct}%` }}
                />
              </View>
            </>
          ) : trialOver ? (
            <Text className="font-plex-mono-medium text-[10px] uppercase text-admin-danger" style={{ letterSpacing: 1 }}>
              Trial expired · login blocked
            </Text>
          ) : isSuspended ? (
            <Text
              className="font-plex-mono-medium text-[10px] uppercase text-admin-danger"
              style={{ letterSpacing: 1 }}
            >
              Login blocked
            </Text>
          ) : (
            <View className="flex-row items-center gap-2">
              <View className="h-1.5 w-1.5 rounded-full bg-admin-accent" />
              <Text className="font-plex text-[11px] text-admin-fg-muted">
                Active since{" "}
                {new Date(p.startDate).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </Text>
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; fg: string; dot: string }> = {
    active: { bg: "bg-admin-accent-soft", fg: "text-admin-accent", dot: "bg-admin-accent" },
    trial: { bg: "bg-admin-saffron-soft", fg: "text-admin-saffron", dot: "bg-admin-saffron" },
    past_due: { bg: "bg-admin-warning-soft", fg: "text-admin-warning", dot: "bg-admin-warning" },
    cancelled: { bg: "bg-admin-danger-soft", fg: "text-admin-danger", dot: "bg-admin-danger" },
    suspended: { bg: "bg-admin-danger-soft", fg: "text-admin-danger", dot: "bg-admin-danger" },
  };
  const s = map[status] ?? map.trial;
  return (
    <View
      className={`flex-row items-center gap-1.5 px-2 py-0.5 rounded-full ${s.bg}`}
    >
      <View className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      <Text
        className={`font-plex-mono-medium text-[9px] uppercase ${s.fg}`}
        style={{ letterSpacing: 1.2 }}
      >
        {status.replace("_", " ")}
      </Text>
    </View>
  );
}

function PlanBadge({ plan }: { plan: string }) {
  const isTrial = plan === "trial";
  return (
    <View
      className={`px-2 py-0.5 rounded-sm border ${
        isTrial
          ? "border-admin-saffron/40 bg-admin-saffron-soft"
          : "border-admin-border bg-admin-bg"
      }`}
    >
      <Text
        className={`font-plex-mono-medium text-[9px] uppercase ${
          isTrial ? "text-admin-saffron" : "text-admin-fg-muted"
        }`}
        style={{ letterSpacing: 1.2 }}
      >
        {plan}
      </Text>
    </View>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <View className="items-center pt-16">
      <View className="h-14 w-14 rounded-full bg-admin-accent-soft items-center justify-center">
        <Feather name="users" size={22} color="#0e7c4a" />
      </View>
      <Text className="mt-5 font-plex-bold text-[20px] text-admin-fg">
        No partners yet
      </Text>
      <Text className="mt-2 font-plex text-[14px] text-admin-fg-muted text-center max-w-xs">
        Get the platform going by adding the first chambers. Their primary
        contact will be the partner-admin login.
      </Text>
      <Pressable
        onPress={onAdd}
        className="mt-7 bg-admin-accent rounded-md px-5 py-3 flex-row items-center gap-2"
      >
        <Feather name="plus" size={16} color="white" />
        <Text className="font-plex-bold text-[13px] text-white">
          Add the first Partner
        </Text>
      </Pressable>
    </View>
  );
}
