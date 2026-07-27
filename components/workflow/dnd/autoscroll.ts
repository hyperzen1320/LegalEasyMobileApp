// Edge autoscroll while dragging on the Kanban — shared by the card hook
// (useBoardDnd) and the column hook (useListDnd) so the board can never
// scroll at two different speeds depending on what you happen to be
// holding.
//
// It used to be `8 + distance / 5` per frame in both files. At 60fps that
// is 480 px/s the moment you touch the band and ~1140 px/s at the very
// edge — most of a phone screen every second. You couldn't stop where you
// meant to, which is what "speed should be reduced" was about.
//
// `3 + distance / 12` is 180 px/s entering the band, ~460 px/s pinned to
// the edge. Still deliberate movement, but slow enough to release on the
// column you were aiming for.

/** Distance from a screen edge, in px, that starts horizontal autoscroll. */
export const EDGE_BAND = 56;

const BASE_PX_PER_FRAME = 3;
const RAMP_DIVISOR = 12;

/**
 * Pixels to scroll this frame for a finger at `x`. Negative scrolls left,
 * positive right, 0 means the finger is away from both edges.
 *
 * A worklet: it runs inside useFrameCallback on the UI thread.
 */
export function edgeAutoscrollDelta(x: number, screenWidth: number): number {
  "worklet";
  if (x < EDGE_BAND) {
    return -(BASE_PX_PER_FRAME + Math.round((EDGE_BAND - x) / RAMP_DIVISOR));
  }
  if (x > screenWidth - EDGE_BAND) {
    return (
      BASE_PX_PER_FRAME +
      Math.round((x - (screenWidth - EDGE_BAND)) / RAMP_DIVISOR)
    );
  }
  return 0;
}

// Long-press delays. The card must win when the finger is on a card, and
// the column when it's anywhere else — so the card's delay is comfortably
// shorter and the two can't race for the same touch.
export const CARD_LONG_PRESS_MS = 300;
export const COLUMN_LONG_PRESS_MS = 450;
