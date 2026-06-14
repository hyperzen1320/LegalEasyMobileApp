import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Linking,
  Alert,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useFocusEffect, useRouter } from "expo-router";
import { Feather, FontAwesome } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { partnerListClients, type PartnerClient } from "../../../lib/api";

export default function ClientCrew() {
  const router = useRouter();
  const [clients, setClients] = useState<PartnerClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await partnerListClients();
      setClients(data.clients);
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q) ||
        (c.phone || "").toLowerCase().includes(q) ||
        (c.whatsapp || "").toLowerCase().includes(q) ||
        (c.address || "").toLowerCase().includes(q)
    );
  }, [clients, query]);

  return (
    <View className="flex-1 bg-app-canvas">
      <StatusBar style="dark" backgroundColor="#f4ede0" />
      <SafeAreaView className="flex-1" edges={["top"]}>
        <TopBar count={clients.length} />

        {/* Search */}
        <View className="px-5 pt-4 pb-2 bg-app-canvas">
          <View
            className="flex-row items-center gap-2 rounded-xl bg-app-paper px-3.5 py-2.5"
            style={{
              shadowColor: "#0a1124",
              shadowOpacity: 0.04,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 1 },
              elevation: 1,
            }}
          >
            <Feather name="search" size={15} color="#a89c80" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search by name, phone or email..."
              placeholderTextColor="#a89c80"
              autoCapitalize="none"
              autoCorrect={false}
              className="flex-1 text-[14px] text-app-ink"
              style={{ fontFamily: "Manrope", paddingVertical: 0 }}
            />
            {query.length > 0 ? (
              <Pressable
                onPress={() => setQuery("")}
                hitSlop={8}
                className="active:opacity-50"
              >
                <Feather name="x" size={15} color="#8a5821" />
              </Pressable>
            ) : null}
          </View>
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#c5853a" size="large" />
          </View>
        ) : (
          // FlashList recycles rows — entrance animation stays on the
          // container so it doesn't replay while scrolling.
          <Animated.View
            entering={FadeInDown.duration(380)}
            className="flex-1"
          >
            <FlashList
              data={filtered}
              keyExtractor={(c) => c.id}
              renderItem={({ item }) => (
                <ClientCard
                  c={item}
                  onPress={() =>
                    router.push(`/(home)/clients/${item.id}` as never)
                  }
                />
              )}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              contentContainerStyle={{
                paddingHorizontal: 20,
                paddingTop: 12,
                paddingBottom: 24,
              }}
              ItemSeparatorComponent={RowGap}
              ListHeaderComponent={
                error ? (
                  <View className="rounded-md border border-app-danger/30 bg-app-danger-soft px-4 py-3 mb-4">
                    <Text
                      className="text-[13px] text-app-fg"
                      style={{ fontFamily: "Manrope" }}
                    >
                      {error}
                    </Text>
                  </View>
                ) : null
              }
              ListEmptyComponent={
                clients.length === 0 ? (
                  <EmptyCrew
                    onAdd={() => router.push("/(home)/clients/new")}
                  />
                ) : (
                  <NoMatches query={query} onClear={() => setQuery("")} />
                )
              }
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor="#c5853a"
                />
              }
            />
          </Animated.View>
        )}
      </SafeAreaView>
    </View>
  );
}

function TopBar({ count }: { count: number }) {
  const router = useRouter();
  return (
    <View className="border-b border-app-edge bg-app-canvas px-5 py-3.5 flex-row items-center justify-between">
      <View className="flex-row items-center gap-3 flex-1">
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          className="active:opacity-50"
        >
          <Feather name="arrow-left" size={18} color="#0a1124" />
        </Pressable>
        <View className="flex-1">
          <Text
            className="text-[10px] uppercase text-app-copper-deep"
            style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.8 }}
          >
            The Crew
          </Text>
          <View className="flex-row items-baseline gap-2 mt-0.5">
            <Text
              className="text-[18px] font-semibold tracking-tight text-app-ink leading-none"
              style={{ fontFamily: "Crimson-SemiBold" }}
            >
              Client Crew
            </Text>
            {count > 0 ? (
              <Text
                className="text-[11px] text-app-fg-muted tabular-nums"
                style={{ fontFamily: "DMMono", letterSpacing: 0.5 }}
              >
                · {count}
              </Text>
            ) : null}
          </View>
        </View>
      </View>
      <Pressable
        onPress={() => router.push("/(home)/clients/new")}
        className="rounded-md flex-row items-center gap-1.5 px-3 py-2 active:opacity-90"
        style={{
          backgroundColor: "#c5853a",
          shadowColor: "#c5853a",
          shadowOpacity: 0.3,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 3 },
          elevation: 3,
        }}
      >
        <Feather name="plus" size={14} color="#2a1c08" />
        <Text
          className="text-[12px] font-semibold"
          style={{ fontFamily: "Manrope-SemiBold", color: "#2a1c08" }}
        >
          New
        </Text>
      </Pressable>
    </View>
  );
}

