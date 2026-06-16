import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { FlashList, type FlashListRef } from "@shopify/flash-list";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import Sheet from "../../../components/Sheet";
import ConfirmSheet from "../../../components/ConfirmSheet";
import ImageViewerModal from "../../../components/ImageViewerModal";
import { useChatRoom } from "../../../lib/useChatRoom";
import { useChatUnread } from "../../../lib/chat-unread";
import { useAuth } from "../../../lib/auth-context";
import {
  CHAT_MAX_BODY,
  getAuthHeader,
  type ChatMessageDTO,
  type ChatAttachment,
} from "../../../lib/api";
import { getApiBaseUrl } from "../../../lib/config";
import {
  pickDocuments,
  pickImages,
  uploadChatAttachments,
  downloadAuthorized,
  shareFile,
  extOf,
  FileOpError,
} from "../../../lib/files";
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
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [attachSheet, setAttachSheet] = useState(false);
  const [confirmDelId, setConfirmDelId] = useState<string | null>(null);
  const [authHeader, setAuthHeader] = useState<Record<string, string>>({});
  const focusedRef = useRef(false);
  const lastMarkedRef = useRef<string | null>(null);
  const listRef = useRef<FlashListRef<ChatMessageDTO>>(null);
  const base = getApiBaseUrl();

  // The attachment download/view URL is partner-scoped (Bearer required), so
  // image thumbnails need the auth header. Resolve it once per open thread.
  useEffect(() => {
    getAuthHeader().then(setAuthHeader);
  }, []);

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
    if (editing) {
      if (!text.trim()) return;
      const ok = await room.editMessage(editing.id, text);
      if (ok) {
        setEditing(null);
        setDraft("");
      }
      return;
    }
    if (!text.trim() && attachments.length === 0) return;
    const staged = attachments;
    setDraft("");
    setAttachments([]);
    const ok = await room.send(text, staged);
    if (ok) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      // Restage text + attachments so the user can retry without redoing it.
      setDraft(text);
      setAttachments(staged);
    }
  }

  // Paperclip → pick (document / photo / camera) → upload up-front; the
  // returned metadata is held as chips until the message is sent. Chat caps
  // at 6 attachments per message.
  async function pickAndUpload(kind: "document" | "library" | "camera") {
    setAttachSheet(false);
    const remaining = 6 - attachments.length;
    if (remaining <= 0) return;
    try {
      const res =
        kind === "document"
          ? await pickDocuments(attachments.length)
          : await pickImages(
              kind === "camera" ? "camera" : "library",
              attachments.length
            );
      if (!res) return; // cancelled
      if (res.ok.length === 0) {
        if (res.rejected.length > 0) {
          Alert.alert(
            "Couldn't attach",
            "Use PDF, Word or image files under 25 MB."
          );
        }
        return;
      }
      setUploading(true);
      const up = await uploadChatAttachments(res.ok.slice(0, remaining));
      setAttachments((prev) => [...prev, ...up.attachments].slice(0, 6));
      if (up.errors && up.errors.length > 0) {
        Alert.alert("Some files were skipped", up.errors.join("\n"));
      }
    } catch (err) {
      if (err instanceof FileOpError && err.code === "cancelled") return;
      Alert.alert(
        "Couldn't attach",
        err instanceof Error ? err.message : "Try again."
      );
    } finally {
      setUploading(false);
    }
  }

  function openActions(m: ChatMessageDTO) {
    if (m.isDeleted || m.type === "system") return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActionTarget(m);
  }

  const canModerate = (m: ChatMessageDTO) => m.isMine || isPartnerAdmin;
  const canSend = draft.trim().length > 0 || attachments.length > 0;

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
              ref={listRef}
              data={room.messages}
              keyExtractor={(m) => m.id}
              renderItem={({ item, index }) => (
                <MessageRow
                  m={item}
                  prev={room.messages[index - 1]}
                  onLongPress={() => openActions(item)}
                  base={base}
                  authHeader={authHeader}
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
            className="border-t border-app-edge bg-app-canvas"
            style={{ paddingBottom: Math.max(insets.bottom, 10) }}
          >
            {/* Pending attachment chips */}
            {attachments.length > 0 || uploading ? (
              <View className="flex-row flex-wrap items-center gap-2 px-4 pt-2.5">
                {attachments.map((a) => (
                  <View
                    key={a.id}
                    className="flex-row items-center gap-1.5 rounded-md px-2 py-1.5"
                    style={{ backgroundColor: "#efe5d0", maxWidth: 200 }}
                  >
                    <Feather
                      name={isImageAtt(a) ? "image" : "file-text"}
                      size={12}
                      color="#8a5821"
                    />
                    <Text
                      numberOfLines={1}
                      style={{
                        fontFamily: "Manrope",
                        fontSize: 11.5,
                        color: "#4d4538",
                        flexShrink: 1,
                      }}
                    >
                      {a.filename}
                    </Text>
                    <Pressable
                      onPress={() =>
                        setAttachments((p) => p.filter((x) => x.id !== a.id))
                      }
                      hitSlop={6}
                      className="active:opacity-50"
                    >
                      <Feather name="x" size={13} color="#8a5821" />
                    </Pressable>
                  </View>
                ))}
                {uploading ? (
                  <ActivityIndicator size="small" color="#c5853a" />
                ) : null}
              </View>
            ) : null}

            <View className="flex-row items-end gap-2 px-4 pt-2.5">
              <Pressable
                onPress={() => setAttachSheet(true)}
                disabled={uploading || attachments.length >= 6}
                className="items-center justify-center rounded-full active:opacity-60"
                style={{
                  height: 42,
                  width: 42,
                  backgroundColor: "#efe5d0",
                  opacity: attachments.length >= 6 ? 0.5 : 1,
                }}
                accessibilityRole="button"
                accessibilityLabel="Attach a file"
              >
                <Feather name="paperclip" size={18} color="#8a5821" />
              </Pressable>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                onFocus={() =>
                  setTimeout(
                    () => listRef.current?.scrollToEnd({ animated: true }),
                    150
                  )
                }
                placeholder={
                  editing ? "Edit your message…" : "Write to the desk…"
                }
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
                disabled={room.sending || uploading || !canSend}
                className="items-center justify-center rounded-full active:opacity-85"
                style={{
                  height: 42,
                  width: 42,
                  backgroundColor: canSend ? "#c5853a" : "#e3d9c0",
                  shadowColor: "#c5853a",
                  shadowOpacity: canSend ? 0.3 : 0,
                  shadowRadius: 8,
                  shadowOffset: { width: 0, height: 3 },
                  elevation: canSend ? 3 : 0,
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
                    color={canSend ? "#2a1c08" : "#a89c80"}
                  />
                )}
              </Pressable>
            </View>
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
                label="Delete for everyone"
                danger
                onPress={() => {
                  const target = actionTarget;
                  setActionTarget(null);
                  if (target) setConfirmDelId(target.id);
                }}
              />
            ) : null}
            {actionTarget ? (
              <SheetAction
                icon="eye-off"
                label="Delete for me"
                danger
                onPress={() => {
                  const target = actionTarget;
                  setActionTarget(null);
                  if (target) void room.deleteMessage(target.id, "me");
                }}
              />
            ) : null}
          </View>
          <View style={{ height: 16 }} />
        </View>
      </Sheet>

      <ConfirmSheet
        visible={confirmDelId !== null}
        onClose={() => setConfirmDelId(null)}
        onConfirm={() => {
          const id = confirmDelId;
          setConfirmDelId(null);
          if (id) void room.deleteMessage(id, "everyone");
        }}
        title="Delete for everyone?"
        message="This message will be removed for everyone in the chat. This can't be undone."
        confirmLabel="Delete for everyone"
      />

      {/* Attach source */}
      <Sheet
        visible={attachSheet}
        onClose={() => setAttachSheet(false)}
        eyebrow="Attach"
        title="Add to message"
      >
        <View
          style={{
            paddingHorizontal: 20,
            paddingTop: 6,
            paddingBottom: 20,
            gap: 10,
          }}
        >
          <SheetAction
            icon="file"
            label="Document"
            onPress={() => pickAndUpload("document")}
          />
          <SheetAction
            icon="image"
            label="Photo library"
            onPress={() => pickAndUpload("library")}
          />
          <SheetAction
            icon="camera"
            label="Camera"
            onPress={() => pickAndUpload("camera")}
          />
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
  base,
  authHeader,
}: {
  m: ChatMessageDTO;
  prev?: ChatMessageDTO;
  onLongPress: () => void;
  base: string;
  authHeader: Record<string, string>;
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
        ) : m.body ? (
          <Text
            className="text-[14px] leading-[21px]"
            style={{
              fontFamily: "Manrope",
              color: mine ? "#f5ebd6" : "#0a1124",
            }}
          >
            {m.body}
          </Text>
        ) : null}
        {!m.isDeleted && m.attachments && m.attachments.length > 0 ? (
          <View style={{ marginTop: m.body ? 8 : 0, gap: 6 }}>
            {m.attachments.map((a) => (
              <AttachmentView
                key={a.id}
                att={a}
                mine={mine}
                base={base}
                authHeader={authHeader}
              />
            ))}
          </View>
        ) : null}
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

