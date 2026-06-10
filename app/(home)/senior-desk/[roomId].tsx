import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import Sheet from "../../../components/Sheet";
import { useChatRoom } from "../../../lib/useChatRoom";
import { useChatUnread } from "../../../lib/chat-unread";
import { useAuth } from "../../../lib/auth-context";
import { CHAT_MAX_BODY, type ChatMessageDTO } from "../../../lib/api";
import { rolePill } from "../../../components/RoleHelpers";

// One conversation. Non-inverted FlashList anchored to the bottom (the
// supported v2 chat pattern) with a normal flex composer below it.
// Keyboard: iOS uses KAV padding + the header offset; Android's
// adjustResize does the work by itself. Messages render as ledger
// entries — sender rule + mono timestamp — not round chat blobs.

const HEADER_H = 56;

export default function ChatThread() {
  const { roomId, title, type } = useLocalSearchParams<{
    roomId: string;
    title?: string;
    type?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isPartnerAdmin } = useAuth();
  const { refresh: refreshUnread } = useChatUnread();
  const room = useChatRoom(String(roomId));

  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<ChatMessageDTO | null>(null);
  const [actionTarget, setActionTarget] = useState<ChatMessageDTO | null>(
    null
  );
  const focusedRef = useRef(false);
  const lastMarkedRef = useRef<string | null>(null);

  // Mark read while the thread is open: on focus, and whenever new
  // messages land (mirrors the web's mark-on-arrival). The unread
  // singleton refreshes on blur so badges catch up immediately.
  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;
      room.markRead();
      return () => {
        focusedRef.current = false;
        refreshUnread();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [room.markRead, refreshUnread])
  );

  const newest = room.messages[room.messages.length - 1]?.id ?? null;
  useEffect(() => {
    if (!focusedRef.current || !newest || newest.startsWith("tmp-")) return;
    if (lastMarkedRef.current === newest) return;
    lastMarkedRef.current = newest;
    room.markRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newest]);

  async function onSend() {
    const text = draft;
    if (!text.trim()) return;
    if (editing) {
      const ok = await room.editMessage(editing.id, text);
      if (ok) {
        setEditing(null);
        setDraft("");
      }
      return;
    }
    setDraft("");
    const ok = await room.send(text);
    if (ok) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      // Restage so the user can retry without retyping.
      setDraft(text);
    }
  }

  function openActions(m: ChatMessageDTO) {
    if (m.isDeleted || m.type === "system") return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActionTarget(m);
  }

  const canModerate = (m: ChatMessageDTO) => m.isMine || isPartnerAdmin;

  return (
    <View className="flex-1 bg-app-canvas">
      <StatusBar style="dark" backgroundColor="#f4ede0" />
      <SafeAreaView className="flex-1" edges={["top"]}>
        {/* Header */}
        <View
          className="border-b border-app-edge bg-app-canvas px-4 flex-row items-center"
          style={{ height: HEADER_H, gap: 10 }}
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
          <View
            className="h-9 w-9 items-center justify-center rounded-full"
            style={{
              backgroundColor:
                type === "group" ? "rgba(197,133,58,0.16)" : "#d2e6e7",
            }}
          >
            <Feather
              name={type === "group" ? "users" : "user"}
              size={15}
              color={type === "group" ? "#8a5821" : "#56a0a8"}
            />
          </View>
          <View className="flex-1 min-w-0">
            <Text
              className="text-[9px] uppercase text-app-copper-deep"
              style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.6 }}
            >
              {type === "group" ? "Office Room" : "Private"}
            </Text>
            <Text
              className="text-[15px] tracking-tight text-app-ink"
              style={{ fontFamily: "Crimson-SemiBold" }}
              numberOfLines={1}
            >
              {title || "Chat"}
            </Text>
          </View>
        </View>

        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={
            Platform.OS === "ios" ? insets.top + HEADER_H : 0
          }
        >
          {room.loading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator color="#c5853a" size="large" />
            </View>
          ) : (
            <FlashList
              data={room.messages}
              keyExtractor={(m) => m.id}
              renderItem={({ item, index }) => (
                <MessageRow
                  m={item}
                  prev={room.messages[index - 1]}
                  onLongPress={() => openActions(item)}
                />
              )}
              maintainVisibleContentPosition={{
                startRenderingFromBottom: true,
                autoscrollToBottomThreshold: 0.2,
              }}
              onStartReached={room.hasMore ? room.loadOlder : undefined}
              onStartReachedThreshold={0.3}
              keyboardDismissMode="interactive"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                paddingHorizontal: 14,
                paddingTop: 10,
                paddingBottom: 6,
              }}
              ListHeaderComponent={
                room.loadingOlder ? (
                  <View className="items-center py-3">
                    <ActivityIndicator color="#c5853a" size="small" />
                  </View>
                ) : null
              }
              ListEmptyComponent={
                <View className="items-center pt-16 px-8">
                  <Feather name="feather" size={20} color="#a89c80" />
                  <Text
                    className="mt-3 text-[13px] text-app-fg-muted text-center"
                    style={{ fontFamily: "Manrope" }}
                  >
                    {type === "group"
                      ? "The office room is quiet. Open the proceedings."
                      : "No messages yet. Say hello."}
                  </Text>
                </View>
              }
            />
          )}

          {/* Error strip */}
          {room.error ? (
            <View
              className="mx-4 mb-1.5 rounded-md px-3 py-2"
              style={{ backgroundColor: "#f6dccd" }}
            >
              <Text
                className="text-[12px]"
                style={{ fontFamily: "Manrope", color: "#c14a37" }}
              >
                {room.error}
              </Text>
            </View>
          ) : null}

          {/* Editing banner */}
          {editing ? (
            <View
              className="mx-4 mb-1.5 rounded-md px-3 py-2 flex-row items-center gap-2"
              style={{ backgroundColor: "#efe5d0" }}
            >
              <Feather name="edit-2" size={12} color="#8a5821" />
              <Text
                className="flex-1 text-[12px]"
                style={{ fontFamily: "Manrope", color: "#4d4538" }}
                numberOfLines={1}
              >
                Editing: {editing.body}
              </Text>
              <Pressable
                onPress={() => {
                  setEditing(null);
                  setDraft("");
                }}
                hitSlop={8}
                className="active:opacity-50"
                accessibilityLabel="Cancel edit"
              >
                <Feather name="x" size={14} color="#8a5821" />
              </Pressable>
            </View>
          ) : null}

          {/* Composer */}
          <View
            className="flex-row items-end gap-2.5 border-t border-app-edge bg-app-canvas px-4 pt-2.5"
            style={{ paddingBottom: Math.max(insets.bottom, 10) }}
          >
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={editing ? "Edit your message…" : "Write to the desk…"}
              placeholderTextColor="#a89c80"
              multiline
              maxLength={CHAT_MAX_BODY}
              className="flex-1 rounded-2xl bg-app-paper px-4 text-[14.5px] text-app-ink"
              style={{
                fontFamily: "Manrope",
                paddingTop: 10,
                paddingBottom: 10,
                maxHeight: 120,
                borderWidth: 1,
                borderColor: "#e3d9c0",
              }}
              accessibilityLabel="Message"
            />
            <Pressable
              onPress={onSend}
              disabled={room.sending || !draft.trim()}
              className="items-center justify-center rounded-full active:opacity-85"
              style={{
                height: 42,
                width: 42,
                backgroundColor: draft.trim() ? "#c5853a" : "#e3d9c0",
                shadowColor: "#c5853a",
                shadowOpacity: draft.trim() ? 0.3 : 0,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 3 },
                elevation: draft.trim() ? 3 : 0,
              }}
              accessibilityRole="button"
              accessibilityLabel={editing ? "Save edit" : "Send message"}
            >
              {room.sending ? (
                <ActivityIndicator size="small" color="#2a1c08" />
              ) : (
                <Feather
                  name={editing ? "check" : "send"}
                  size={16}
                  color={draft.trim() ? "#2a1c08" : "#a89c80"}
                />
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Message actions */}
      <Sheet
        visible={Boolean(actionTarget)}
        onClose={() => setActionTarget(null)}
        eyebrow="Message"
        title={actionTarget?.senderName ?? ""}
      >
        <View style={{ paddingHorizontal: 20, paddingTop: 10 }}>
          <Text
            className="text-[13px] text-app-fg-soft mb-4"
            style={{ fontFamily: "Manrope" }}
            numberOfLines={3}
          >
            “{actionTarget?.body}”
          </Text>
          <View className="gap-2.5">
            <SheetAction
              icon="copy"
              label="Copy text"
              onPress={async () => {
                if (actionTarget) {
                  await Clipboard.setStringAsync(actionTarget.body);
                }
                setActionTarget(null);
              }}
            />
            {actionTarget?.isMine ? (
              <SheetAction
                icon="edit-2"
                label="Edit"
                onPress={() => {
                  if (actionTarget) {
                    setEditing(actionTarget);
                    setDraft(actionTarget.body);
                  }
                  setActionTarget(null);
                }}
              />
            ) : null}
            {actionTarget && canModerate(actionTarget) ? (
              <SheetAction
                icon="trash-2"
                label="Delete"
                danger
                onPress={() => {
                  const target = actionTarget;
                  setActionTarget(null);
                  if (!target) return;
                  Alert.alert("Delete this message?", undefined, [
                    { text: "Keep it", style: "cancel" },
                    {
                      text: "Delete",
                      style: "destructive",
                      onPress: () => void room.deleteMessage(target.id),
                    },
                  ]);
                }}
              />
            ) : null}
          </View>
          <View style={{ height: 16 }} />
        </View>
      </Sheet>
    </View>
  );
}

