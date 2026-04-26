import { describe, expect, test } from "bun:test";
import { Board } from "@engine/board";
import { BoardScanner } from "@engine/board-scanner";
import type { Placement } from "@entities";
import { makeTile } from "../helpers/make-tile";

function place(board: Board, tiles: Array<{ face: string; row: number; col: number }>) {
  for (const { face, row, col } of tiles) {
    board.placeTile({ row, col }, makeTile(face, `${face}-${row}-${col}`));
  }
}

function placements(tiles: Array<{ face: string; row: number; col: number }>): Placement[] {
  return tiles.map(({ face, row, col }) => ({
    tile: makeTile(face, `${face}-${row}-${col}`),
    position: { row, col },
  }));
}

describe("BoardScanner.scan - no placements", () => {
  test("returns empty array for empty placements", () => {
    const board = Board.create();
    expect(BoardScanner.scan(board, [])).toEqual([]);
  });
});

describe("BoardScanner.scan - single tile placed", () => {
  test("single tile adjacent to a horizontal line returns the horizontal equation", () => {
    const board = Board.create();
    place(board, [
      { face: "1", row: 7, col: 5 },
      { face: "+", row: 7, col: 6 },
      { face: "3", row: 7, col: 7 },
      { face: "=", row: 7, col: 8 },
      { face: "4", row: 7, col: 9 },
    ]);
    // place one new tile extending the line
    board.placeTile({ row: 7, col: 4 }, makeTile("2", "new"));
    const ps = placements([{ face: "2", row: 7, col: 4 }]);
    const result = BoardScanner.scan(board, ps);
    expect(result).toHaveLength(1);
    expect(result[0]!.faces).toEqual(["2", "1", "+", "3", "=", "4"]);
  });

  test("single isolated tile forms no equations (line < 2)", () => {
    const board = Board.create();
    board.placeTile({ row: 7, col: 7 }, makeTile("5", "new"));
    const ps = placements([{ face: "5", row: 7, col: 7 }]);
    const result = BoardScanner.scan(board, ps);
    expect(result).toHaveLength(0);
  });

  test("single tile with one neighbor returns a 2-tile line", () => {
    const board = Board.create();
    board.placeTile({ row: 7, col: 7 }, makeTile("=", "anchor"));
    board.placeTile({ row: 7, col: 8 }, makeTile("5", "new"));
    const ps = placements([{ face: "5", row: 7, col: 8 }]);
    const result = BoardScanner.scan(board, ps);
    expect(result).toHaveLength(1);
    expect(result[0]!.faces).toEqual(["=", "5"]);
  });

  test("single tile at intersection returns both horizontal and vertical equations", () => {
    const board = Board.create();
    // horizontal: col 5–7
    place(board, [
      { face: "1", row: 7, col: 5 },
      { face: "=", row: 7, col: 6 },
      { face: "1", row: 7, col: 7 },
    ]);
    // vertical: row 5–6
    place(board, [
      { face: "2", row: 5, col: 6 },
      { face: "+", row: 6, col: 6 },
    ]);
    // new tile at (7,6) already placed as part of the horizontal; test as if it's the new tile
    // Actually we need to test a new tile added at the intersection
    const board2 = Board.create();
    place(board2, [
      { face: "1", row: 7, col: 5 },
      { face: "1", row: 7, col: 7 },
      { face: "2", row: 5, col: 6 },
      { face: "+", row: 6, col: 6 },
    ]);
    board2.placeTile({ row: 7, col: 6 }, makeTile("=", "new"));
    const ps = placements([{ face: "=", row: 7, col: 6 }]);
    const result = BoardScanner.scan(board2, ps);
    expect(result).toHaveLength(2);
    const hLine = result.find((r) => r.faces.includes("1") && r.positions[0]!.row === 7)!;
    const vLine = result.find((r) => r.positions[0]!.col === 6)!;
    expect(hLine.faces).toEqual(["1", "=", "1"]);
    expect(vLine.faces).toEqual(["2", "+", "="]);
  });
});

