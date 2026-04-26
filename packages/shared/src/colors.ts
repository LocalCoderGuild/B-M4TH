export const PLAYER_COLOR_KEYS = ["orange", "cyan", "pink", "green", "violet", "yellow"] as const;
export type PlayerColorKey = (typeof PLAYER_COLOR_KEYS)[number];

export function defaultColorForSeat(seatIndex: number): PlayerColorKey {
  const len = PLAYER_COLOR_KEYS.length;
  const i = ((seatIndex % len) + len) % len;
  return PLAYER_COLOR_KEYS[i]!;
}
