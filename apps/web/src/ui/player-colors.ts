import type { CSSProperties } from "react";

export const PLAYER_COLOR_KEYS = ["orange", "cyan", "pink", "green", "violet", "yellow"] as const;
export type PlayerColorKey = (typeof PLAYER_COLOR_KEYS)[number];

interface PlayerPalette {
  color: string;
  shadow: string;
  tint: string;
  contrast: string;
  ring: string;
}

export function isHexColor(s: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(s);
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function derivePaletteFromHex(hex: string): PlayerPalette {
  const [r, g, b] = hexToRgb(hex);
  const shadow = `#${[r, g, b].map((c) => Math.round(c * 0.6).toString(16).padStart(2, "0")).join("")}`;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return {
    color: hex,
    shadow,
    tint: `rgba(${r}, ${g}, ${b}, 0.18)`,
    contrast: lum > 0.45 ? "#0d0d0d" : "#f0f0f0",
    ring: `rgba(${r}, ${g}, ${b}, 0.48)`,
  };
}

const PALETTES: Record<PlayerColorKey, PlayerPalette> = {
  orange: {
    color: "#d76a2d",
    shadow: "#9a4516",
    tint: "rgba(215, 106, 45, 0.18)",
    contrast: "#140a03",
    ring: "rgba(215, 106, 45, 0.5)",
  },
  cyan: {
    color: "#3dd6d0",
    shadow: "#20857f",
    tint: "rgba(61, 214, 208, 0.18)",
    contrast: "#041416",
    ring: "rgba(61, 214, 208, 0.45)",
  },
  pink: {
    color: "#ff6fb1",
    shadow: "#b64779",
    tint: "rgba(255, 111, 177, 0.18)",
    contrast: "#190811",
    ring: "rgba(255, 111, 177, 0.48)",
  },
  green: {
    color: "#a7e34b",
    shadow: "#67882b",
    tint: "rgba(167, 227, 75, 0.18)",
    contrast: "#0d1403",
    ring: "rgba(167, 227, 75, 0.45)",
  },
  violet: {
    color: "#c78cff",
    shadow: "#8758b2",
    tint: "rgba(199, 140, 255, 0.18)",
    contrast: "#12081b",
    ring: "rgba(199, 140, 255, 0.48)",
  },
  yellow: {
    color: "#ffd45c",
    shadow: "#b6891b",
    tint: "rgba(255, 212, 92, 0.18)",
    contrast: "#1a1202",
    ring: "rgba(255, 212, 92, 0.5)",
  },
};

type PlayerColorVars = CSSProperties & {
  "--player-color": string;
  "--player-shadow": string;
  "--player-tint": string;
  "--player-contrast": string;
  "--player-ring": string;
};

function isColorKey(key: string): key is PlayerColorKey {
  return (PLAYER_COLOR_KEYS as readonly string[]).includes(key);
}

export function defaultColorForSeat(seatIndex: number): PlayerColorKey {
  const len = PLAYER_COLOR_KEYS.length;
  const i = ((seatIndex % len) + len) % len;
  return PLAYER_COLOR_KEYS[i]!;
}

export function getPlayerPaletteByKey(key: string): PlayerPalette {
  return PALETTES[isColorKey(key) ? key : "orange"];
}

export function resolvePlayerColorKey(
  color: string | null | undefined,
  seatIndex: number,
): PlayerColorKey {
  if (color && isColorKey(color)) return color;
  return defaultColorForSeat(seatIndex);
}

export function getPlayerColorVars(seatIndex: number, color?: string | null): PlayerColorVars {
  const palette = color && isHexColor(color)
    ? derivePaletteFromHex(color)
    : PALETTES[resolvePlayerColorKey(color, seatIndex)];
  return {
    "--player-color": palette.color,
    "--player-shadow": palette.shadow,
    "--player-tint": palette.tint,
    "--player-contrast": palette.contrast,
    "--player-ring": palette.ring,
  };
}

export function getSwatchHex(key: PlayerColorKey): string {
  return PALETTES[key].color;
}

/** Returns the hex string for any color value (preset key or raw hex), falling back to seat default. */
export function getColorHex(color: string | null | undefined, seatIndex: number): string {
  if (color && isHexColor(color)) return color;
  return PALETTES[resolvePlayerColorKey(color, seatIndex)].color;
}
