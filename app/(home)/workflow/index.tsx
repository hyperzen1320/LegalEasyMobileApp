import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import BoardSettingsSheet from "../../../components/workflow/BoardSettingsSheet";
import RequestDeleteSheet from "../../../components/workflow/RequestDeleteSheet";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useFocusEffect, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import {
  partnerListBoards,
  partnerCreateBoard,
  ApiError,
  type PartnerBoard,
  type BoardColor,
  type DeleteRequestRequiredError,
} from "../../../lib/api";
import {
  BOARD_COLOR_STYLES,
  BOARD_COLORS,
} from "../../../components/BoardColors";

export default function Workflow() {
  const router = useRouter();
  const [boards, setBoards] = useState<PartnerBoard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  // "⋯" on a tile → rename / recolour / delete without opening the board.
  const [settingsFor, setSettingsFor] = useState<PartnerBoard | null>(null);
  const [requestTarget, setRequestTarget] =
    useState<DeleteRequestRequiredError | null>(null);
  // Filter / sort controls sitting beside the search box.
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterColor, setFilterColor] = useState<BoardColor | null>(null);
  const [withCardsOnly, setWithCardsOnly] = useState(false);
  const [sort, setSort] = useState<"recent" | "az">("recent");

  const load = useCallback(async () => {
    try {
      const data = await partnerListBoards();
      setBoards(data.boards);
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
    let list = boards;
    if (q) {
      list = list.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          (b.description || "").toLowerCase().includes(q)
      );
    }
    if (filterColor) list = list.filter((b) => b.color === filterColor);
    if (withCardsOnly) list = list.filter((b) => b.cardCount > 0);
    const out = [...list];
    if (sort === "az") {
      out.sort((a, b) => a.title.localeCompare(b.title));
    } else {
      // "recent" — most recently touched board first.
      out.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
    }
    return out;
  }, [boards, query, filterColor, withCardsOnly, sort]);

  const activeFilterCount =
    (filterColor ? 1 : 0) + (withCardsOnly ? 1 : 0) + (sort === "az" ? 1 : 0);

  return (
    <View className="flex-1 bg-app-canvas">
      <StatusBar style="dark" backgroundColor="#f4ede0" />
      <SafeAreaView className="flex-1" edges={["top"]}>
        <TopBar count={boards.length} />

        {/* Search + filter */}
        <View className="px-5 pt-3 pb-1 bg-app-canvas flex-row items-center gap-2">
          <View
            className="flex-1 flex-row items-center gap-2 rounded-xl bg-app-paper px-3.5 py-2.5"
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
              placeholder="Search boards"
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
          <Pressable
            onPress={() => setFilterOpen(true)}
            className="items-center justify-center rounded-xl bg-app-paper active:opacity-80"
            style={{
              width: 44,
              height: 44,
              shadowColor: "#0a1124",
              shadowOpacity: 0.04,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 1 },
              elevation: 1,
              borderWidth: activeFilterCount > 0 ? 1 : 0,
              borderColor: "#c5853a",
            }}
            accessibilityRole="button"
            accessibilityLabel="Filter and sort boards"
          >
            <Feather
              name="sliders"
              size={17}
              color={activeFilterCount > 0 ? "#c5853a" : "#8a5821"}
            />
            {activeFilterCount > 0 ? (
              <View
                style={{
                  position: "absolute",
                  top: -5,
                  right: -5,
                  minWidth: 17,
                  height: 17,
                  borderRadius: 9,
                  backgroundColor: "#c5853a",
                  alignItems: "center",
                  justifyContent: "center",
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

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#c5853a" size="large" />
          </View>
        ) : (
          // FlashList recycles rows — error + create-tile ride as the
          // header; entrance animation lives on the container.
          <Animated.View
            entering={FadeInDown.duration(380)}
            className="flex-1"
          >
            <FlashList
              data={filtered}
              keyExtractor={(b) => b.id}
              renderItem={({ item }) => (
                <BoardTile
                  board={item}
                  onOpen={() =>
                    router.push(`/(home)/workflow/${item.id}` as never)
                  }
                  onSettings={() => setSettingsFor(item)}
                />
              )}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                paddingHorizontal: 20,
                paddingTop: 12,
                paddingBottom: 48,
              }}
              ItemSeparatorComponent={TileGap}
              ListHeaderComponent={
                <View>
                  {error ? (
                    <View
                      className="rounded-md px-4 py-3 mb-4"
                      style={{ backgroundColor: "#f6dccd" }}
                    >
                      <Text
                        className="text-[13px]"
                        style={{ fontFamily: "Manrope", color: "#c14a37" }}
                      >
                        {error}
                      </Text>
                    </View>
                  ) : null}
                  <CreateTile onPress={() => setCreating(true)} />
                  <View style={{ height: 16 }} />
                </View>
              }
              ListEmptyComponent={
                query ? (
                  <View
                    className="rounded-xl px-5 py-10 items-center"
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
                  </View>
                ) : null
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

      <CreateBoardModal
        visible={creating}
        onClose={() => setCreating(false)}
        onCreated={(b) => {
          setBoards((prev) => [b, ...prev]);
          setCreating(false);
        }}
      />

      {settingsFor ? (
        <BoardSettingsSheet
          visible={Boolean(settingsFor)}
          onClose={() => setSettingsFor(null)}
          boardId={settingsFor.id}
          title={settingsFor.title}
          color={settingsFor.color}
          onSaved={({ title, color }) => {
            setBoards((prev) =>
              prev.map((b) =>
                b.id === settingsFor.id ? { ...b, title, color } : b
              )
            );
            setSettingsFor(null);
          }}
          onDeleted={() => {
            setBoards((prev) =>
              prev.filter((b) => b.id !== settingsFor.id)
            );
            setSettingsFor(null);
          }}
          onDeleteNeedsRequest={(target) => {
            setSettingsFor(null);
            setRequestTarget(target);
          }}
        />
      ) : null}

      <RequestDeleteSheet
        target={requestTarget}
        onClose={() => setRequestTarget(null)}
        onSubmitted={() => {
          setRequestTarget(null);
          Alert.alert("Sent for review", "The office admin has been notified.");
        }}
      />

      <BoardFilterSheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        sort={sort}
        onSort={setSort}
        color={filterColor}
        onColor={setFilterColor}
        withCardsOnly={withCardsOnly}
        onWithCardsOnly={setWithCardsOnly}
      />
    </View>
  );
}

/* ─── Top bar ─── */

function TopBar({ count }: { count: number }) {
  const router = useRouter();
  return (
    <View className="border-b border-app-edge bg-app-canvas px-5 py-3.5 flex-row items-center gap-3">
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
          The Boards
        </Text>
        <View className="flex-row items-baseline gap-2 mt-0.5">
          <Text
            className="text-[18px] font-semibold tracking-tight text-app-ink leading-none"
            style={{ fontFamily: "Crimson-SemiBold" }}
          >
            Work Flow
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
      {/* No "New" button here. The list's own "Create new board" row sits
          at the top of the boards themselves and does the same thing —
          two entry points for one action, one of them crowding the
          header. */}
    </View>
  );
}

/* ─── Tiles ─── */

function BoardTile({
  board,
  onOpen,
  onSettings,
}: {
  board: PartnerBoard;
  onOpen: () => void;
  onSettings: () => void;
}) {
  const styles =
    BOARD_COLOR_STYLES[board.color] ?? BOARD_COLOR_STYLES.copper;
  const subtitle =
    board.description ||
    (board.cardCount > 0
      ? `${board.cardCount} ${board.cardCount === 1 ? "card" : "cards"}`
      : "");

  return (
    <Pressable
      onPress={onOpen}
      className="flex-row items-center gap-3 rounded-xl bg-app-paper px-3 py-2.5 active:opacity-85"
      style={{
        shadowColor: "#0a1124",
        shadowOpacity: 0.05,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 1 },
        elevation: 1,
      }}
    >
      {/* Colour swatch with the board's initial — the Trello-style row mark */}
      <LinearGradient
        colors={styles.gradient as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          width: 42,
          height: 42,
          borderRadius: 10,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            fontFamily: "Crimson-SemiBold",
            fontSize: 17,
            color: styles.text,
          }}
        >
          {board.title.trim().charAt(0).toUpperCase() || "•"}
        </Text>
      </LinearGradient>

      <View className="flex-1 min-w-0">
        <Text
          className="text-[15px] font-semibold tracking-tight text-app-ink"
          style={{ fontFamily: "Crimson-SemiBold" }}
          numberOfLines={1}
        >
          {board.title}
        </Text>
        {subtitle ? (
          <Text
            className="mt-0.5 text-[11px] text-app-fg-muted"
            style={{ fontFamily: "Manrope" }}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      {board.cardCount > 0 ? (
        <View
          className="rounded-md px-2 py-1"
          style={{ backgroundColor: "#efe5d0" }}
        >
          <Text
            className="text-[10px] uppercase tabular-nums"
            style={{
              fontFamily: "DMMono-Medium",
              letterSpacing: 1,
              color: "#8a5821",
            }}
          >
            {board.cardCount}
          </Text>
        </View>
      ) : null}

      <Pressable
        onPress={onSettings}
        hitSlop={8}
        className="h-8 w-8 items-center justify-center rounded-md active:opacity-60"
        style={{ backgroundColor: "#efe5d0" }}
        accessibilityRole="button"
        accessibilityLabel={`Settings for ${board.title}`}
      >
        <Feather name="more-horizontal" size={14} color="#8a5821" />
      </Pressable>
      <Feather name="chevron-right" size={16} color="#c9bfa6" />
    </Pressable>
  );
}

function TileGap() {
  return <View style={{ height: 10 }} />;
}

function CreateTile({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-xl px-3 py-2.5 active:opacity-60"
      style={{
        backgroundColor: "#ffffff",
        borderWidth: 1.5,
        borderStyle: "dashed",
        borderColor: "#e3d9c0",
      }}
    >
      <View
        className="h-10 w-10 items-center justify-center rounded-[10px]"
        style={{ backgroundColor: "#efe5d0" }}
      >
        <Feather name="plus" size={18} color="#8a5821" />
      </View>
      <View className="flex-1">
        <Text
          className="text-[14px] font-semibold tracking-tight text-app-ink"
          style={{ fontFamily: "Crimson-SemiBold" }}
        >
          Create new board
        </Text>
        <Text
          className="mt-0.5 text-[11px] text-app-fg-muted"
          style={{ fontFamily: "Manrope" }}
        >
          Pick a colour, give it a name
        </Text>
      </View>
    </Pressable>
  );
}

/* ─── Create modal ─── */

function CreateBoardModal({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: (b: PartnerBoard) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState<BoardColor>("forest");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setTitle("");
    setDescription("");
    setColor("forest");
    setError(null);
  }

  async function save() {
    setError(null);
    if (!title.trim()) {
      setError("Board title is required.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await partnerCreateBoard({ title, description, color });
      onCreated(res.board);
      reset();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        className="flex-1"
        style={{ backgroundColor: "rgba(10,17,36,0.55)" }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1, justifyContent: "flex-end" }}
        >
          <View
            className="rounded-t-3xl bg-app-paper px-5 pt-3 pb-8"
            style={{
              shadowColor: "#0a1124",
              shadowOpacity: 0.2,
              shadowRadius: 20,
              shadowOffset: { width: 0, height: -6 },
              elevation: 12,
            }}
            // absorb taps so backdrop press doesn't dismiss while interacting
            onStartShouldSetResponder={() => true}
          >
            <View
              className="self-center mb-3 h-1.5 w-12 rounded-full"
              style={{ backgroundColor: "#e3d9c0" }}
            />
            <Text
              className="text-[10px] uppercase text-app-copper-deep mb-2"
              style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.8 }}
            >
              New board
            </Text>
            <Text
              className="text-[22px] font-semibold tracking-tight text-app-ink mb-4"
              style={{ fontFamily: "Crimson-SemiBold" }}
            >
              Pick a colour, give it a name
            </Text>

            {/* Colour swatches */}
            <View className="flex-row flex-wrap gap-2 mb-4">
              {BOARD_COLORS.map((c) => {
                const styles = BOARD_COLOR_STYLES[c];
                const active = color === c;
                return (
                  <Pressable
                    key={c}
                    onPress={() => setColor(c)}
                    className="active:opacity-80"
                    style={{
                      transform: [{ scale: active ? 1.05 : 1 }],
                    }}
                  >
                    <LinearGradient
                      colors={styles.gradient as [string, string]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{
                        height: 44,
                        width: 56,
                        borderRadius: 8,
                        borderWidth: active ? 2 : 0,
                        borderColor: active ? "#c5853a" : "transparent",
                      }}
                    />
                  </Pressable>
                );
              })}
            </View>

            <Field label="Title" value={title} onChangeText={setTitle} />
            <View style={{ height: 12 }} />
            <Field
              label="Description"
              value={description}
              onChangeText={setDescription}
              placeholder="What kind of work goes here?"
            />

            {error ? (
              <Text
                className="mt-3 text-[12px]"
                style={{ fontFamily: "Manrope", color: "#c14a37" }}
              >
                {error}
              </Text>
            ) : null}

            <View className="mt-5 flex-row gap-3">
              <Pressable
                onPress={() => {
                  reset();
                  onClose();
                }}
                disabled={submitting}
                className="flex-1 rounded-md py-3 items-center active:opacity-50"
                style={{
                  backgroundColor: "#ffffff",
                  borderWidth: 1,
                  borderColor: "#e3d9c0",
                }}
              >
                <Text
                  className="text-[13px] font-medium"
                  style={{
                    fontFamily: "Manrope-Medium",
                    color: "#4d4538",
                  }}
                >
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={save}
                disabled={submitting}
                className="flex-[1.4] rounded-md py-3 items-center justify-center flex-row gap-2"
                style={{
                  backgroundColor: "#c5853a",
                  opacity: submitting ? 0.6 : 1,
                  shadowColor: "#c5853a",
                  shadowOpacity: 0.3,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 4 },
                  elevation: 5,
                }}
              >
                {submitting ? (
                  <ActivityIndicator color="#2a1c08" size="small" />
                ) : (
                  <Text
                    className="text-[13px] font-semibold"
                    style={{
                      fontFamily: "Manrope-SemiBold",
                      color: "#2a1c08",
                    }}
                  >
                    Create
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <View>
      <Text
        className="text-[10px] font-semibold uppercase text-app-fg-muted"
        style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.6 }}
      >
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#a89c80"
        autoCorrect={false}
        autoCapitalize="sentences"
        className="mt-1.5 rounded-md border bg-app-paper px-3.5 py-3 text-[15px] text-app-ink"
        style={{
          fontFamily: "Manrope",
          borderColor: "#e3d9c0",
        }}
      />
    </View>
  );
}

