import { describe, expect, test, beforeEach } from "bun:test";
import { Board } from "@engine/board";
import { TILE_CONFIGS } from "@entities";
import type { Tile } from "@entities";

function makeTile(face: string, id = face): Tile {
  const cfg = TILE_CONFIGS.find((t) => t.face === face);
  if (!cfg) throw new Error(`Unknown tile face: ${face}`);
  return { id, type: cfg.type, face: cfg.face, value: cfg.value };
}

describe("Board - initialisation", () => {
  test("creates a 15x15 grid", () => {
    const board = Board.create();
    const snap = board.getSnapshot();
    expect(snap.length).toBe(15);
    for (const row of snap) {
      expect(row.length).toBe(15);
    }
  });

  test("all cells start with no tile", () => {
    const board = Board.create();
    for (const row of board.getSnapshot()) {
      for (const cell of row) {
        expect(cell.tile).toBeNull();
      }
    }
  });

  test("center cell (7,7) is normal", () => {
    const board = Board.create();
    expect(board.getCell({ row: 7, col: 7 }).premium).toBe("normal");
  });

  test("premium square counts are correct", () => {
    const board = Board.create();
    const counts: Record<string, number> = {
      normal: 0,
      "2x_piece": 0,
      "3x_piece": 0,
      "2x_eq": 0,
      "3x_eq": 0,
    };
    for (const row of board.getSnapshot()) {
      for (const cell of row) {
        counts[cell.premium]!++;
      }
    }
    expect(counts["3x_eq"]).toBe(8);
    expect(counts["3x_piece"]).toBe(16);
    expect(counts["2x_eq"]).toBe(12);
    expect(counts["2x_piece"]).toBe(24);
    expect(counts["normal"]).toBe(225 - 8 - 16 - 12 - 24);
  });
});

describe("Board - premium square positions", () => {
  test("corners are 3x_eq", () => {
    const board = Board.create();
    for (const [r, c] of [[0, 0], [0, 14], [14, 0], [14, 14]] as const) {
      expect(board.getCell({ row: r, col: c }).premium).toBe("3x_eq");
    }
  });

  test("edge midpoints are 3x_eq", () => {
    const board = Board.create();
    for (const [r, c] of [[0, 7], [7, 0], [7, 14], [14, 7]] as const) {
      expect(board.getCell({ row: r, col: c }).premium).toBe("3x_eq");
    }
  });

  test("outer 3x_piece squares", () => {
    const board = Board.create();
    for (const [r, c] of [[1, 5], [1, 9], [5, 1], [5, 13], [9, 1], [9, 13], [13, 5], [13, 9]] as const) {
      expect(board.getCell({ row: r, col: c }).premium).toBe("3x_piece");
    }
  });

  test("inner 3x_piece squares (ring inside outer)", () => {
    const board = Board.create();
    for (const [r, c] of [[4, 4], [4, 10], [5, 5], [5, 9], [9, 5], [9, 9], [10, 4], [10, 10]] as const) {
      expect(board.getCell({ row: r, col: c }).premium).toBe("3x_piece");
    }
  });

  test("outer diagonal 2x_eq squares", () => {
    const board = Board.create();
    for (const [r, c] of [[1, 1], [2, 2], [3, 3], [11, 11], [12, 12], [13, 13]] as const) {
      expect(board.getCell({ row: r, col: c }).premium).toBe("2x_eq");
    }
  });

  test("outer anti-diagonal 2x_eq squares", () => {
    const board = Board.create();
    for (const [r, c] of [[1, 13], [2, 12], [3, 11], [11, 3], [12, 2], [13, 1]] as const) {
      expect(board.getCell({ row: r, col: c }).premium).toBe("2x_eq");
    }
  });

  test("2x_piece on top/bottom edge rows", () => {
    const board = Board.create();
    for (const [r, c] of [[0, 3], [0, 11], [14, 3], [14, 11]] as const) {
      expect(board.getCell({ row: r, col: c }).premium).toBe("2x_piece");
    }
  });

  test("2x_piece flanking center column and row", () => {
    const board = Board.create();
    for (const [r, c] of [[3, 7], [11, 7], [7, 3], [7, 11]] as const) {
      expect(board.getCell({ row: r, col: c }).premium).toBe("2x_piece");
    }
  });

  test("2x_piece on left/right edge columns", () => {
    const board = Board.create();
    for (const [r, c] of [[3, 0], [3, 14], [11, 0], [11, 14]] as const) {
      expect(board.getCell({ row: r, col: c }).premium).toBe("2x_piece");
    }
  });
});

