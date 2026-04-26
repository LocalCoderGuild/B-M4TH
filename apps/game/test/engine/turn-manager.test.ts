import { describe, expect, test } from "bun:test";
import { Board } from "@engine/board";
import { TileBag } from "@engine/tile-bag";
import { TurnManager } from "@engine/turn-manager";
import type { Placement } from "@entities";
import { makeTile } from "../helpers/make-tile";

function placeAndCollect(
  board: Board,
  tiles: Array<{ face: string; row: number; col: number }>,
): Placement[] {
  const ps: Placement[] = [];
  for (const { face, row, col } of tiles) {
    const tile = makeTile(face, `${face}-${row}-${col}`);
    board.placeTile({ row, col }, tile);
    ps.push({ tile, position: { row, col } });
  }
  return ps;
}

// Pre-populate existing board tiles (not part of new placements)
function prePlaced(board: Board, tiles: Array<{ face: string; row: number; col: number }>) {
  for (const { face, row, col } of tiles) {
    board.placeTile({ row, col }, makeTile(face, `pre-${face}-${row}-${col}`));
  }
}

describe("TurnManager.validatePlay - first move", () => {
  test("valid first move covering center returns ok with equations", () => {
    const board = Board.create();
    const ps = placeAndCollect(board, [
      { face: "1", row: 7, col: 5 },
      { face: "+", row: 7, col: 6 },
      { face: "2", row: 7, col: 7 },
      { face: "=", row: 7, col: 8 },
      { face: "3", row: 7, col: 9 },
    ]);
    const result = TurnManager.validatePlay(board, ps, true);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.equations).toHaveLength(1);
    }
  });

  test("first move not covering center returns error", () => {
    const board = Board.create();
    const ps = placeAndCollect(board, [
      { face: "1", row: 0, col: 0 },
      { face: "+", row: 0, col: 1 },
      { face: "2", row: 0, col: 2 },
      { face: "=", row: 0, col: 3 },
      { face: "3", row: 0, col: 4 },
    ]);
    const result = TurnManager.validatePlay(board, ps, true);
    expect(result.ok).toBe(false);
  });

  test("zero placements returns error", () => {
    const board = Board.create();
    const result = TurnManager.validatePlay(board, [], true);
    expect(result.ok).toBe(false);
  });
});

describe("TurnManager.validatePlay - subsequent moves", () => {
  test("valid connected play returns ok", () => {
    const board = Board.create();
    // existing: 1+2=3 in row 7, cols 5–9
    prePlaced(board, [
      { face: "1", row: 7, col: 5 },
      { face: "+", row: 7, col: 6 },
      { face: "2", row: 7, col: 7 },
      { face: "=", row: 7, col: 8 },
      { face: "3", row: 7, col: 9 },
    ]);
    // new tiles extending down from col 7: 2+1=3
    const ps = placeAndCollect(board, [
      { face: "+", row: 8, col: 7 },
      { face: "1", row: 9, col: 7 },
      { face: "=", row: 10, col: 7 },
      { face: "3", row: 11, col: 7 },
    ]);
    const result = TurnManager.validatePlay(board, ps, false);
    expect(result.ok).toBe(true);
  });

  test("non-linear placement returns error", () => {
    const board = Board.create();
    prePlaced(board, [{ face: "5", row: 7, col: 7 }]);
    const ps = placeAndCollect(board, [
      { face: "1", row: 6, col: 6 },
      { face: "+", row: 7, col: 8 },
    ]);
    const result = TurnManager.validatePlay(board, ps, false);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/linear|row or column/i);
    }
  });

  test("placement with gap returns error", () => {
    const board = Board.create();
    prePlaced(board, [{ face: "=", row: 7, col: 7 }]);
    // place tiles at col 5 and col 9 with col 6,7,8 potentially not filled
    const ps = placeAndCollect(board, [
      { face: "1", row: 7, col: 5 },
      { face: "3", row: 7, col: 9 },
    ]);
    // col 6 and col 8 empty → gap
    const result = TurnManager.validatePlay(board, ps, false);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/gap/i);
    }
  });

  test("disconnected placement returns error", () => {
    const board = Board.create();
    prePlaced(board, [{ face: "5", row: 7, col: 7 }]);
    const ps = placeAndCollect(board, [
      { face: "1", row: 0, col: 0 },
      { face: "+", row: 0, col: 1 },
      { face: "2", row: 0, col: 2 },
      { face: "=", row: 0, col: 3 },
      { face: "3", row: 0, col: 4 },
    ]);
    const result = TurnManager.validatePlay(board, ps, false);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/connect/i);
    }
  });

  test("mathematically false equation returns error", () => {
    const board = Board.create();
    prePlaced(board, [{ face: "5", row: 7, col: 5 }]);
    const ps = placeAndCollect(board, [
      { face: "+", row: 7, col: 6 },
      { face: "2", row: 7, col: 7 },
      { face: "=", row: 7, col: 8 },
      { face: "9", row: 7, col: 9 },
    ]);
    const result = TurnManager.validatePlay(board, ps, false);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/false/i);
    }
  });
});

describe("TurnManager.validateSwap", () => {
  test("swap allowed when bag has more than 5 tiles", () => {
    const bag = TileBag.create("seed");
    const result = TurnManager.validateSwap(bag);
    expect(result.ok).toBe(true);
  });

  test("swap not allowed when bag has 5 or fewer tiles", () => {
    const bag = TileBag.create("seed");
    // drain to ≤ 5
    while (bag.size > 5) bag.draw(1);
    const result = TurnManager.validateSwap(bag);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/cannot swap/i);
    }
  });
});

describe("TurnManager.validateAndScorePlay", () => {
  test("returns equations and score for a valid move", () => {
    const board = Board.create();
    const ps = placeAndCollect(board, [
      { face: "1", row: 7, col: 5 },
      { face: "+", row: 7, col: 6 },
      { face: "2", row: 7, col: 7 },
      { face: "=", row: 7, col: 8 },
      { face: "3", row: 7, col: 9 },
    ]);

    const result = TurnManager.validateAndScorePlay(board, ps, true);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.equations).toHaveLength(1);
      expect(result.score.total).toBeGreaterThan(0);
      expect(result.score.equationScores).toHaveLength(1);
    }
  });
});

describe("TurnManager.validatePlay - stress cases", () => {
  test("validates many first-move equations on fresh boards", () => {
    for (let n = 1; n <= 19; n++) {
      const board = Board.create();
      const ps = placeAndCollect(board, [
        { face: `${n}`, row: 7, col: 5 },
        { face: "+", row: 7, col: 6 },
        { face: "1", row: 7, col: 7 },
        { face: "=", row: 7, col: 8 },
        { face: `${n + 1}`, row: 7, col: 9 },
      ]);
      const result = TurnManager.validatePlay(board, ps, true);
      expect(result.ok).toBe(true);
    }
  });

  test("rejects many disconnected plays on fresh boards", () => {
    for (let i = 0; i < 40; i++) {
      const board = Board.create();
      prePlaced(board, [{ face: "5", row: 7, col: 7 }]);
      const ps = placeAndCollect(board, [
        { face: "1", row: 0, col: 0 },
        { face: "+", row: 0, col: 1 },
        { face: "1", row: 0, col: 2 },
        { face: "=", row: 0, col: 3 },
        { face: "2", row: 0, col: 4 },
      ]);
      const result = TurnManager.validatePlay(board, ps, false);
      expect(result.ok).toBe(false);
    }
  });
});