function SheetAction({
  icon,
  label,
  onPress,
  danger,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-xl px-4 active:opacity-85"
      style={{
        minHeight: 48,
        backgroundColor: "#ffffff",
        borderWidth: 1,
        borderColor: danger ? "rgba(193,74,55,0.35)" : "#e3d9c0",
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Feather name={icon} size={16} color={danger ? "#c14a37" : "#8a5821"} />
      <Text
        className="text-[14px]"
        style={{
          fontFamily: "Manrope-SemiBold",
          color: danger ? "#c14a37" : "#0a1124",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/* ─── Message row — ledger entry, not a chat blob ─── */

function MessageRow({
  m,
  prev,
  onLongPress,
}: {
  m: ChatMessageDTO;
  prev?: ChatMessageDTO;
  onLongPress: () => void;
}) {
  if (m.type === "system") {
    return (
      <View className="items-center my-2.5">
        <Text
          className="text-[10.5px] text-app-fg-muted text-center"
          style={{ fontFamily: "DMMono", letterSpacing: 0.5 }}
        >
          {m.body}
        </Text>
      </View>
    );
  }

  const mine = m.isMine;
  const pending = m.id.startsWith("tmp-");
  const sameSenderAsPrev =
    prev &&
    prev.type === "text" &&
    prev.senderId === m.senderId &&
    // Collapse the header only within a 5-minute run.
    new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() <
      5 * 60 * 1000;
  const time = new Date(m.createdAt).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  const pill = rolePill(m.senderRole || "junior");

  return (
    <Pressable
      onLongPress={onLongPress}
      delayLongPress={280}
      className="active:opacity-80"
      style={{
        marginTop: sameSenderAsPrev ? 3 : 12,
        alignItems: mine ? "flex-end" : "flex-start",
      }}
    >
      {!sameSenderAsPrev ? (
        <View
          className="flex-row items-baseline gap-2 mb-1"
          style={{ flexDirection: mine ? "row-reverse" : "row" }}
        >
          <Text
            className="text-[12px] text-app-ink"
            style={{ fontFamily: "Crimson-SemiBold" }}
          >
            {mine ? "You" : m.senderName}
          </Text>
          {!mine ? (
            <Text
              className="text-[8.5px] uppercase"
              style={{
                fontFamily: "DMMono-Medium",
                letterSpacing: 1,
                color: pill.fg,
              }}
            >
              {pill.label}
            </Text>
          ) : null}
          <Text
            className="text-[9px] text-app-fg-muted"
            style={{ fontFamily: "DMMono", letterSpacing: 0.3 }}
          >
            {time}
          </Text>
        </View>
      ) : null}

      <View
        className="rounded-xl px-3.5 py-2.5"
        style={{
          maxWidth: "84%",
          backgroundColor: m.isDeleted
            ? "transparent"
            : mine
              ? "#0a1124"
              : "#ffffff",
          borderWidth: m.isDeleted ? 1 : mine ? 0 : 1,
          borderColor: m.isDeleted ? "#e3d9c0" : "#e3d9c0",
          borderStyle: m.isDeleted ? "dashed" : "solid",
          borderLeftWidth: m.isDeleted ? 1 : 3,
          borderLeftColor: m.isDeleted
            ? "#e3d9c0"
            : mine
              ? "#c5853a"
              : "#56a0a8",
          opacity: pending ? 0.65 : 1,
        }}
      >
        {m.isDeleted ? (
          <Text
            className="text-[12px] italic"
            style={{ fontFamily: "Manrope", color: "#a89c80" }}
          >
            message removed
          </Text>
        ) : (
          <Text
            className="text-[14px] leading-[21px]"
            style={{
              fontFamily: "Manrope",
              color: mine ? "#f5ebd6" : "#0a1124",
            }}
          >
            {m.body}
          </Text>
        )}
        {!m.isDeleted && (m.editedAt || pending) ? (
          <Text
            className="mt-1 text-[8.5px] uppercase"
            style={{
              fontFamily: "DMMono",
              letterSpacing: 0.8,
              color: mine ? "#c4baa3" : "#a89c80",
            }}
          >
            {pending ? "sending…" : "edited"}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