describe("Board - bounds checking", () => {
  test("isInBounds: valid corners return true", () => {
    const board = Board.create();
    expect(board.isInBounds({ row: 0, col: 0 })).toBe(true);
    expect(board.isInBounds({ row: 14, col: 14 })).toBe(true);
    expect(board.isInBounds({ row: 7, col: 7 })).toBe(true);
  });

  test("isInBounds: out-of-range positions return false", () => {
    const board = Board.create();
    expect(board.isInBounds({ row: -1, col: 0 })).toBe(false);
    expect(board.isInBounds({ row: 0, col: -1 })).toBe(false);
    expect(board.isInBounds({ row: 15, col: 0 })).toBe(false);
    expect(board.isInBounds({ row: 0, col: 15 })).toBe(false);
  });

  test("getCell throws RangeError for out-of-bounds position", () => {
    const board = Board.create();
    expect(() => board.getCell({ row: -1, col: 0 })).toThrow(RangeError);
    expect(() => board.getCell({ row: 0, col: 15 })).toThrow(RangeError);
  });
});

describe("Board - placeTile / removeTile", () => {
  let board: Board;
  beforeEach(() => {
    board = Board.create();
  });

  test("placeTile sets the tile on the cell", () => {
    const tile = makeTile("5");
    board.placeTile({ row: 7, col: 7 }, tile);
    expect(board.getCell({ row: 7, col: 7 }).tile).toEqual(tile);
  });

  test("isOccupied reflects placement", () => {
    const pos = { row: 3, col: 3 };
    expect(board.isOccupied(pos)).toBe(false);
    board.placeTile(pos, makeTile("1"));
    expect(board.isOccupied(pos)).toBe(true);
  });

  test("placeTile throws if cell is already occupied", () => {
    const pos = { row: 0, col: 0 };
    board.placeTile(pos, makeTile("1"));
    expect(() => board.placeTile(pos, makeTile("2"))).toThrow();
  });

  test("placeTile throws RangeError for out-of-bounds position", () => {
    expect(() => board.placeTile({ row: 15, col: 0 }, makeTile("1"))).toThrow(RangeError);
  });

  test("removeTile returns the tile and clears the cell", () => {
    const pos = { row: 7, col: 7 };
    const tile = makeTile("9");
    board.placeTile(pos, tile);
    const removed = board.removeTile(pos);
    expect(removed).toEqual(tile);
    expect(board.getCell(pos).tile).toBeNull();
    expect(board.isOccupied(pos)).toBe(false);
  });

  test("removeTile returns null for an empty cell", () => {
    expect(board.removeTile({ row: 5, col: 5 })).toBeNull();
  });

  test("removeTile throws RangeError for out-of-bounds position", () => {
    expect(() => board.removeTile({ row: -1, col: 0 })).toThrow(RangeError);
  });

  test("premium type is preserved after place and remove", () => {
    const pos = { row: 0, col: 0 }; // 3x_eq corner
    board.placeTile(pos, makeTile("1"));
    board.removeTile(pos);
    expect(board.getCell(pos).premium).toBe("3x_eq");
  });

  test("multiple tiles can be placed on different cells", () => {
    board.placeTile({ row: 7, col: 5 }, makeTile("3", "t1"));
    board.placeTile({ row: 7, col: 6 }, makeTile("+", "t2"));
    board.placeTile({ row: 7, col: 7 }, makeTile("2", "t3"));
    expect(board.isOccupied({ row: 7, col: 5 })).toBe(true);
    expect(board.isOccupied({ row: 7, col: 6 })).toBe(true);
    expect(board.isOccupied({ row: 7, col: 7 })).toBe(true);
  });
});

describe("Board - getSnapshot encapsulation", () => {
  test("mutating snapshot does not affect the board", () => {
    const board = Board.create();
    board.placeTile({ row: 0, col: 0 }, makeTile("5"));
    const snap = board.getSnapshot();
    snap[0]![0]!.tile = null;
    expect(board.getCell({ row: 0, col: 0 }).tile).not.toBeNull();
  });

  test("each call returns an independent snapshot", () => {
    const board = Board.create();
    const s1 = board.getSnapshot();
    const s2 = board.getSnapshot();
    expect(s1).not.toBe(s2);
    expect(s1[0]).not.toBe(s2[0]);
  });
});
