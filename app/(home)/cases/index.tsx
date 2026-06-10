import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useFocusEffect, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { FlashList } from "@shopify/flash-list";
import { partnerListCases, type PartnerCase } from "../../../lib/api";

export default function CaseVault() {
  const router = useRouter();
  const [cases, setCases] = useState<PartnerCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await partnerListCases();
      setCases(data.cases);
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
    if (!q) return cases;
    return cases.filter((c) => {
      return (
        c.caseNo.toLowerCase().includes(q) ||
        c.fileNo.toLowerCase().includes(q) ||
        (c.cnr || "").toLowerCase().includes(q) ||
        (c.clientName || "").toLowerCase().includes(q) ||
        (c.oppositeParty || "").toLowerCase().includes(q) ||
        (c.courtName || "").toLowerCase().includes(q) ||
        (c.courtPlace || "").toLowerCase().includes(q) ||
        (c.status || "").toLowerCase().includes(q)
      );
    });
  }, [cases, query]);

  return (
    <View className="flex-1 bg-app-canvas">
      <StatusBar style="dark" backgroundColor="#f4ede0" />
      <SafeAreaView className="flex-1" edges={["top"]}>
        <TopBar count={cases.length} />

        {/* Search bar — sticky under topbar */}
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
              placeholder="Search file no., case no., CNR, party..."
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
          // FlashList recycles rows, so the entrance stagger lives on the
          // list container — per-row `entering` would replay on recycle.
          <Animated.View
            entering={FadeInDown.duration(380)}
            className="flex-1"
          >
            <FlashList
              data={filtered}
              keyExtractor={(c) => c.id}
              renderItem={({ item }) => <CaseCard c={item} />}
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
                cases.length === 0 ? (
                  <EmptyVault
                    onAdd={() => router.push("/(home)/cases/new")}
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

function RowGap() {
  return <View style={{ height: 12 }} />;
}

function TopBar({ count }: { count: number }) {
  const router = useRouter();
  return (
    <View className="border-b border-app-edge bg-app-canvas px-5 py-3.5 flex-row items-center justify-between">
      <View>
        <Text
          className="text-[10px] uppercase text-app-copper-deep"
          style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.8 }}
        >
          The Vault
        </Text>
        <View className="flex-row items-baseline gap-2 mt-0.5">
          <Text
            className="text-[18px] font-semibold tracking-tight text-app-ink leading-none"
            style={{ fontFamily: "Crimson-SemiBold" }}
          >
            Case Vault
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
      <Pressable
        onPress={() => router.push("/(home)/cases/new")}
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
          New Case
        </Text>
      </Pressable>
    </View>
  );
}

function CaseCard({ c }: { c: PartnerCase }) {
  const router = useRouter();
  const next = c.nextHearingDate ? new Date(c.nextHearingDate) : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isToday = next && next.toDateString() === new Date().toDateString();
  const isOverdue = next && next < today;
  const isPending = !next;

  const dateBadge =
    isOverdue || isPending
      ? { bg: "#f6dccd", fg: "#c14a37" }
      : isToday
        ? { bg: "rgba(197,133,58,0.18)", fg: "#8a5821" }
        : { bg: "#d2e6e7", fg: "#56a0a8" };

  const courtLine = [c.courtName, c.courtPlace].filter(Boolean).join(", ");

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
      {/* Top row — case no, file no, status pill */}
      <View className="flex-row items-baseline gap-2 flex-wrap">
        <Text
          className="text-[18px] font-semibold tracking-tight text-app-ink"
          style={{ fontFamily: "Crimson-SemiBold" }}
        >
          {c.caseNo}
        </Text>
        {c.fileNo ? (
          <Text
            className="text-[10px] text-app-fg-muted"
            style={{ fontFamily: "DMMono", letterSpacing: 0.4 }}
          >
            {c.fileNo}
          </Text>
        ) : null}
        {c.status ? (
          <View
            className="rounded-md px-1.5 py-0.5 ml-auto"
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
      </View>

      {/* Parties */}
      {(c.clientName || c.oppositeParty) ? (
        <Text
          className="mt-2 text-[13px] text-app-fg-soft"
          style={{ fontFamily: "Manrope" }}
        >
          <Text style={{ color: "#8a5821" }}>Client </Text>
          {c.clientName ? (
            <Text
              style={{
                fontFamily: "Manrope-SemiBold",
                color: "#0a1124",
              }}
            >
              {c.clientName}
            </Text>
          ) : (
            <Text style={{ color: "#a89c80" }}>—</Text>
          )}
          {c.oppositeParty ? (
            <>
              <Text style={{ color: "#8a5821" }}>{"  vs  "}</Text>
              <Text
                style={{
                  fontFamily: "Manrope-SemiBold",
                  color: "#0a1124",
                }}
              >
                {c.oppositeParty}
              </Text>
            </>
          ) : null}
        </Text>
      ) : null}

      {/* Court + CNR */}
      {(courtLine || c.cnr) ? (
        <Text
          className="mt-1 text-[11px] text-app-fg-muted"
          style={{ fontFamily: "DMMono", letterSpacing: 0.3 }}
        >
          {courtLine}
          {courtLine && c.cnr ? "  ·  " : ""}
          {c.cnr ? `CNR ${c.cnr}` : ""}
        </Text>
      ) : null}

      {/* Footer — next date + chevron */}
      <View className="mt-3 pt-3 border-t border-app-edge-soft flex-row items-center justify-between">
        {next ? (
          <View
            className="rounded-md px-2 py-0.5"
            style={{ backgroundColor: dateBadge.bg }}
          >
            <Text
              className="text-[11px] font-semibold tabular-nums"
              style={{
                fontFamily: "DMMono-Medium",
                color: dateBadge.fg,
                letterSpacing: 0.5,
              }}
            >
              {next.toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
              {isToday ? " · TODAY" : isOverdue ? " · OVERDUE" : ""}
            </Text>
          </View>
        ) : (
          <View
            className="rounded-md px-2 py-0.5"
            style={{ backgroundColor: dateBadge.bg }}
          >
            <Text
              className="text-[10px] uppercase"
              style={{
                fontFamily: "DMMono-Medium",
                letterSpacing: 1.2,
                color: dateBadge.fg,
              }}
            >
              Pending date
            </Text>
          </View>
        )}
        <Feather name="chevron-right" size={14} color="#8a5821" />
      </View>
    </Pressable>
  );
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

function EmptyVault({ onAdd }: { onAdd: () => void }) {
  return (
    <View className="items-center pt-12">
      <View
        className="h-14 w-14 items-center justify-center rounded-full"
        style={{ backgroundColor: "#efe5d0" }}
      >
        <Feather name="briefcase" size={22} color="#8a5821" />
      </View>
      <Text
        className="mt-5 text-[24px] font-semibold tracking-tight text-app-ink text-center"
        style={{ fontFamily: "Crimson-SemiBold" }}
      >
        The vault is empty.
      </Text>
      <Text
        className="mt-2 text-[13px] text-app-fg-muted text-center max-w-[300px]"
        style={{ fontFamily: "Manrope" }}
      >
        Add your first matter — case number, court, client, status, next
        hearing date. The dashboard, hearings, and pending list all read from
        this one place.
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
          Add the first case
        </Text>
      </Pressable>
    </View>
  );
}