/* ─── Filter / sort sheet ─── */

function BoardFilterSheet({
  visible,
  onClose,
  sort,
  onSort,
  color,
  onColor,
  withCardsOnly,
  onWithCardsOnly,
}: {
  visible: boolean;
  onClose: () => void;
  sort: "recent" | "az";
  onSort: (s: "recent" | "az") => void;
  color: BoardColor | null;
  onColor: (c: BoardColor | null) => void;
  withCardsOnly: boolean;
  onWithCardsOnly: (v: boolean) => void;
}) {
  const active =
    (color ? 1 : 0) + (withCardsOnly ? 1 : 0) + (sort === "az" ? 1 : 0);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        onPress={onClose}
        className="flex-1"
        style={{
          backgroundColor: "rgba(10,17,36,0.55)",
          justifyContent: "flex-end",
        }}
      >
        <View
          className="rounded-t-3xl bg-app-paper px-5 pt-3 pb-8"
          style={{
            shadowColor: "#0a1124",
            shadowOpacity: 0.2,
            shadowRadius: 20,
            shadowOffset: { width: 0, height: -6 },
            elevation: 12,
          }}
          onStartShouldSetResponder={() => true}
        >
          <View
            className="self-center mb-3 h-1.5 w-12 rounded-full"
            style={{ backgroundColor: "#e3d9c0" }}
          />
          <View className="flex-row items-center justify-between mb-1">
            <Text
              className="text-[10px] uppercase text-app-copper-deep"
              style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.8 }}
            >
              Filter & sort
            </Text>
            {active > 0 ? (
              <Pressable
                onPress={() => {
                  onColor(null);
                  onWithCardsOnly(false);
                  onSort("recent");
                }}
                hitSlop={8}
              >
                <Text
                  className="text-[11px] uppercase"
                  style={{
                    fontFamily: "DMMono-Medium",
                    letterSpacing: 1.2,
                    color: "#c5853a",
                  }}
                >
                  Reset
                </Text>
              </Pressable>
            ) : null}
          </View>

          {/* Sort */}
          <Text
            className="text-[10px] uppercase text-app-fg-muted mt-3 mb-2"
            style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.6 }}
          >
            Sort
          </Text>
          <View className="flex-row" style={{ gap: 8 }}>
            {(
              [
                ["recent", "Recent"],
                ["az", "A–Z"],
              ] as const
            ).map(([key, lbl]) => {
              const on = sort === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => onSort(key)}
                  className="rounded-full px-3.5 py-2 active:opacity-70"
                  style={{
                    backgroundColor: on ? "#0a1124" : "#ffffff",
                    borderWidth: 1,
                    borderColor: on ? "#0a1124" : "#e3d9c0",
                  }}
                >
                  <Text
                    className="text-[12px]"
                    style={{
                      fontFamily: on ? "Manrope-SemiBold" : "Manrope",
                      color: on ? "#f5ebd6" : "#0a1124",
                    }}
                  >
                    {lbl}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Colour */}
          <Text
            className="text-[10px] uppercase text-app-fg-muted mt-5 mb-2"
            style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.6 }}
          >
            Colour
          </Text>
          <View
            className="flex-row flex-wrap items-center"
            style={{ gap: 10 }}
          >
            <Pressable
              onPress={() => onColor(null)}
              className="rounded-full px-3 py-2 active:opacity-70"
              style={{
                backgroundColor: color === null ? "#0a1124" : "#ffffff",
                borderWidth: 1,
                borderColor: color === null ? "#0a1124" : "#e3d9c0",
              }}
            >
              <Text
                className="text-[12px]"
                style={{
                  fontFamily:
                    color === null ? "Manrope-SemiBold" : "Manrope",
                  color: color === null ? "#f5ebd6" : "#0a1124",
                }}
              >
                All
              </Text>
            </Pressable>
            {BOARD_COLORS.map((c) => {
              const styles = BOARD_COLOR_STYLES[c];
              const on = color === c;
              return (
                <Pressable
                  key={c}
                  onPress={() => onColor(on ? null : c)}
                  className="active:opacity-80"
                  accessibilityRole="button"
                  accessibilityLabel={`Filter by ${c}`}
                >
                  <LinearGradient
                    colors={styles.gradient as [string, string]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      height: 34,
                      width: 34,
                      borderRadius: 9,
                      borderWidth: on ? 2.5 : 0,
                      borderColor: on ? "#c5853a" : "transparent",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {on ? (
                      <Feather name="check" size={15} color={styles.text} />
                    ) : null}
                  </LinearGradient>
                </Pressable>
              );
            })}
          </View>

          {/* With cards only */}
          <Pressable
            onPress={() => onWithCardsOnly(!withCardsOnly)}
            className="mt-5 flex-row items-center gap-2.5 active:opacity-70"
            accessibilityRole="checkbox"
            accessibilityState={{ checked: withCardsOnly }}
          >
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                borderWidth: 1.5,
                borderColor: withCardsOnly ? "#c5853a" : "#c9bfa6",
                backgroundColor: withCardsOnly ? "#c5853a" : "transparent",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {withCardsOnly ? (
                <Feather name="check" size={14} color="#2a1c08" />
              ) : null}
            </View>
            <Text
              className="text-[14px] text-app-ink"
              style={{ fontFamily: "Manrope-Medium" }}
            >
              Only boards with cards
            </Text>
          </Pressable>

          <Pressable
            onPress={onClose}
            className="mt-6 rounded-xl items-center justify-center active:opacity-90"
            style={{ backgroundColor: "#0a1124", paddingVertical: 14 }}
            accessibilityRole="button"
            accessibilityLabel="Done"
          >
            <Text
              className="text-[13.5px]"
              style={{ fontFamily: "Manrope-SemiBold", color: "#f5ebd6" }}
            >
              Done
            </Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}
