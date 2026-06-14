import { useWindowDimensions } from "react-native";

// Window-size classes for adaptive layout, aligned with Material 3 cuts
// (600/840) and mirrored in tailwind.config.js `screens` so NativeWind
// `sm:`/`md:` prefixes and this hook always agree:
//
//   compact   < 600 dp   phones (portrait)
//   medium    600–839    large phones landscape, small tablets, foldables
//   expanded  ≥ 840      tablets, desktop-class windows
//
// Rule of thumb: NativeWind prefixes for COSMETIC changes (padding, type
// scale, column spans); this hook for STRUCTURAL ones (mounting a second
// pane, FlashList numColumns, sheet ⇄ side-panel swaps).
//
// useWindowDimensions (never Dimensions.get) so rotation, split-screen
// and foldable posture changes propagate live.

export type Breakpoint = "compact" | "medium" | "expanded";

export const BREAKPOINTS = {
  medium: 600,
  expanded: 840,
} as const;

// Accessibility font-scaling clamps (maxFontSizeMultiplier). Body copy
// tolerates more growth than dense chrome (badges, eyebrows, tab labels)
// before layouts clip. Keep the numbers here, not scattered in screens.
export const FONT_CLAMP = {
  body: 1.3,
  chrome: 1.15,
} as const;

export type BreakpointInfo = {
  bp: Breakpoint;
  width: number;
  height: number;
  isCompact: boolean;
  isMedium: boolean;
  isExpanded: boolean;
  isLandscape: boolean;
};

export function useBreakpoint(): BreakpointInfo {
  const { width, height } = useWindowDimensions();
  const bp: Breakpoint =
    width >= BREAKPOINTS.expanded
      ? "expanded"
      : width >= BREAKPOINTS.medium
        ? "medium"
        : "compact";
  return {
    bp,
    width,
    height,
    isCompact: bp === "compact",
    isMedium: bp === "medium",
    isExpanded: bp === "expanded",
    isLandscape: width > height,
  };
}
