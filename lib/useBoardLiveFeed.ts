import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import {
  partnerLiveFeed,
  type LiveActivityRow,
  ApiError,
} from "./api";

// useBoardLiveFeed — adaptive polling against /api/app/activity/live so
// the canvas, the bell drawer, and any list-of-events surface stays
// fresh without a websocket.
//
// Cadence is driven by AppState (RN equivalent of Page Visibility):
//   • foreground & recently-active board → 1.5s
//   • foreground but quiet for 30s+      → 4s
//   • background / inactive               → paused (next event triggered
//                                            by an AppState change back
//                                            to active)
//
// Returns the rolling list of new rows plus a `latestSeenId` which the
// caller persists if it cares about unread badging. We deliberately
// keep the API the same shape as the web hook so screens don't have to
// reason about transport.

const ACTIVE_MS = 1500;
const IDLE_MS = 4000;
const ACTIVE_WINDOW_MS = 30_000;
const MAX_BUFFER = 80;

type State = {
  newRows: LiveActivityRow[];
  unreadCount: number;
  latestSeenId: string | null;
  isLive: boolean;
};

export function useBoardLiveFeed(opts: {
  boardId?: string | null;
  initialSinceId?: string | null;
}): State & { markSeen: () => void } {
  const { boardId = null, initialSinceId = null } = opts;

  const [newRows, setNewRows] = useState<LiveActivityRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [latestSeenId, setLatestSeenId] = useState<string | null>(
    initialSinceId
  );
  const [isLive, setIsLive] = useState(true);

  // Refs read by the polling loop (avoids loop re-creation on every event).
  const sinceRef = useRef<string | null>(initialSinceId);
  const lastChangeAtRef = useRef<number>(0);
  const appActiveRef = useRef<boolean>(
    AppState.currentState === "active"
  );

  const ingestRows = useCallback(
    (rows: LiveActivityRow[]) => {
      if (rows.length === 0) return;
      lastChangeAtRef.current = Date.now();

      const newest = rows[rows.length - 1].id;
      const prev = sinceRef.current;
      if (!prev || newest > prev) {
        sinceRef.current = newest;
        setLatestSeenId(newest);
      }
      setNewRows((current) => {
        const seen = new Set(current.map((r) => r.id));
        const filtered = rows.filter((r) => !seen.has(r.id));
        if (filtered.length === 0) return current;
        return [...current, ...filtered].slice(-MAX_BUFFER);
      });
      setUnreadCount((c) => c + rows.length);
    },
    []
  );

  const markSeen = useCallback(() => {
    setUnreadCount(0);
  }, []);

  // Track foreground / background — pauses the loop entirely when the
  // app is inactive so we don't burn battery polling in the background.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      const active = next === "active";
      appActiveRef.current = active;
      if (active) {
        // Force an immediate poll when returning to foreground.
        lastChangeAtRef.current = Date.now();
      }
    });
    return () => sub.remove();
  }, []);

  // Self-scheduling polling loop. Cadence is recomputed each tick.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (lastChangeAtRef.current === 0) {
      lastChangeAtRef.current = Date.now();
    }

    function pickInterval(): number | null {
      if (!appActiveRef.current) return null; // pause
      const elapsed = Date.now() - lastChangeAtRef.current;
      return elapsed < ACTIVE_WINDOW_MS ? ACTIVE_MS : IDLE_MS;
    }

    async function tick() {
      if (cancelled) return;
      const interval = pickInterval();
      if (interval === null) {
        // Paused — poll every 5s just to detect a focus change we
        // missed for some reason; AppState listener will normally wake
        // us up immediately.
        timer = setTimeout(tick, 5000);
        return;
      }
      try {
        const data = await partnerLiveFeed({
          since: sinceRef.current,
          boardId,
        });
        if (data.events && data.events.length > 0) {
          ingestRows(data.events);
        } else if (data.latestId && !sinceRef.current) {
          sinceRef.current = data.latestId;
          setLatestSeenId(data.latestId);
        }
        if (!isLive) setIsLive(true);
      } catch (err) {
        if (err instanceof ApiError && err.status === 429) {
          // back off for a few seconds when rate limited
          if (cancelled) return;
          timer = setTimeout(tick, 5000);
          return;
        }
        if (isLive) setIsLive(false);
      }

      if (cancelled) return;
      timer = setTimeout(tick, interval);
    }

    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // ingestRows is stable; isLive intentionally excluded so a transient
    // network blip doesn't restart the loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId, ingestRows]);

  return { newRows, unreadCount, latestSeenId, isLive, markSeen };
}
