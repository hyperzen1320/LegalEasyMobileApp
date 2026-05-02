import { useEffect, useState } from "react";
import { AppState } from "react-native";
import {
  partnerHeartbeat,
  type PartnerPresenceUser,
} from "./api";

const BEAT_INTERVAL_MS = 15_000;

/**
 * Beats the board presence endpoint every 15s while the app is in the
 * foreground. The server-side TTL on `BoardPresence.lastBeat` (60s)
 * means we don't need a clean shutdown signal — closing the screen or
 * backgrounding the app naturally drops the user from presence after
 * about a minute.
 */
export function useBoardPresence(
  boardId: string | null
): PartnerPresenceUser[] {
  const [active, setActive] = useState<PartnerPresenceUser[]>([]);

  useEffect(() => {
    if (!boardId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function beat() {
      if (cancelled) return;
      if (AppState.currentState !== "active") {
        timer = setTimeout(beat, BEAT_INTERVAL_MS);
        return;
      }
      try {
        const res = await partnerHeartbeat(boardId!);
        if (!cancelled) setActive(res.active ?? []);
      } catch {
        // network blip — try again next tick
      }
      if (cancelled) return;
      timer = setTimeout(beat, BEAT_INTERVAL_MS);
    }

    beat();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [boardId]);

  return active;
}
