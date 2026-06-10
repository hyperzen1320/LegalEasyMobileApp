import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useFocusEffect, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import {
  ApiError,
  partnerChatRooms,
  partnerDeleteReminder,
  partnerListReminders,
  partnerUpdateReminder,
  type ChatRoomDTO,
  type ReminderBucket,
  type ReminderDTO,
} from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";
import { useChatUnread } from "../../../lib/chat-unread";
import NewChatSheet from "../../../components/chat/NewChatSheet";
import NewReminderSheet from "../../../components/seniordesk/NewReminderSheet";

// Senior Desk — the office's coordination corner. Two registers:
//   Chats     · the office group room (pinned) + private threads
//   Reminders · personal + delegated tasks with due dates
// The web shows these as side-by-side panels; on a phone they're
// segments, with the thread itself a pushed screen.

type Segment = "chats" | "reminders";

const ROOMS_POLL_MS = 12_000;

export default function SeniorDesk() {
  const router = useRouter();
  const { isPartnerAdmin } = useAuth();
  const { unread, refresh: refreshUnread } = useChatUnread();
  const [segment, setSegment] = useState<Segment>("chats");

  /* ─── Chats state ─── */
  const [rooms, setRooms] = useState<ChatRoomDTO[] | null>(null);
  const [roomsError, setRoomsError] = useState<string | null>(null);
  const [newChatOpen, setNewChatOpen] = useState(false);

  const loadRooms = useCallback(async () => {
    try {
      const res = await partnerChatRooms();
      setRooms(res.rooms);
      setRoomsError(null);
    } catch (err) {
      setRoomsError(
        err instanceof ApiError ? err.message : "Couldn't load chats."
      );
    }
  }, []);

  // Load on focus + poll on the web sidebar's cadence while focused.
  useFocusEffect(
    useCallback(() => {
      loadRooms();
      const t = setInterval(loadRooms, ROOMS_POLL_MS);
      return () => clearInterval(t);
    }, [loadRooms])
  );

  /* ─── Reminders state ─── */
  const [scope, setScope] = useState<"mine" | "office">("mine");
  const [showDone, setShowDone] = useState(false);
  const [reminders, setReminders] = useState<ReminderDTO[] | null>(null);
  const [dueCount, setDueCount] = useState(0);
  const [remindersError, setRemindersError] = useState<string | null>(null);
  const [newReminderOpen, setNewReminderOpen] = useState(false);
  const [busyReminderId, setBusyReminderId] = useState<string | null>(null);

  const bucket: ReminderBucket = `${scope}_${showDone ? "done" : "active"}`;

  const loadReminders = useCallback(async () => {
    try {
      const res = await partnerListReminders(bucket);
      setReminders(res.reminders);
      setDueCount(res.dueOrOverdueCount);
      setRemindersError(null);
    } catch (err) {
      setRemindersError(
        err instanceof ApiError ? err.message : "Couldn't load reminders."
      );
    }
  }, [bucket]);

  useEffect(() => {
    setReminders(null);
    loadReminders();
  }, [loadReminders]);

  useFocusEffect(
    useCallback(() => {
      loadReminders();
    }, [loadReminders])
  );

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadRooms(), loadReminders()]);
    refreshUnread();
    setRefreshing(false);
  }, [loadRooms, loadReminders, refreshUnread]);

  async function toggleReminder(r: ReminderDTO) {
    setBusyReminderId(r.id);
    try {
      await partnerUpdateReminder(r.id, {
        status: r.status === "done" ? "pending" : "done",
      });
      await loadReminders();
    } catch (err) {
      Alert.alert(
        "Couldn't update",
        err instanceof ApiError ? err.message : "Try again."
      );
    } finally {
      setBusyReminderId(null);
    }
  }

  function confirmDeleteReminder(r: ReminderDTO) {
    Alert.alert("Delete this reminder?", `“${r.title}”`, [
      { text: "Keep it", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setBusyReminderId(r.id);
          try {
            await partnerDeleteReminder(r.id);
            await loadReminders();
          } catch (err) {
            Alert.alert(
              "Couldn't delete",
              err instanceof ApiError ? err.message : "Try again."
            );
          } finally {
            setBusyReminderId(null);
          }
        },
      },
    ]);
  }

  function openRoom(room: ChatRoomDTO) {
    router.push({
      pathname: `/(home)/senior-desk/${room.id}` as never,
      params: { title: room.title, type: room.type },
    } as never);
  }

  return (
    <View className="flex-1 bg-app-canvas">
      <StatusBar style="dark" backgroundColor="#f4ede0" />
      <SafeAreaView className="flex-1" edges={["top"]}>
        {/* Top bar */}
        <View
          className="border-b border-app-edge bg-app-canvas px-4 py-3 flex-row items-center"
          style={{ gap: 10 }}
        >
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            className="active:opacity-50 h-9 w-9 items-center justify-center rounded-md"
            style={{ backgroundColor: "#ffffff" }}
            accessibilityLabel="Back"
          >
            <Feather name="arrow-left" size={17} color="#0a1124" />
          </Pressable>
          <View className="flex-1">
            <Text
              className="text-[10px] uppercase text-app-copper-deep"
              style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.8 }}
            >
              Chambers · Coordination
            </Text>
            <Text
              className="text-[18px] tracking-tight text-app-ink leading-none mt-0.5"
              style={{ fontFamily: "Crimson-SemiBold" }}
            >
              Senior Desk
            </Text>
          </View>
          {segment === "chats" ? (
            <Pressable
              onPress={() => setNewChatOpen(true)}
              hitSlop={6}
              className="rounded-md flex-row items-center gap-1.5 px-3 py-2 active:opacity-90"
              style={{ backgroundColor: "#c5853a" }}
              accessibilityRole="button"
              accessibilityLabel="Start a private chat"
            >
              <Feather name="plus" size={13} color="#2a1c08" />
              <Text
                className="text-[12px]"
                style={{ fontFamily: "Manrope-SemiBold", color: "#2a1c08" }}
              >
                Chat
              </Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => setNewReminderOpen(true)}
              hitSlop={6}
              className="rounded-md flex-row items-center gap-1.5 px-3 py-2 active:opacity-90"
              style={{ backgroundColor: "#c5853a" }}
              accessibilityRole="button"
              accessibilityLabel="New reminder"
            >
              <Feather name="plus" size={13} color="#2a1c08" />
              <Text
                className="text-[12px]"
                style={{ fontFamily: "Manrope-SemiBold", color: "#2a1c08" }}
              >
                Remind
              </Text>
            </Pressable>
          )}
        </View>

        {/* Segments */}
        <View className="px-5 pt-3.5 flex-row gap-2">
          <SegmentChip
            label="Chats"
            active={segment === "chats"}
            badge={unread.totalUnread}
            onPress={() => setSegment("chats")}
          />
          <SegmentChip
            label="Reminders"
            active={segment === "reminders"}
            badge={dueCount}
            onPress={() => setSegment("reminders")}
          />
        </View>

        <ScrollView
          contentContainerClassName="px-5 pt-4 pb-10"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#c5853a"
            />
          }
        >
          {segment === "chats" ? (
            <ChatsPane
              rooms={rooms}
              error={roomsError}
              unreadByRoom={unread.byRoomId}
              onOpen={openRoom}
              onRetry={loadRooms}
            />
          ) : (
            <RemindersPane
              reminders={reminders}
              error={remindersError}
              scope={scope}
              showDone={showDone}
              isPartnerAdmin={isPartnerAdmin}
              busyId={busyReminderId}
              onScope={setScope}
              onShowDone={setShowDone}
              onToggle={toggleReminder}
              onDelete={confirmDeleteReminder}
              onRetry={loadReminders}
            />
          )}
        </ScrollView>
      </SafeAreaView>

      <NewChatSheet
        visible={newChatOpen}
        onClose={() => setNewChatOpen(false)}
        onOpened={(room) => {
          setNewChatOpen(false);
          loadRooms();
          openRoom(room);
        }}
      />

      <NewReminderSheet
        visible={newReminderOpen}
        onClose={() => setNewReminderOpen(false)}
        onCreated={loadReminders}
      />
    </View>
  );
}

