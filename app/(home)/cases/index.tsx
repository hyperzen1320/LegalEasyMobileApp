import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
  partnerListCases,
  type CaseListFilters,
  type PartnerCase,
} from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";
import ExportSheet from "../../../components/ExportSheet";
import CaseFilterSheet, {
  countActive,
  type CaseFilterLabels,
} from "../../../components/cases/CaseFilterSheet";
import CaseDetailView from "../../../components/cases/CaseDetailView";
import { useBreakpoint } from "../../../lib/useBreakpoint";
import { formatDateForDisplay } from "../../../components/CaseFields";
import {
  CASE_EXPORT_COLUMNS,
  CASE_EXPORT_DEFAULT_KEYS,
  exportCases,
} from "../../../lib/exports";

const PAGE_SIZE = 50;

export default function CaseVault() {
  const router = useRouter();
  // Exports are office-admin only (server enforces role=admin; the
  // partner admin is the only mobile user that maps to it — /me doesn't
  // carry staff roles, so staff-admins export from the web).
  const { isPartnerAdmin } = useAuth();
  const [cases, setCases] = useState<PartnerCase[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  // Debounced copy of the search box — this is what actually hits the
  // server (the list, like the web vault, filters server-side).
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<CaseListFilters>({});
  const [filterLabels, setFilterLabels] = useState<CaseFilterLabels>({});
  const [filterOpen, setFilterOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Tablet two-pane: ≥840dp the vault keeps the list on the left and
  // embeds the dossier on the right. Phones keep the pushed [id] route
  // (which stays registered either way, so deep links never break).
  const { isExpanded } = useBreakpoint();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const pageRef = useRef(1);
  const reqIdRef = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setSearch(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  const params = useMemo<CaseListFilters>(
    () => ({ ...filters, search: search || undefined }),
    [filters, search]
  );

  const load = useCallback(
    async (mode: "reset" | "more") => {
      const myReq = ++reqIdRef.current;
      const page = mode === "more" ? pageRef.current + 1 : 1;
      try {
        const data = await partnerListCases({
          filters: params,
          page,
          limit: PAGE_SIZE,
        });
        if (myReq !== reqIdRef.current) return; // params changed mid-flight
        pageRef.current = data.page;
        setTotal(data.total);
        setHasMore(data.hasMore);
        setCases((prev) =>
          mode === "more" ? [...prev, ...data.cases] : data.cases
        );
        setError(null);
      } catch (err) {
        if (myReq !== reqIdRef.current) return;
        setError(err instanceof Error ? err.message : "Failed to load");
      }
    },
    [params]
  );

  // Boot + every search/filter change.
  useEffect(() => {
    let alive = true;
    setLoading(true);
    load("reset").finally(() => {
      if (alive) setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [load]);

  // Silent refresh when returning to the tab (a hearing may have been
  // updated from a detail screen).
  useFocusEffect(
    useCallback(() => {
      load("reset");
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load("reset");
    setRefreshing(false);
  }, [load]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loading || loadingMore || refreshing) return;
    setLoadingMore(true);
    await load("more");
    setLoadingMore(false);
  }, [hasMore, loading, loadingMore, refreshing, load]);

  const activeFilterCount = countActive(filters);

  const clearFilter = (key: keyof CaseListFilters) => {
    setFilters((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  // Date-range chip collapses both bounds into one label.
  const filterChips = useMemo(() => {
    const chips: { key: string; label: string; clear: () => void }[] = [];
    if (filters.courtPlace) {
      chips.push({
        key: "courtPlace",
        label: filters.courtPlace,
        clear: () => clearFilter("courtPlace"),
      });
    }
    if (filters.courtId) {
      chips.push({
        key: "courtId",
        label: filterLabels.courtId ?? "Court",
        clear: () => clearFilter("courtId"),
      });
    }
    if (filters.advocateId) {
      chips.push({
        key: "advocateId",
        label: filterLabels.advocateId ?? "Filed by",
        clear: () => clearFilter("advocateId"),
      });
    }
    if (filters.fromDate || filters.toDate) {
      const from = filters.fromDate
        ? formatDateForDisplay(filters.fromDate)
        : "…";
      const to = filters.toDate ? formatDateForDisplay(filters.toDate) : "…";
      chips.push({
        key: "dates",
        label: `${from} → ${to}`,
        clear: () => {
          setFilters((prev) => {
            const next = { ...prev };
            delete next.fromDate;
            delete next.toDate;
            return next;
          });
        },
      });
    }
    return chips;
  }, [filters, filterLabels]);

  return (
    <View className="flex-1 bg-app-canvas">
      <StatusBar style="dark" backgroundColor="#f4ede0" />
      <SafeAreaView className="flex-1" edges={["top"]}>
        <TopBar
          count={total}
          onExport={isPartnerAdmin ? () => setExporting(true) : null}
        />

        <View className="flex-1 flex-row">
        {/* Left pane: search + rolls (the whole screen on phones) */}
        <View
          style={
            isExpanded
              ? {
                  width: 392,
                  borderRightWidth: 1,
                  borderRightColor: "#e3d9c0",
                }
              : { flex: 1 }
          }
        >
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
            <Pressable
              onPress={() => setFilterOpen(true)}
              hitSlop={8}
              className="active:opacity-60 flex-row items-center gap-1 pl-2"
              style={{
                borderLeftWidth: 1,
                borderLeftColor: "#efe5d0",
              }}
              accessibilityRole="button"
              accessibilityLabel="Filter cases"
            >
              <Feather
                name="sliders"
                size={15}
                color={activeFilterCount > 0 ? "#8a5821" : "#a89c80"}
              />
              {activeFilterCount > 0 ? (
                <View
                  className="items-center justify-center rounded-full"
                  style={{
                    minWidth: 15,
                    height: 15,
                    backgroundColor: "#c5853a",
                    paddingHorizontal: 3,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "DMMono-Medium",
                      fontSize: 9,
                      color: "#2a1c08",
                    }}
                  >
                    {activeFilterCount}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          </View>

          {/* Active filter chips */}
          {filterChips.length > 0 ? (
            <View className="flex-row flex-wrap mt-2" style={{ gap: 6 }}>
              {filterChips.map((chip) => (
                <Pressable
                  key={chip.key}
                  onPress={chip.clear}
                  className="flex-row items-center gap-1.5 rounded-full px-2.5 active:opacity-70"
                  style={{
                    paddingVertical: 4,
                    backgroundColor: "#efe5d0",
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Clear filter ${chip.label}`}
                >
                  <Text
                    className="text-[11px]"
                    style={{ fontFamily: "Manrope-SemiBold", color: "#4d4538" }}
                    numberOfLines={1}
                  >
                    {chip.label}
                  </Text>
                  <Feather name="x" size={11} color="#8a5821" />
                </Pressable>
              ))}
            </View>
          ) : null}
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
              data={cases}
              extraData={selectedId}
              keyExtractor={(c) => c.id}
              renderItem={({ item }) => (
                <CaseCard
                  c={item}
                  selected={isExpanded && selectedId === item.id}
                  onPress={() =>
                    isExpanded
                      ? setSelectedId(item.id)
                      : router.push(`/(home)/cases/${item.id}` as never)
                  }
                />
              )}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              onEndReached={loadMore}
              onEndReachedThreshold={0.4}
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
              ListFooterComponent={
                loadingMore ? (
                  <View className="items-center py-5">
                    <ActivityIndicator color="#c5853a" size="small" />
                  </View>
                ) : null
              }
              ListEmptyComponent={
                search || activeFilterCount > 0 ? (
                  <NoMatches
                    query={search || "filters"}
                    onClear={() => {
                      setQuery("");
                      setFilters({});
                    }}
                  />
                ) : (
                  <EmptyVault
                    onAdd={() => router.push("/(home)/cases/new")}
                  />
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
        </View>

        {/* Right pane: the dossier (tablets only) */}
        {isExpanded ? (
          <View className="flex-1">
            {selectedId ? (
              <CaseDetailView
                key={selectedId}
                caseId={selectedId}
                onDeleted={() => {
                  setSelectedId(null);
                  load("reset");
                }}
              />
            ) : (
              <View className="flex-1 items-center justify-center px-10">
                <View
                  className="h-14 w-14 items-center justify-center rounded-full"
                  style={{ backgroundColor: "#efe5d0" }}
                >
                  <Feather name="book-open" size={22} color="#8a5821" />
                </View>
                <Text
                  className="mt-5 text-[20px] tracking-tight text-app-ink text-center"
                  style={{ fontFamily: "Crimson-SemiBold" }}
                >
                  Pick a matter from the rolls.
                </Text>
                <Text
                  className="mt-2 text-[13px] text-app-fg-muted text-center max-w-[300px]"
                  style={{ fontFamily: "Manrope" }}
                >
                  Its full dossier — dates, documents, contacts — opens
                  right here.
                </Text>
              </View>
            )}
          </View>
        ) : null}
        </View>
      </SafeAreaView>

      <ExportSheet
        visible={exporting}
        onClose={() => setExporting(false)}
        eyebrow="Case Vault"
        title="Export the case rolls"
        contextLine={
          activeFilterCount > 0 || search
            ? `Current view · ${total} matters (filters carry into the file)`
            : `All active matters · ${total}`
        }
        columns={{
          // "Disposed On" is always empty on the active vault; the
          // disposed archive export offers it instead.
          catalog: CASE_EXPORT_COLUMNS.filter((c) => c.key !== "disposedAt"),
          defaultKeys: CASE_EXPORT_DEFAULT_KEYS,
        }}
        run={(format, columnKeys) =>
          exportCases(format, { filters: params, columns: columnKeys })
        }
      />

      <CaseFilterSheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        value={filters}
        onApply={(next, labels) => {
          setFilters(next);
          setFilterLabels(labels);
        }}
      />
    </View>
  );
}

function RowGap() {
  return <View style={{ height: 12 }} />;
}

function TopBar({
  count,
  onExport,
}: {
  count: number;
  onExport?: (() => void) | null;
}) {
  const router = useRouter();
  const onArchive = () => router.push("/(home)/cases/disposed" as never);
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
        onPress={onArchive}
        hitSlop={6}
        className="rounded-md items-center justify-center mr-2.5 active:opacity-70"
        style={{
          height: 36,
          width: 36,
          backgroundColor: "#ffffff",
          borderWidth: 1,
          borderColor: "#e3d9c0",
          marginLeft: "auto",
        }}
        accessibilityRole="button"
        accessibilityLabel="Disposed cases archive"
      >
        <Feather name="archive" size={15} color="#8a5821" />
      </Pressable>
      {onExport ? (
        <Pressable
          onPress={onExport}
          hitSlop={6}
          className="rounded-md items-center justify-center mr-2.5 active:opacity-70"
          style={{
            height: 36,
            width: 36,
            backgroundColor: "#ffffff",
            borderWidth: 1,
            borderColor: "#e3d9c0",
          }}
          accessibilityRole="button"
          accessibilityLabel="Export case rolls"
        >
          <Feather name="download" size={15} color="#8a5821" />
        </Pressable>
      ) : null}
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

function CaseCard({
  c,
  onPress,
  selected,
}: {
  c: PartnerCase;
  onPress: () => void;
  selected?: boolean;
}) {
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
      onPress={onPress}
      className="rounded-xl bg-app-paper p-4 active:opacity-90"
      style={{
        shadowColor: "#0a1124",
        shadowOpacity: 0.05,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 1 },
        elevation: 1,
        borderLeftWidth: 3,
        borderLeftColor: "#c5853a",
        borderWidth: selected ? 1.5 : 0,
        borderColor: selected ? "#c5853a" : "transparent",
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
