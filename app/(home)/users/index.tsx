import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useFocusEffect, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import {
  partnerListUsers,
  type PartnerStaffUser,
} from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";
import { rolePill } from "../../../components/RoleHelpers";

export default function UsersList() {
  const router = useRouter();
  const { isPartnerAdmin: isAdmin } = useAuth();
  const [users, setUsers] = useState<PartnerStaffUser[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    try {
      const list = await partnerListUsers();
      setUsers(
        list.users.map((u) => ({ ...u, isYou: u.id === list.currentUserId }))
      );
      setCurrentUserId(list.currentUserId);
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
    if (!q) return users;
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.designation || "").toLowerCase().includes(q) ||
        (u.role || "").toLowerCase().includes(q)
    );
  }, [users, query]);

  return (
    <View className="flex-1 bg-app-canvas">
      <StatusBar style="dark" backgroundColor="#f4ede0" />
      <SafeAreaView className="flex-1" edges={["top"]}>
        <TopBar count={users.length} isAdmin={isAdmin} />

        {/* Search */}
        {users.length > 4 ? (
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
                placeholder="Search by name, email, role..."
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
        ) : null}

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#c5853a" size="large" />
          </View>
        ) : (
          // FlashList recycles rows — banners ride as the header and the
          // entrance animation stays on the container.
          <Animated.View
            entering={FadeInDown.duration(380)}
            className="flex-1"
          >
            <FlashList
              data={filtered}
              keyExtractor={(u) => u.id}
              renderItem={({ item }) => <UserCard u={item} />}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              contentContainerStyle={{
                paddingHorizontal: 20,
                paddingTop: 12,
                paddingBottom: 48,
              }}
              ItemSeparatorComponent={RowGap}
              ListHeaderComponent={
                <View>
                  {!isAdmin ? (
                    <View
                      className="rounded-xl px-4 py-3.5 mb-4 flex-row items-start gap-3"
                      style={{
                        backgroundColor: "rgba(86,160,168,0.10)",
                        borderWidth: 1,
                        borderColor: "rgba(86,160,168,0.30)",
                      }}
                    >
                      <Feather name="info" size={16} color="#56a0a8" />
                      <Text
                        className="flex-1 text-[12px] leading-[1.5]"
                        style={{ fontFamily: "Manrope", color: "#0a1124" }}
                      >
                        Only the office admin can add or remove users. You can
                        view the team here.
                      </Text>
                    </View>
                  ) : null}

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
                </View>
              }
              ListEmptyComponent={
                <Empty
                  hasUsers={users.length > 0}
                  isAdmin={isAdmin}
                  onAdd={() => router.push("/(home)/users/new")}
                />
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

/* ─── Top bar ─── */

function TopBar({ count, isAdmin }: { count: number; isAdmin: boolean }) {
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
          The Chambers
        </Text>
        <View className="flex-row items-baseline gap-2 mt-0.5">
          <Text
            className="text-[18px] font-semibold tracking-tight text-app-ink leading-none"
            style={{ fontFamily: "Crimson-SemiBold" }}
          >
            Users / Advocates
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
      {isAdmin ? (
        <Pressable
          onPress={() => router.push("/(home)/users/new")}
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
      ) : null}
    </View>
  );
}

/* ─── User card ─── */

function UserCard({ u }: { u: PartnerStaffUser }) {
  const router = useRouter();
  const isPartnerAdmin = u.userType === "partner_admin";
  const initials =
    `${u.firstName?.[0] ?? ""}${u.lastName?.[0] ?? ""}`.toUpperCase();
  const pill = rolePill(u.role);

  return (
    <Pressable
      onPress={() => router.push(`/(home)/users/${u.id}` as never)}
      className="rounded-2xl bg-app-paper p-4 flex-row items-start gap-3 active:opacity-90"
      style={{
        shadowColor: "#0a1124",
        shadowOpacity: 0.05,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 1 },
        elevation: 1,
        opacity: u.active ? 1 : 0.65,
      }}
    >
      <View
        className="h-12 w-12 items-center justify-center rounded-full"
        style={{
          backgroundColor: isPartnerAdmin ? "#c5853a" : "#0a1124",
        }}
      >
        {initials ? (
          <Text
            className="text-[15px] font-semibold"
            style={{
              fontFamily: "Crimson-SemiBold",
              color: isPartnerAdmin ? "#2a1c08" : "#f5ebd6",
            }}
          >
            {initials}
          </Text>
        ) : (
          <Feather
            name="user"
            size={18}
            color={isPartnerAdmin ? "#2a1c08" : "#f5ebd6"}
          />
        )}
      </View>

      <View className="flex-1 min-w-0">
        <View className="flex-row items-baseline gap-2 flex-wrap">
          <Text
            className="text-[16px] font-semibold tracking-tight text-app-ink"
            style={{ fontFamily: "Crimson-SemiBold" }}
            numberOfLines={1}
          >
            {u.name || "—"}
          </Text>
          {u.isYou ? (
            <View
              className="rounded px-1.5 py-0.5"
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
                You
              </Text>
            </View>
          ) : null}
        </View>

        <View className="mt-1 flex-row items-center gap-2 flex-wrap">
          <View
            className="rounded-md px-1.5 py-0.5"
            style={{ backgroundColor: pill.bg }}
          >
            <Text
              className="text-[9px] font-semibold uppercase"
              style={{
                fontFamily: "DMMono-Medium",
                letterSpacing: 1.2,
                color: pill.fg,
              }}
            >
              {pill.label}
            </Text>
          </View>
          {!u.active ? (
            <View
              className="rounded-md px-1.5 py-0.5"
              style={{ backgroundColor: "#f6dccd" }}
            >
              <Text
                className="text-[9px] font-semibold uppercase"
                style={{
                  fontFamily: "DMMono-Medium",
                  letterSpacing: 1.2,
                  color: "#c14a37",
                }}
              >
                Inactive
              </Text>
            </View>
          ) : null}
        </View>

        <Text
          className="mt-1.5 text-[11px] text-app-fg-muted"
          style={{ fontFamily: "DMMono", letterSpacing: 0.3 }}
          numberOfLines={1}
        >
          {u.email}
        </Text>
        {u.designation ? (
          <Text
            className="mt-0.5 text-[11px]"
            style={{ fontFamily: "Manrope", color: "#7a7060" }}
            numberOfLines={1}
          >
            {u.designation}
          </Text>
        ) : null}
      </View>

      <Feather name="chevron-right" size={14} color="#8a5821" />
    </Pressable>
  );
}

