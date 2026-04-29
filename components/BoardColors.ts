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
};

export const BOARD_COLORS: BoardColor[] = [
  "forest",
  "copper",
  "sea",
  "terracotta",
  "ochre",
  "plum",
  "ink",
];
