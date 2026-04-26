import { describe, expect, test } from "bun:test";
import { Board } from "@engine/board";
import { MoveValidator } from "@engine/move-validator";
import type { Placement } from "@entities";
import { makeTile } from "../helpers/make-tile";

function p(face: string, row: number, col: number): Placement {
  return { tile: makeTile(face), position: { row, col } };
}

describe("MoveValidator.isLinear", () => {
  test("single tile is linear", () => {
    expect(MoveValidator.isLinear([p("1", 7, 7)])).toBe(true);
  });

  test("empty array is linear", () => {
    expect(MoveValidator.isLinear([])).toBe(true);
  });

  test("all same row is linear", () => {
    expect(MoveValidator.isLinear([p("1", 7, 5), p("+", 7, 6), p("2", 7, 7)])).toBe(true);
  });

  test("all same col is linear", () => {
    expect(MoveValidator.isLinear([p("1", 5, 7), p("+", 6, 7), p("2", 7, 7)])).toBe(true);
  });

  test("diagonal placement is not linear", () => {
    expect(MoveValidator.isLinear([p("1", 5, 5), p("+", 6, 6)])).toBe(false);
  });

  test("L-shaped placement is not linear", () => {
    expect(MoveValidator.isLinear([p("1", 7, 5), p("+", 7, 6), p("2", 8, 6)])).toBe(false);
  });
});

describe("MoveValidator.hasNoGaps", () => {
  test("single tile has no gaps", () => {
    const board = Board.create();
    board.placeTile({ row: 7, col: 7 }, makeTile("1", "t1"));
    expect(MoveValidator.hasNoGaps(board, [p("1", 7, 7)])).toBe(true);
  });

  test("horizontal run with no gap", () => {
    const board = Board.create();
    board.placeTile({ row: 7, col: 5 }, makeTile("1", "a"));
    board.placeTile({ row: 7, col: 6 }, makeTile("+", "b"));
    board.placeTile({ row: 7, col: 7 }, makeTile("2", "c"));
    expect(MoveValidator.hasNoGaps(board, [p("1", 7, 5), p("2", 7, 7)])).toBe(true);
  });

  test("horizontal run with gap returns false", () => {
    const board = Board.create();
    board.placeTile({ row: 7, col: 5 }, makeTile("1", "a"));
    board.placeTile({ row: 7, col: 7 }, makeTile("2", "c"));
    // col 6 is empty — gap
    expect(MoveValidator.hasNoGaps(board, [p("1", 7, 5), p("2", 7, 7)])).toBe(false);
  });

  test("vertical run with no gap", () => {
    const board = Board.create();
    board.placeTile({ row: 5, col: 7 }, makeTile("1", "a"));
    board.placeTile({ row: 6, col: 7 }, makeTile("+", "b"));
    board.placeTile({ row: 7, col: 7 }, makeTile("2", "c"));
    expect(MoveValidator.hasNoGaps(board, [p("1", 5, 7), p("2", 7, 7)])).toBe(true);
  });

  test("vertical run with gap returns false", () => {
    const board = Board.create();
    board.placeTile({ row: 5, col: 7 }, makeTile("1", "a"));
    board.placeTile({ row: 7, col: 7 }, makeTile("2", "c"));
    expect(MoveValidator.hasNoGaps(board, [p("1", 5, 7), p("2", 7, 7)])).toBe(false);
  });
});

describe("MoveValidator.isConnected - first move", () => {
  test("placement on center is connected", () => {
    const board = Board.create();
    const placements = [{ tile: makeTile("1"), position: { row: 7, col: 7 } }];
    expect(MoveValidator.isConnected(board, placements, true)).toBe(true);
  });

  test("multi-tile placement covering center is connected", () => {
    const board = Board.create();
    const placements = [
      { tile: makeTile("1"), position: { row: 7, col: 6 } },
      { tile: makeTile("+"), position: { row: 7, col: 7 } },
      { tile: makeTile("2"), position: { row: 7, col: 8 } },
    ];
    expect(MoveValidator.isConnected(board, placements, true)).toBe(true);
  });

  test("placement not on center is not connected", () => {
    const board = Board.create();
    const placements = [{ tile: makeTile("1"), position: { row: 0, col: 0 } }];
    expect(MoveValidator.isConnected(board, placements, true)).toBe(false);
  });

  test("empty placements return false", () => {
    const board = Board.create();
    expect(MoveValidator.isConnected(board, [], true)).toBe(false);
  });
});

describe("MoveValidator.isConnected - subsequent moves", () => {
  test("placement adjacent to existing tile is connected", () => {
    const board = Board.create();
    board.placeTile({ row: 7, col: 7 }, makeTile("5", "existing"));
    const placements = [{ tile: makeTile("3"), position: { row: 7, col: 8 } }];
    expect(MoveValidator.isConnected(board, placements, false)).toBe(true);
  });

  test("all four orthogonal directions count as connected", () => {
    const dirs = [
      { row: 6, col: 7 },
      { row: 8, col: 7 },
      { row: 7, col: 6 },
      { row: 7, col: 8 },
    ];
    for (const pos of dirs) {
      const board = Board.create();
      board.placeTile({ row: 7, col: 7 }, makeTile("5", "anchor"));
      expect(MoveValidator.isConnected(board, [{ tile: makeTile("1"), position: pos }], false)).toBe(true);
    }
  });

  test("isolated placement (no neighbours) is not connected", () => {
    const board = Board.create();
    board.placeTile({ row: 7, col: 7 }, makeTile("5", "existing"));
    const placements = [{ tile: makeTile("1"), position: { row: 0, col: 0 } }];
    expect(MoveValidator.isConnected(board, placements, false)).toBe(false);
  });

  test("multi-tile run connected only via one end tile", () => {
    const board = Board.create();
    board.placeTile({ row: 7, col: 7 }, makeTile("=", "anchor"));
    const placements = [
      { tile: makeTile("1"), position: { row: 7, col: 8 } },
      { tile: makeTile("0"), position: { row: 7, col: 9 } },
    ];
    expect(MoveValidator.isConnected(board, placements, false)).toBe(true);
  });

  test("new tiles adjacent only to each other (not to board) are not connected", () => {
    const board = Board.create();
    board.placeTile({ row: 7, col: 7 }, makeTile("=", "anchor"));
    const placements = [
      { tile: makeTile("1"), position: { row: 0, col: 1 } },
      { tile: makeTile("0"), position: { row: 0, col: 2 } },
    ];
    expect(MoveValidator.isConnected(board, placements, false)).toBe(false);
  });

  test("empty placements return false", () => {
    const board = Board.create();
    expect(MoveValidator.isConnected(board, [], false)).toBe(false);
  });
});