function SegmentChip({
  label,
  active,
  badge,
  onPress,
}: {
  label: string;
  active: boolean;
  badge: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 flex-row items-center justify-center gap-2 rounded-lg py-2.5 active:opacity-85"
      style={{
        backgroundColor: active ? "#0a1124" : "#ffffff",
        borderWidth: 1,
        borderColor: active ? "#0a1124" : "#e3d9c0",
      }}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
    >
      <Text
        className="text-[13px]"
        style={{
          fontFamily: "Manrope-SemiBold",
          color: active ? "#f5ebd6" : "#0a1124",
        }}
      >
        {label}
      </Text>
      {badge > 0 ? (
        <View
          className="items-center justify-center rounded-full"
          style={{
            minWidth: 18,
            height: 18,
            paddingHorizontal: 4,
            backgroundColor: active ? "#c5853a" : "#efe5d0",
          }}
        >
          <Text
            style={{
              fontFamily: "DMMono-Medium",
              fontSize: 9,
              color: active ? "#2a1c08" : "#8a5821",
            }}
          >
            {badge > 99 ? "99+" : badge}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/* ─── Chats pane ─── */

function ChatsPane({
  rooms,
  error,
  unreadByRoom,
  onOpen,
  onRetry,
}: {
  rooms: ChatRoomDTO[] | null;
  error: string | null;
  unreadByRoom: Record<string, number>;
  onOpen: (room: ChatRoomDTO) => void;
  onRetry: () => void;
}) {
  if (error) {
    return (
      <Pressable
        onPress={onRetry}
        className="rounded-md px-4 py-3 active:opacity-70"
        style={{ backgroundColor: "#f6dccd" }}
      >
        <Text
          className="text-[13px]"
          style={{ fontFamily: "Manrope", color: "#c14a37" }}
        >
          {error} — tap to retry
        </Text>
      </Pressable>
    );
  }
  if (rooms === null) {
    return (
      <View className="items-center py-10">
        <ActivityIndicator color="#c5853a" size="large" />
      </View>
    );
  }

  const group = rooms.filter((r) => r.type === "group");
  const privates = rooms.filter((r) => r.type === "private");

  return (
    <Animated.View entering={FadeInDown.duration(380)}>
      {group.map((r) => (
        <RoomRow
          key={r.id}
          room={r}
          unread={unreadByRoom[r.id] ?? r.unreadCount}
          onPress={() => onOpen(r)}
        />
      ))}

      <Text
        className="mt-6 mb-2 text-[10px] uppercase text-app-copper-deep"
        style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.8 }}
      >
        Private
      </Text>
      {privates.length === 0 ? (
        <View
          className="rounded-xl items-center py-8 px-5"
          style={{
            borderWidth: 1.5,
            borderColor: "#e3d9c0",
            borderStyle: "dashed",
            backgroundColor: "#faf6ed",
          }}
        >
          <Feather name="message-square" size={18} color="#a89c80" />
          <Text
            className="mt-2 text-[12.5px] text-app-fg-muted text-center"
            style={{ fontFamily: "Manrope" }}
          >
            No private threads yet. Start one with the Chat button above.
          </Text>
        </View>
      ) : (
        <View className="gap-2.5">
          {privates.map((r) => (
            <RoomRow
              key={r.id}
              room={r}
              unread={unreadByRoom[r.id] ?? r.unreadCount}
              onPress={() => onOpen(r)}
            />
          ))}
        </View>
      )}
    </Animated.View>
  );
}

function RoomRow({
  room,
  unread,
  onPress,
}: {
  room: ChatRoomDTO;
  unread: number;
  onPress: () => void;
}) {
  const isGroup = room.type === "group";
  const when = room.lastMessageAt
    ? formatWhen(new Date(room.lastMessageAt))
    : "";
  return (
    <Pressable
      onPress={onPress}
      className="rounded-xl bg-app-paper p-4 flex-row items-center gap-3 active:opacity-85"
      style={{
        shadowColor: "#0a1124",
        shadowOpacity: 0.05,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 1 },
        elevation: 1,
        borderLeftWidth: 3,
        borderLeftColor: isGroup ? "#c5853a" : "#56a0a8",
        marginTop: isGroup ? 0 : 0,
      }}
      accessibilityRole="button"
      accessibilityLabel={`Open chat ${room.title}`}
    >
      <View
        className="h-11 w-11 items-center justify-center rounded-full"
        style={{ backgroundColor: isGroup ? "rgba(197,133,58,0.16)" : "#d2e6e7" }}
      >
        <Feather
          name={isGroup ? "users" : "user"}
          size={16}
          color={isGroup ? "#8a5821" : "#56a0a8"}
        />
      </View>
      <View className="flex-1 min-w-0">
        <View className="flex-row items-baseline gap-2">
          <Text
            className="flex-1 text-[15px] text-app-ink"
            style={{ fontFamily: "Crimson-SemiBold" }}
            numberOfLines={1}
          >
            {isGroup ? `${room.title || "Group Chat"}` : room.title}
          </Text>
          {when ? (
            <Text
              className="text-[9.5px] text-app-fg-muted"
              style={{ fontFamily: "DMMono", letterSpacing: 0.3 }}
            >
              {when}
            </Text>
          ) : null}
        </View>
        <Text
          className="mt-0.5 text-[12px] text-app-fg-muted"
          style={{ fontFamily: "Manrope" }}
          numberOfLines={1}
        >
          {room.lastMessagePreview ||
            (isGroup ? "The whole office, one thread." : "Say hello.")}
        </Text>
      </View>
      {unread > 0 ? (
        <View
          className="items-center justify-center rounded-full"
          style={{
            minWidth: 20,
            height: 20,
            paddingHorizontal: 5,
            backgroundColor: "#c5853a",
          }}
        >
          <Text
            style={{
              fontFamily: "DMMono-Medium",
              fontSize: 10,
              color: "#2a1c08",
            }}
          >
            {unread > 99 ? "99+" : unread}
          </Text>
        </View>
      ) : (
        <Feather name="chevron-right" size={14} color="#8a5821" />
      )}
    </Pressable>
  );
}

/* ─── Reminders pane ─── */

function RemindersPane({
  reminders,
  error,
  scope,
  showDone,
  isPartnerAdmin,
  busyId,
  onScope,
  onShowDone,
  onToggle,
  onDelete,
  onRetry,
}: {
  reminders: ReminderDTO[] | null;
  error: string | null;
  scope: "mine" | "office";
  showDone: boolean;
  isPartnerAdmin: boolean;
  busyId: string | null;
  onScope: (s: "mine" | "office") => void;
  onShowDone: (v: boolean) => void;
  onToggle: (r: ReminderDTO) => void;
  onDelete: (r: ReminderDTO) => void;
  onRetry: () => void;
}) {
  return (
    <Animated.View entering={FadeInDown.duration(380)}>
      {/* Scope + done toggles */}
      <View className="flex-row items-center justify-between mb-4">
        {isPartnerAdmin ? (
          <View className="flex-row gap-2">
            {(["mine", "office"] as const).map((s) => {
              const on = scope === s;
              return (
                <Pressable
                  key={s}
                  onPress={() => onScope(s)}
                  className="rounded-full px-3 active:opacity-80"
                  style={{
                    paddingVertical: 5,
                    backgroundColor: on ? "#0a1124" : "#ffffff",
                    borderWidth: 1,
                    borderColor: on ? "#0a1124" : "#e3d9c0",
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                >
                  <Text
                    className="text-[11.5px]"
                    style={{
                      fontFamily: "Manrope-SemiBold",
                      color: on ? "#f5ebd6" : "#0a1124",
                    }}
                  >
                    {s === "mine" ? "Mine" : "Whole office"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View />
        )}
        <Pressable
          onPress={() => onShowDone(!showDone)}
          hitSlop={6}
          className="flex-row items-center gap-1.5 active:opacity-60"
          accessibilityRole="switch"
          accessibilityState={{ checked: showDone }}
        >
          <Feather
            name={showDone ? "check-square" : "square"}
            size={13}
            color="#8a5821"
          />
          <Text
            className="text-[11px] uppercase"
            style={{
              fontFamily: "DMMono-Medium",
              letterSpacing: 1.2,
              color: "#8a5821",
            }}
          >
            Done
          </Text>
        </Pressable>
      </View>

      {error ? (
        <Pressable
          onPress={onRetry}
          className="rounded-md px-4 py-3 active:opacity-70"
          style={{ backgroundColor: "#f6dccd" }}
        >
          <Text
            className="text-[13px]"
            style={{ fontFamily: "Manrope", color: "#c14a37" }}
          >
            {error} — tap to retry
          </Text>
        </Pressable>
      ) : reminders === null ? (
        <View className="items-center py-10">
          <ActivityIndicator color="#c5853a" size="large" />
        </View>
      ) : reminders.length === 0 ? (
        <View
          className="rounded-xl items-center py-9 px-5"
          style={{
            borderWidth: 1.5,
            borderColor: "#e3d9c0",
            borderStyle: "dashed",
            backgroundColor: "#faf6ed",
          }}
        >
          <Feather name="bell-off" size={18} color="#a89c80" />
          <Text
            className="mt-2 text-[12.5px] text-app-fg-muted text-center"
            style={{ fontFamily: "Manrope" }}
          >
            {showDone
              ? "Nothing completed here yet."
              : "Nothing pending. Set one with the Remind button above."}
          </Text>
        </View>
      ) : (
        <View className="gap-2.5">
          {reminders.map((r) => (
            <ReminderRow
              key={r.id}
              r={r}
              busy={busyId === r.id}
              onToggle={() => onToggle(r)}
              onDelete={() => onDelete(r)}
            />
          ))}
        </View>
      )}
    </Animated.View>
  );
}

const PRIORITY_COLORS: Record<string, string> = {
  high: "#c14a37",
  normal: "#c5853a",
  low: "#56a0a8",
};

function ReminderRow({
  r,
  busy,
  onToggle,
  onDelete,
}: {
  r: ReminderDTO;
  busy: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const done = r.status === "done";
  const due = r.dueDate
    ? new Date(r.dueDate).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
      })
    : null;
  return (
    <View
      className="rounded-xl bg-app-paper p-3.5 flex-row items-start gap-3"
      style={{
        shadowColor: "#0a1124",
        shadowOpacity: 0.05,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 1 },
        elevation: 1,
        borderLeftWidth: 3,
        borderLeftColor: done
          ? "#c4baa3"
          : PRIORITY_COLORS[r.priority] ?? "#c5853a",
        opacity: done ? 0.75 : 1,
      }}
    >
      <Pressable
        onPress={onToggle}
        disabled={busy}
        hitSlop={8}
        className="active:opacity-60 pt-0.5"
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        accessibilityLabel={done ? "Reopen reminder" : "Mark reminder done"}
      >
        {busy ? (
          <ActivityIndicator size="small" color="#8a5821" />
        ) : (
          <Feather
            name={done ? "check-circle" : "circle"}
            size={19}
            color={done ? "#6c9858" : "#8a5821"}
          />
        )}
      </Pressable>
      <View className="flex-1 min-w-0">
        <Text
          className="text-[14px] text-app-ink"
          style={{
            fontFamily: "Manrope-SemiBold",
            textDecorationLine: done ? "line-through" : "none",
          }}
        >
          {r.title}
        </Text>
        {r.description ? (
          <Text
            className="mt-0.5 text-[12px] text-app-fg-soft"
            style={{ fontFamily: "Manrope" }}
            numberOfLines={2}
          >
            {r.description}
          </Text>
        ) : null}
        <View className="mt-1.5 flex-row items-center flex-wrap" style={{ gap: 8 }}>
          {due ? (
            <Text
              className="text-[10px]"
              style={{
                fontFamily: "DMMono-Medium",
                letterSpacing: 0.6,
                color: r.isOverdue
                  ? "#c14a37"
                  : r.isDueToday
                    ? "#8a5821"
                    : "#7a7060",
              }}
            >
              {r.isOverdue ? "OVERDUE · " : r.isDueToday ? "TODAY · " : ""}
              {due}
            </Text>
          ) : null}
          <Text
            className="text-[10px]"
            style={{
              fontFamily: "DMMono",
              letterSpacing: 0.4,
              color: "#a89c80",
            }}
            numberOfLines={1}
          >
            {r.isMine ? "for me" : `for ${r.assignedToName}`}
            {r.createdByName && r.createdByName !== r.assignedToName
              ? ` · by ${r.createdByName}`
              : ""}
          </Text>
        </View>
      </View>
      <Pressable
        onPress={onDelete}
        disabled={busy}
        hitSlop={8}
        className="active:opacity-50 pt-0.5"
        accessibilityRole="button"
        accessibilityLabel="Delete reminder"
      >
        <Feather name="trash-2" size={14} color="#a89c80" />
      </Pressable>
    </View>
  );
}

function formatWhen(d: Date): string {
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}