function isImageAtt(a: ChatAttachment): boolean {
  if (a.contentType?.startsWith("image/")) return true;
  return ["jpg", "jpeg", "png", "gif", "webp", "bmp", "heic", "heif"].includes(
    extOf(a.filename)
  );
}

function formatBytes(n: number): string {
  if (!n || n < 1024) return `${n || 0} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentView({
  att,
  mine,
  base,
  authHeader,
}: {
  att: ChatAttachment;
  mine: boolean;
  base: string;
  authHeader: Record<string, string>;
}) {
  const [busy, setBusy] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const url = `${base}/api/app/chat/attachments/${att.id}`;
  const image = isImageAtt(att);

  async function open() {
    setBusy(true);
    try {
      const dl = await downloadAuthorized(
        `/api/app/chat/attachments/${att.id}`,
        { fallbackName: att.filename, mime: att.contentType }
      );
      await shareFile(dl.uri, dl.mime, att.filename);
    } catch (err) {
      if (
        err instanceof FileOpError &&
        (err.code === "cancelled" || err.code === "no_app")
      ) {
        return;
      }
      Alert.alert(
        "Couldn't open",
        err instanceof Error ? err.message : "Try again."
      );
    } finally {
      setBusy(false);
    }
  }

  if (image) {
    return (
      <>
        <Pressable
          onPress={() => setViewerOpen(true)}
          className="overflow-hidden rounded-lg active:opacity-85"
        >
          <Image
            source={{ uri: url, headers: authHeader }}
            style={{
              width: 210,
              height: 158,
              borderRadius: 8,
              backgroundColor: "rgba(10,17,36,0.08)",
            }}
            resizeMode="cover"
          />
          {busy ? (
            <View
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(10,17,36,0.25)",
              }}
            >
              <ActivityIndicator color="#f5ebd6" />
            </View>
          ) : null}
        </Pressable>
        <ImageViewerModal
          visible={viewerOpen}
          uri={url}
          headers={authHeader}
          filename={att.filename}
          busy={busy}
          onClose={() => setViewerOpen(false)}
          onShare={open}
        />
      </>
    );
  }

  return (
    <Pressable
      onPress={open}
      className="flex-row items-center gap-2.5 rounded-lg px-3 py-2 active:opacity-85"
      style={{
        backgroundColor: mine ? "rgba(245,235,214,0.12)" : "#efe5d0",
        maxWidth: 244,
      }}
    >
      <Feather name="file-text" size={16} color={mine ? "#f5ebd6" : "#8a5821"} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={1}
          style={{
            fontFamily: "Manrope-SemiBold",
            fontSize: 12.5,
            color: mine ? "#f5ebd6" : "#0a1124",
          }}
        >
          {att.filename}
        </Text>
        <Text
          style={{
            fontFamily: "DMMono",
            fontSize: 10,
            color: mine ? "#c4baa3" : "#7a7060",
          }}
        >
          {formatBytes(att.size)}
        </Text>
      </View>
      {busy ? (
        <ActivityIndicator size="small" color={mine ? "#f5ebd6" : "#8a5821"} />
      ) : (
        <Feather name="download" size={14} color={mine ? "#c4baa3" : "#8a5821"} />
      )}
    </Pressable>
  );
}
