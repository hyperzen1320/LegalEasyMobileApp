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
import { adminListPlans, type AdminPlan } from "../../../lib/api";

export default function SubscriptionsList() {
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await adminListPlans();
      setPlans(data.plans);
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

  return (
    <View className="flex-1 bg-admin-bg">
      <StatusBar style="dark" backgroundColor="#fafaf7" />
      <SafeAreaView className="flex-1" edges={["top"]}>
        <TopBar />
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

            <View className="gap-3">
              {plans.map((p, i) => (
                <PlanCard key={p.key} plan={p} delay={i * 60} />
              ))}
            </View>

            {/* Tip */}
            <View className="mt-6 rounded-lg border border-admin-accent/20 bg-admin-accent-soft px-4 py-3.5">
              <Text
                className="font-plex-mono-medium text-[10px] uppercase text-admin-accent"
                style={{ letterSpacing: 1.5 }}
              >
                Tip · § 03
              </Text>
              <Text className="mt-1.5 font-plex text-[12px] leading-[19px] text-admin-fg">
                Saves push to the database AND refresh the public landing page
                instantly. The Trial plan is internal — only the other three
                show on legaleasy.in.
              </Text>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

function TopBar() {
  return (
    <View className="bg-admin-surface border-b border-admin-border">
      <View className="h-[2px] bg-admin-accent" />
      <View className="px-5 py-3.5">
        <Text
          className="font-plex-mono-medium text-[10px] uppercase text-admin-accent"
          style={{ letterSpacing: 1.8 }}
        >
          Catalogue
        </Text>
        <Text className="mt-0.5 font-plex-bold text-[18px] text-admin-fg">
          Subscriptions
        </Text>
      </View>
    </View>
  );
}

function PlanCard({ plan: p, delay }: { plan: AdminPlan; delay: number }) {
  const router = useRouter();
  const accent = p.isTrial ? "saffron" : "emerald";
  const accentBorder =
    accent === "saffron"
      ? "border-admin-saffron/40"
      : p.isPopular
        ? "border-admin-accent"
        : "border-admin-border";
  const tagBg =
    accent === "saffron"
      ? "bg-admin-saffron-soft"
      : "bg-admin-accent-soft";
  const tagText =
    accent === "saffron" ? "text-admin-saffron" : "text-admin-accent";

  const fmtLimit = (n: number) =>
    n >= 999999 ? "∞" : n.toLocaleString("en-IN");

  return (
    <Animated.View entering={FadeInDown.duration(450).delay(delay)}>
      <Pressable
        onPress={() => router.push(`/(admin)/subscriptions/${p.key}`)}
        className={`bg-admin-surface border-2 rounded-lg p-4 active:bg-admin-bg ${accentBorder}`}
      >
        {/* Top row: key tag + flags */}
        <View className="flex-row items-start justify-between gap-2 mb-3">
          <View
            className={`px-2 py-0.5 rounded-full ${tagBg}`}
          >
            <Text
              className={`font-plex-mono-medium text-[9px] uppercase ${tagText}`}
              style={{ letterSpacing: 1.2 }}
            >
              /{p.key}
            </Text>
          </View>
          <View className="flex-row flex-wrap items-center gap-1 justify-end max-w-[60%]">
            {p.isPopular ? (
              <View className="px-1.5 py-0.5 rounded-sm bg-admin-fg">
                <Text
                  className="font-plex-mono-medium text-[8px] uppercase text-white"
                  style={{ letterSpacing: 1.2 }}
                >
                  Popular
                </Text>
              </View>
            ) : null}
            {p.showOnLanding ? (
              <View className="px-1.5 py-0.5 rounded-sm border border-admin-accent/30 bg-admin-accent-soft">
                <Text
                  className="font-plex-mono-medium text-[8px] uppercase text-admin-accent"
                  style={{ letterSpacing: 1.2 }}
                >
                  Landing
                </Text>
              </View>
            ) : (
              <View className="px-1.5 py-0.5 rounded-sm border border-admin-border bg-admin-bg">
                <Text
                  className="font-plex-mono-medium text-[8px] uppercase text-admin-fg-soft"
                  style={{ letterSpacing: 1.2 }}
                >
                  Internal
                </Text>
              </View>
            )}
            {!p.isActive ? (
              <View className="px-1.5 py-0.5 rounded-sm border border-admin-danger/30 bg-admin-danger-soft">
                <Text
                  className="font-plex-mono-medium text-[8px] uppercase text-admin-danger"
                  style={{ letterSpacing: 1.2 }}
                >
                  Hidden
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Name + tagline */}
        <Text className="font-plex-bold text-[20px] text-admin-fg leading-tight">
          {p.label}
        </Text>
        <Text className="mt-1 font-plex text-[12px] text-admin-fg-muted">
          {p.tagline}
        </Text>

        {/* Price */}
        <View className="mt-4 flex-row items-baseline gap-1.5">
          <Text className="font-plex-bold text-[28px] text-admin-fg tabular-nums leading-none">
            {p.priceLabel}
          </Text>
          {p.priceSuffix ? (
            <Text
              className="font-plex-mono-medium text-[10px] uppercase text-admin-fg-soft"
              style={{ letterSpacing: 1.3 }}
            >
              {p.priceSuffix}
            </Text>
          ) : null}
        </View>

        {/* Stats footer */}
        <View className="mt-4 pt-3 border-t border-admin-border-soft flex-row items-center justify-between">
          <Stat label="Seats" value={fmtLimit(p.seatLimit)} />
          <Stat label="Matters" value={fmtLimit(p.matterLimit)} />
          <Stat label="Features" value={String(p.features.length)} />
          <View className="flex-row items-center gap-1">
            <Text
              className="font-plex-mono-medium text-[10px] uppercase text-admin-accent"
              style={{ letterSpacing: 1.3 }}
            >
              Edit
            </Text>
            <Feather name="arrow-right" size={12} color="#0e7c4a" />
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text
        className="font-plex-mono-medium text-[8px] uppercase text-admin-fg-soft"
        style={{ letterSpacing: 1.2 }}
      >
        {label}
      </Text>
      <Text className="mt-0.5 font-plex-bold text-[14px] text-admin-fg tabular-nums">
        {value}
      </Text>
    </View>
  );
}