function ClientCard({
  c,
  onPress,
}: {
  c: PartnerClient;
  onPress: () => void;
}) {
  const phone = (c.phone || "").trim();
  const wa = (c.whatsapp || c.phone || "").replace(/\D/g, "");
  const waNumber = wa.length === 10 ? `91${wa}` : wa;

  async function call() {
    const target = (phone || c.whatsapp).replace(/\s+/g, "");
    if (!target) return;
    const url = `tel:${target}`;
    try {
      const can = await Linking.canOpenURL(url);
      if (can) {
        Linking.openURL(url);
      } else {
        Alert.alert("Can't make calls from this device.");
      }
    } catch {
      Alert.alert("Couldn't open the dialer.");
    }
  }

  async function chat() {
    if (!waNumber) return;
    const native = `whatsapp://send?phone=${waNumber}`;
    const fallback = `https://wa.me/${waNumber}`;
    try {
      const can = await Linking.canOpenURL(native);
      if (can) {
        await Linking.openURL(native);
      } else {
        await Linking.openURL(fallback);
      }
    } catch {
      try {
        await Linking.openURL(fallback);
      } catch {
        Alert.alert("Couldn't open WhatsApp.");
      }
    }
  }

  async function email() {
    if (!c.email) return;
    const url = `mailto:${c.email}`;
    try {
      const can = await Linking.canOpenURL(url);
      if (can) {
        await Linking.openURL(url);
      } else {
        Alert.alert("No mail app configured.");
      }
    } catch {
      Alert.alert("Couldn't open mail.");
    }
  }

  return (
    <Pressable
      onPress={onPress}
      className="rounded-2xl bg-app-paper p-4 active:opacity-90"
      style={{
        shadowColor: "#0a1124",
        shadowOpacity: 0.05,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 1 },
        elevation: 1,
      }}
      accessibilityRole="button"
      accessibilityLabel={`Client ${c.name}`}
    >
      {/* Header row — name + cases pill */}
      <View className="flex-row items-start gap-3">
        <View className="flex-1 min-w-0">
          <Text
            className="text-[20px] font-semibold tracking-tight leading-[1.2] text-app-ink"
            style={{ fontFamily: "Crimson-SemiBold" }}
            numberOfLines={2}
          >
            {c.name}
          </Text>
          {c.address ? (
            <Text
              className="mt-1 text-[12px] text-app-fg-muted leading-[1.4]"
              style={{ fontFamily: "Manrope" }}
              numberOfLines={2}
            >
              {c.address}
            </Text>
          ) : null}
        </View>
        <View
          className="rounded-md px-2 py-1"
          style={{ backgroundColor: "#d2e6e7" }}
        >
          <Text
            className="text-[10px] font-semibold uppercase tabular-nums"
            style={{
              fontFamily: "DMMono-Medium",
              letterSpacing: 1.2,
              color: "#56a0a8",
            }}
          >
            {c.caseCount} {c.caseCount === 1 ? "case" : "cases"}
          </Text>
        </View>
      </View>

      {/* Action row */}
      <View className="mt-4 flex-row gap-2">
        <ActionButton
          icon={<Feather name="phone" size={13} color="#f5ebd6" />}
          label="Call"
          onPress={call}
          disabled={!phone && !c.whatsapp}
          variant="ink"
        />
        <ActionButton
          icon={<FontAwesome name="whatsapp" size={14} color="#0b3d22" />}
          label="WhatsApp"
          onPress={chat}
          disabled={!c.whatsapp && !c.phone}
          variant="whatsapp"
        />
        <ActionButton
          icon={<Feather name="mail" size={13} color="#4d4538" />}
          label="Email"
          onPress={email}
          disabled={!c.email}
          variant="ghost"
        />
      </View>
    </Pressable>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
  disabled,
  variant,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant: "ink" | "whatsapp" | "ghost";
}) {
  const styles =
    variant === "ink"
      ? {
          backgroundColor: "#0a1124",
          color: "#f5ebd6",
          shadowColor: "#0a1124",
        }
      : variant === "whatsapp"
        ? {
            backgroundColor: "#25d366",
            color: "#0b3d22",
            shadowColor: "#25d366",
          }
        : {
            backgroundColor: "#ffffff",
            color: "#4d4538",
            shadowColor: "transparent",
            border: 1,
          };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className="flex-1 rounded-md py-2.5 items-center justify-center flex-row gap-1.5 active:opacity-80"
      style={{
        backgroundColor: styles.backgroundColor,
        opacity: disabled ? 0.4 : 1,
        borderWidth: variant === "ghost" ? 1 : 0,
        borderColor: variant === "ghost" ? "#e3d9c0" : undefined,
        shadowColor: styles.shadowColor,
        shadowOpacity: variant === "ghost" || disabled ? 0 : 0.25,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: variant === "ghost" || disabled ? 0 : 3,
      }}
    >
      {icon}
      <Text
        className="text-[12px] font-semibold"
        style={{ fontFamily: "Manrope-SemiBold", color: styles.color }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function RowGap() {
  return <View style={{ height: 12 }} />;
}

function NoMatches({
  query,
  onClear,
}: {
  query: string;
  onClear: () => void;
}) {
  return (
    <View
      className="mt-6 rounded-xl px-5 py-10 items-center"
      style={{
        backgroundColor: "#ffffff",
        borderWidth: 1,
        borderColor: "#e3d9c0",
        borderStyle: "dashed",
      }}
    >
      <Feather name="search" size={20} color="#a89c80" />
      <Text
        className="mt-3 text-[13px] text-app-fg-muted text-center"
        style={{ fontFamily: "Manrope" }}
      >
        No matches for{" "}
        <Text
          style={{
            fontFamily: "Manrope-SemiBold",
            color: "#0a1124",
          }}
        >
          “{query}”
        </Text>
      </Text>
      <Pressable
        onPress={onClear}
        className="mt-3 rounded-md px-3 py-1.5 active:opacity-50"
        style={{ backgroundColor: "#efe5d0" }}
      >
        <Text
          className="text-[11px] uppercase"
          style={{
            fontFamily: "DMMono-Medium",
            letterSpacing: 1.5,
            color: "#8a5821",
          }}
        >
          Clear search
        </Text>
      </Pressable>
    </View>
  );
}

function EmptyCrew({ onAdd }: { onAdd: () => void }) {
  return (
    <View className="items-center pt-12">
      <View
        className="h-14 w-14 items-center justify-center rounded-full"
        style={{ backgroundColor: "#efe5d0" }}
      >
        <Feather name="users" size={22} color="#8a5821" />
      </View>
      <Text
        className="mt-5 text-[24px] font-semibold tracking-tight text-app-ink text-center"
        style={{ fontFamily: "Crimson-SemiBold" }}
      >
        No clients yet.
      </Text>
      <Text
        className="mt-2 text-[13px] text-app-fg-muted text-center max-w-[300px]"
        style={{ fontFamily: "Manrope" }}
      >
        One client, many matters. Add their name, address, and how to reach
        them — every linked case will live in one place.
      </Text>
      <Pressable
        onPress={onAdd}
        className="mt-6 rounded-md flex-row items-center gap-2 px-6 py-3 active:opacity-90"
        style={{
          backgroundColor: "#0a1124",
          shadowColor: "#0a1124",
          shadowOpacity: 0.2,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 4,
        }}
      >
        <Feather name="plus" size={14} color="#f5ebd6" />
        <Text
          className="text-[13px] font-semibold text-app-ivory"
          style={{ fontFamily: "Manrope-SemiBold" }}
        >
          Add the first client
        </Text>
      </Pressable>
    </View>
  );
}
