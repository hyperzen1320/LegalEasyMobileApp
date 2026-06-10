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
} from "react-native";
import { FlashList } from "@shopify/flash-list";
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
    if (!q) return boards;
    return boards.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        (b.description || "").toLowerCase().includes(q)
    );
  }, [boards, query]);

  return (
    <View className="flex-1 bg-app-canvas">
      <StatusBar style="dark" backgroundColor="#f4ede0" />
      <SafeAreaView className="flex-1" edges={["top"]}>
        <TopBar count={boards.length} onCreate={() => setCreating(true)} />

        {/* Search */}
        <View className="px-5 pt-3 pb-1 bg-app-canvas">
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
    </View>
  );
}

/* ─── Top bar ─── */

function TopBar({
  count,
  onCreate,
}: {
  count: number;
  onCreate: () => void;
}) {
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
      <Pressable
        onPress={onCreate}
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

/* ─── Tiles ─── */

function BoardTile({
  board,
  onOpen,
}: {
  board: PartnerBoard;
  onOpen: () => void;
}) {
  const styles =
    BOARD_COLOR_STYLES[board.color] ?? BOARD_COLOR_STYLES.copper;

  return (
    <Pressable
      onPress={onOpen}
      className="rounded-2xl overflow-hidden active:opacity-90"
      style={{
        shadowColor: "#0a1124",
        shadowOpacity: 0.07,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 3 },
        elevation: 3,
      }}
    >
      <LinearGradient
        colors={styles.gradient as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          height: 100,
          padding: 16,
          position: "relative",
        }}
      >
        <View
          style={{
            position: "absolute",
            top: 14,
            left: 14,
            height: 8,
            width: 8,
            borderRadius: 4,
            backgroundColor: styles.accent,
            opacity: 0.85,
          }}
        />
        {board.cardCount > 0 ? (
          <View
            style={{
              position: "absolute",
              top: 12,
              right: 12,
              backgroundColor: "rgba(255,255,255,0.18)",
              borderRadius: 6,
              paddingHorizontal: 8,
              paddingVertical: 2,
            }}
          >
            <Text
              style={{
                fontFamily: "DMMono-Medium",
                fontSize: 10,
                letterSpacing: 1.2,
                color: styles.text,
                textTransform: "uppercase",
              }}
            >
              {board.cardCount} cards
            </Text>
          </View>
        ) : null}
      </LinearGradient>
      <View
        className="flex-row items-center justify-between gap-3 px-4 py-3"
        style={{ backgroundColor: "#ffffff" }}
      >
        <View className="flex-1 min-w-0">
          <Text
            className="text-[16px] font-semibold tracking-tight text-app-ink"
            style={{ fontFamily: "Crimson-SemiBold" }}
            numberOfLines={1}
          >
            {board.title}
          </Text>
          {board.description ? (
            <Text
              className="mt-0.5 text-[11px] text-app-fg-muted"
              style={{ fontFamily: "Manrope" }}
              numberOfLines={1}
            >
              {board.description}
            </Text>
          ) : null}
        </View>
        <View
          className="h-7 w-7 items-center justify-center rounded-md"
          style={{ backgroundColor: "#efe5d0" }}
        >
          <Feather name="arrow-right" size={13} color="#8a5821" />
        </View>
      </View>
    </Pressable>
  );
}

function TileGap() {
  return <View style={{ height: 16 }} />;
}

function CreateTile({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="rounded-2xl items-center justify-center py-7 active:opacity-50"
      style={{
        backgroundColor: "#ffffff",
        borderWidth: 1.5,
        borderStyle: "dashed",
        borderColor: "#e3d9c0",
      }}
    >
      <View
        className="h-11 w-11 items-center justify-center rounded-full"
        style={{ backgroundColor: "#efe5d0" }}
      >
        <Feather name="plus" size={20} color="#8a5821" />
      </View>
      <Text
        className="mt-2 text-[14px] font-semibold tracking-tight text-app-ink"
        style={{ fontFamily: "Crimson-SemiBold" }}
      >
        Create new board
      </Text>
      <Text
        className="mt-1 text-[11px] text-app-fg-muted"
        style={{ fontFamily: "Manrope" }}
      >
        Pick a colour, give it a name
      </Text>
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
