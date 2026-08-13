import type { BoardColor } from "../lib/api";

export const BOARD_COLOR_STYLES: Record<
  BoardColor,
  {
    gradient: [string, string];
    accent: string;
    text: string;
  }
> = {
  forest: {
    gradient: ["#3a5a40", "#588157"],
    accent: "#a3b18a",
    text: "#f4ede0",
  },
  copper: {
    gradient: ["#c5853a", "#8a5821"],
    accent: "#f5ebd6",
    text: "#2a1c08",
  },
  sea: {
    gradient: ["#56a0a8", "#1f4e54"],
    accent: "#d2e6e7",
    text: "#f4ede0",
  },
  terracotta: {
    gradient: ["#c14a37", "#8b3324"],
    accent: "#f6dccd",
    text: "#fff7ed",
  },
  ochre: {
    gradient: ["#d4a373", "#a0744a"],
    accent: "#fdf6e3",
    text: "#2a1c08",
  },
  plum: {
    gradient: ["#6b2737", "#3d1a25"],
    accent: "#e9d6dd",
    text: "#fff7ed",
  },
  ink: {
    gradient: ["#1a2444", "#0a1124"],
    accent: "#c5853a",
    text: "#f5ebd6",
  },
  slate: {
    gradient: ["#5a6b7a", "#2c3947"],
    accent: "#d8e2ea",
    text: "#f4ede0",
  },
  olive: {
    gradient: ["#7d8347", "#4a4f25"],
    accent: "#e8eac6",
    text: "#f4ede0",
  },
  indigo: {
    gradient: ["#544f92", "#2c2a55"],
    accent: "#dcd9f2",
    text: "#f4ede0",
  },
};

// Swatch order. Must stay in step with the server's BOARD_COLORS
// (legaleasy/src/lib/board-defaults.ts) — a colour this app offers but the
// API doesn't know is a save that fails validation.
export const BOARD_COLORS: BoardColor[] = [
  "forest",
  "copper",
  "sea",
  "terracotta",
  "ochre",
  "plum",
  "ink",
  "slate",
  "olive",
  "indigo",
];
