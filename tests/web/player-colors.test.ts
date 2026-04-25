import { describe, expect, test } from "bun:test";
import {
  PLAYER_COLOR_KEYS,
  defaultColorForSeat,
  getPlayerPaletteByKey,
  resolvePlayerColorKey,
} from "../../apps/web/src/ui/player-colors";

describe("player color palette", () => {
  test("each palette key maps to a distinct hex color", () => {
    const colors = PLAYER_COLOR_KEYS.map((k) => getPlayerPaletteByKey(k).color);
    expect(new Set(colors).size).toBe(colors.length);
  });

  test("defaultColorForSeat wraps beyond the first cycle", () => {
    const len = PLAYER_COLOR_KEYS.length;
    expect(defaultColorForSeat(0)).toBe(defaultColorForSeat(len));
    expect(defaultColorForSeat(1)).toBe(defaultColorForSeat(len + 1));
  });

  test("resolvePlayerColorKey honors a valid key, falls back to seat default otherwise", () => {
    expect(resolvePlayerColorKey("violet", 0)).toBe("violet");
    expect(resolvePlayerColorKey("", 1)).toBe(defaultColorForSeat(1));
    expect(resolvePlayerColorKey(null, 2)).toBe(defaultColorForSeat(2));
    expect(resolvePlayerColorKey("not-a-color", 3)).toBe(defaultColorForSeat(3));
  });
});
