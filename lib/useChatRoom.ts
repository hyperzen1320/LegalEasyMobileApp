import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import {
  ApiError,
  CHAT_MAX_BODY,
  partnerChatDeleteMessage,
  partnerChatEditMessage,
  partnerChatMarkRead,
  partnerChatMessages,
  partnerChatSend,
  type ChatMessageDTO,
  type ChatAttachment,
} from "./api";

// useChatRoom — the working hook for one open conversation. A direct
// port of the web's src/lib/use-chat-room.ts with three substitutions:
// fetch → the typed api helpers, document.visibilityState → AppState,
// and no BroadcastChannel (single-window app). Everything else — the
// 2s/8s adaptive cadence, newest-50 + merge-by-id polling, optimistic
// `tmp-` sends, before-cursor history — matches the web so both clients
// feel identical in a live office.

type Cadence = "active" | "background";

const CADENCE_MS: Record<Cadence, number> = {
  active: 2000,
  background: 8000,
};

const PAGE_SIZE = 50;

type State = {
  messages: ChatMessageDTO[];
  hasMore: boolean;
  loading: boolean;
  loadingOlder: boolean;
  sending: boolean;
  error: string | null;
};

export function useChatRoom(roomId: string | null): State & {
  send: (body: string, attachments?: ChatAttachment[]) => Promise<boolean>;
  loadOlder: () => Promise<void>;
  markRead: () => Promise<void>;
  editMessage: (id: string, body: string) => Promise<boolean>;
  deleteMessage: (id: string) => Promise<boolean>;
  refresh: () => Promise<void>;
} {
  const [messages, setMessages] = useState<ChatMessageDTO[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const newestIdRef = useRef<string | null>(null);
  const oldestIdRef = useRef<string | null>(null);
  const activeRef = useRef<boolean>(AppState.currentState === "active");

  // Reset when the room changes.
  useEffect(() => {
    setMessages([]);
    setHasMore(false);
    setError(null);
    newestIdRef.current = null;
    oldestIdRef.current = null;
  }, [roomId]);

  // Initial fetch + poll-newer loop.
  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function initialLoad() {
      if (!roomId) return;
      setLoading(true);
      setError(null);
      try {
        const data = await partnerChatMessages(roomId, { limit: PAGE_SIZE });
        if (cancelled) return;
        setMessages(data.messages);
        setHasMore(data.hasMore);
        if (data.messages.length > 0) {
          newestIdRef.current = data.messages[data.messages.length - 1].id;
          oldestIdRef.current = data.messages[0].id;
        }
      } catch {
        if (!cancelled) setError("Couldn't load this conversation.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    async function pollNewer() {
      if (cancelled || !roomId) return;
      const cadence: Cadence = activeRef.current ? "active" : "background";
      try {
        const since = newestIdRef.current;
        // Fetch the newest 50 (no cursor) and merge in any with id > since
        // — ObjectIds sort lexically, so string compare is correct.
        const data = await partnerChatMessages(roomId, { limit: PAGE_SIZE });
        if (data.messages.length > 0) {
          const newer = since
            ? data.messages.filter((m) => m.id > since)
            : data.messages;
          if (newer.length > 0) {
            setMessages((prev) => mergeAppend(prev, newer));
            newestIdRef.current =
              data.messages[data.messages.length - 1].id;
          }
        }
      } catch {
        // Transient — try again next tick.
      }
      if (cancelled) return;
      timer = setTimeout(pollNewer, CADENCE_MS[cadence]);
    }

    initialLoad().then(() => {
      if (cancelled) return;
      timer = setTimeout(pollNewer, CADENCE_MS.active);
    });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [roomId]);

  // AppState tracking — slow the poll while backgrounded.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      activeRef.current = state === "active";
    });
    return () => sub.remove();
  }, []);

  const refresh = useCallback(async () => {
    if (!roomId) return;
    try {
      const data = await partnerChatMessages(roomId, { limit: PAGE_SIZE });
      setMessages(data.messages);
      setHasMore(data.hasMore);
      if (data.messages.length > 0) {
        newestIdRef.current = data.messages[data.messages.length - 1].id;
        oldestIdRef.current = data.messages[0].id;
      }
    } catch {
      /* swallow — poll recovers */
    }
  }, [roomId]);

  const loadOlder = useCallback(async () => {
    if (!roomId || !oldestIdRef.current || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const data = await partnerChatMessages(roomId, {
        limit: PAGE_SIZE,
        before: oldestIdRef.current,
      });
      if (data.messages.length > 0) {
        setMessages((prev) => mergePrepend(data.messages, prev));
        oldestIdRef.current = data.messages[0].id;
      }
      setHasMore(data.hasMore);
    } catch {
      /* keep the button; user can retry */
    } finally {
      setLoadingOlder(false);
    }
  }, [roomId, loadingOlder]);

  const send = useCallback(
    async (
      body: string,
      attachments: ChatAttachment[] = []
    ): Promise<boolean> => {
      if (!roomId) return false;
      const trimmed = body.trim();
      if (!trimmed && attachments.length === 0) return false;
      if (trimmed.length > CHAT_MAX_BODY) {
        setError(`Messages can be at most ${CHAT_MAX_BODY} characters.`);
        return false;
      }

      const tempId = `tmp-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 7)}`;
      const optimistic: ChatMessageDTO = {
        id: tempId,
        roomId,
        senderId: "self",
        senderName: "You",
        senderRole: "",
        body: trimmed,
        attachments,
        type: "text",
        isDeleted: false,
        editedAt: null,
        createdAt: new Date().toISOString(),
        isMine: true,
      };
      setMessages((prev) => [...prev, optimistic]);
      setSending(true);
      setError(null);

      try {
        const data = await partnerChatSend(roomId, trimmed, attachments);
        const real = { ...data.message, isMine: true };
        // Replace the optimistic row; dedupe in case the poll already
        // echoed the real id before the POST returned.
        setMessages((prev) =>
          dedupeById(prev.map((m) => (m.id === tempId ? real : m)))
        );
        newestIdRef.current = real.id;
        return true;
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : "Couldn't send your message — check your connection."
        );
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        return false;
      } finally {
        setSending(false);
      }
    },
    [roomId]
  );

  const markRead = useCallback(async () => {
    if (!roomId) return;
    const last = newestIdRef.current;
    if (!last || last.startsWith("tmp-")) return;
    try {
      await partnerChatMarkRead(roomId, last);
    } catch {
      /* ignore */
    }
  }, [roomId]);

  const editMessage = useCallback(
    async (id: string, body: string): Promise<boolean> => {
      const trimmed = body.trim();
      if (!trimmed) return false;
      try {
        const data = await partnerChatEditMessage(id, trimmed);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === id
              ? { ...m, body: data.message.body, editedAt: data.message.editedAt }
              : m
          )
        );
        return true;
      } catch (err) {
        setError(
          err instanceof ApiError ? err.message : "Couldn't update the message."
        );
        return false;
      }
    },
    []
  );

  const deleteMessage = useCallback(async (id: string): Promise<boolean> => {
    try {
      await partnerChatDeleteMessage(id);
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, isDeleted: true, body: "" } : m))
      );
      return true;
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Couldn't delete the message."
      );
      return false;
    }
  }, []);

  return useMemo(
    () => ({
      messages,
      hasMore,
      loading,
      loadingOlder,
      sending,
      error,
      send,
      loadOlder,
      markRead,
      editMessage,
      deleteMessage,
      refresh,
    }),
    [
      messages,
      hasMore,
      loading,
      loadingOlder,
      sending,
      error,
      send,
      loadOlder,
      markRead,
      editMessage,
      deleteMessage,
      refresh,
    ]
  );
}

// Append-merge — drops anything already present by id (handles the race
// where a poll echoes a message just after the optimistic send did).
function mergeAppend(
  existing: ChatMessageDTO[],
  incoming: ChatMessageDTO[]
): ChatMessageDTO[] {
  if (incoming.length === 0) return existing;
  const seen = new Set(existing.map((m) => m.id));
  const fresh = incoming.filter((m) => !seen.has(m.id));
  if (fresh.length === 0) return existing;
  return [...existing, ...fresh];
}

function mergePrepend(
  older: ChatMessageDTO[],
  existing: ChatMessageDTO[]
): ChatMessageDTO[] {
  if (older.length === 0) return existing;
  const seen = new Set(existing.map((m) => m.id));
  const fresh = older.filter((m) => !seen.has(m.id));
  if (fresh.length === 0) return existing;
  return [...fresh, ...existing];
}

function dedupeById(list: ChatMessageDTO[]): ChatMessageDTO[] {
  const seen = new Set<string>();
  const out: ChatMessageDTO[] = [];
  for (const m of list) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    out.push(m);
  }
  return out;
}