/* ─── Empty ─── */

function RowGap() {
  return <View style={{ height: 12 }} />;
}

function Empty({
  hasUsers,
  isAdmin,
  onAdd,
}: {
  hasUsers: boolean;
  isAdmin: boolean;
  onAdd: () => void;
}) {
  if (hasUsers) {
    // No-matches state
    return (
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
          No matches.
        </Text>
      </View>
    );
  }
  return (
    <View className="items-center pt-10">
      <View
        className="h-14 w-14 items-center justify-center rounded-full"
        style={{ backgroundColor: "#efe5d0" }}
      >
        <Feather name="user-plus" size={22} color="#8a5821" />
      </View>
      <Text
        className="mt-5 text-[24px] font-semibold tracking-tight text-app-ink text-center"
        style={{ fontFamily: "Crimson-SemiBold" }}
      >
        Just you so far.
      </Text>
      <Text
        className="mt-2 text-[13px] text-app-fg-muted text-center max-w-[300px]"
        style={{ fontFamily: "Manrope" }}
      >
        Add juniors, clerks and partner advocates with role-based access.
      </Text>
      {isAdmin ? (
        <Pressable
          onPress={onAdd}
          className="mt-6 rounded-md flex-row items-center gap-2 px-6 py-3 active:opacity-90"
          style={{
            backgroundColor: "#c5853a",
            shadowColor: "#c5853a",
            shadowOpacity: 0.3,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
            elevation: 4,
          }}
        >
          <Feather name="plus" size={14} color="#2a1c08" />
          <Text
            className="text-[13px] font-semibold"
            style={{ fontFamily: "Manrope-SemiBold", color: "#2a1c08" }}
          >
            Add the first member
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