describe("BoardScanner.scan - multi-tile horizontal placement", () => {
  test("placing a horizontal run returns the full main line", () => {
    const board = Board.create();
    place(board, [
      { face: "1", row: 7, col: 5 },
      { face: "+", row: 7, col: 6 },
      { face: "2", row: 7, col: 7 },
      { face: "=", row: 7, col: 8 },
      { face: "3", row: 7, col: 9 },
    ]);
    const ps = placements([
      { face: "1", row: 7, col: 5 },
      { face: "+", row: 7, col: 6 },
      { face: "2", row: 7, col: 7 },
      { face: "=", row: 7, col: 8 },
      { face: "3", row: 7, col: 9 },
    ]);
    const result = BoardScanner.scan(board, ps);
    expect(result).toHaveLength(1);
    expect(result[0]!.faces).toEqual(["1", "+", "2", "=", "3"]);
  });

  test("horizontal run with cross-equation returns both lines", () => {
    const board = Board.create();
    // existing vertical at col 7: rows 5–6
    place(board, [
      { face: "3", row: 5, col: 7 },
      { face: "+", row: 6, col: 7 },
    ]);
    // new horizontal tiles in row 7 cols 5–9
    place(board, [
      { face: "1", row: 7, col: 5 },
      { face: "+", row: 7, col: 6 },
      { face: "2", row: 7, col: 7 },
      { face: "=", row: 7, col: 8 },
      { face: "3", row: 7, col: 9 },
    ]);
    const ps = placements([
      { face: "1", row: 7, col: 5 },
      { face: "+", row: 7, col: 6 },
      { face: "2", row: 7, col: 7 },
      { face: "=", row: 7, col: 8 },
      { face: "3", row: 7, col: 9 },
    ]);
    const result = BoardScanner.scan(board, ps);
    expect(result).toHaveLength(2);
    const main = result.find((r) => r.positions[0]!.row === 7)!;
    const cross = result.find((r) => r.positions[0]!.col === 7)!;
    expect(main.faces).toEqual(["1", "+", "2", "=", "3"]);
    expect(cross.faces).toEqual(["3", "+", "2"]);
  });
});

describe("BoardScanner.scan - multi-tile vertical placement", () => {
  test("placing a vertical run returns the full main line", () => {
    const board = Board.create();
    place(board, [
      { face: "5", row: 3, col: 7 },
      { face: "=", row: 4, col: 7 },
      { face: "5", row: 5, col: 7 },
    ]);
    const ps = placements([
      { face: "5", row: 3, col: 7 },
      { face: "=", row: 4, col: 7 },
      { face: "5", row: 5, col: 7 },
    ]);
    const result = BoardScanner.scan(board, ps);
    expect(result).toHaveLength(1);
    expect(result[0]!.faces).toEqual(["5", "=", "5"]);
  });
});

describe("BoardScanner.scan - deduplication", () => {
  test("same line is not returned twice when multiple placed tiles hit it", () => {
    const board = Board.create();
    place(board, [
      { face: "2", row: 7, col: 5 },
      { face: "+", row: 7, col: 6 },
      { face: "3", row: 7, col: 7 },
      { face: "=", row: 7, col: 8 },
      { face: "5", row: 7, col: 9 },
    ]);
    // two new tiles both on the same horizontal line
    const ps = placements([
      { face: "2", row: 7, col: 5 },
      { face: "5", row: 7, col: 9 },
    ]);
    const result = BoardScanner.scan(board, ps);
    expect(result).toHaveLength(1);
  });
});

describe("BoardScanner.scan - stress cases", () => {
  test("dense cross formation returns 1 main line + 5 cross lines", () => {
    const board = Board.create();

    // Existing vertical stems above and below each future placed tile.
    for (let col = 5; col <= 9; col++) {
      board.placeTile({ row: 6, col }, makeTile("1", `up-${col}`));
      board.placeTile({ row: 8, col }, makeTile("1", `down-${col}`));
    }

    // New horizontal run on row 7.
    const newTiles = [
      { face: "1", row: 7, col: 5 },
      { face: "1", row: 7, col: 6 },
      { face: "1", row: 7, col: 7 },
      { face: "1", row: 7, col: 8 },
      { face: "1", row: 7, col: 9 },
    ];
    place(board, newTiles);
    const ps = placements(newTiles);

    const result = BoardScanner.scan(board, ps);
    expect(result).toHaveLength(6);

    const lengths = result.map((line) => line.positions.length).sort((a, b) => a - b);
    expect(lengths).toEqual([3, 3, 3, 3, 3, 5]);
  });

  test("long 15-cell line is returned once even when many placements touch it", () => {
    const board = Board.create();
    for (let col = 0; col < 15; col++) {
      board.placeTile({ row: 10, col }, makeTile("1", `line-${col}`));
    }

    const ps = placements([
      { face: "1", row: 10, col: 0 },
      { face: "1", row: 10, col: 7 },
      { face: "1", row: 10, col: 14 },
    ]);

    const result = BoardScanner.scan(board, ps);
    expect(result).toHaveLength(1);
    expect(result[0]!.positions).toHaveLength(15);
  });
});
