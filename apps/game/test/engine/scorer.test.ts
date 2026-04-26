import { describe, expect, test } from "bun:test";
import { Board } from "@engine/board";
import { BoardScanner } from "@engine/board-scanner";
import { Scorer } from "@engine/scorer";
import { PREMIUM_SQUARES } from "@entities";
import type { Placement, PremiumType } from "@entities";
import { makeTile } from "../helpers/make-tile";

function placeExisting(
  board: Board,
  tiles: Array<{ face: string; row: number; col: number }>,
) {
  for (const { face, row, col } of tiles) {
    board.placeTile({ row, col }, makeTile(face, `pre-${row}-${col}`));
  }
}

function placeNew(
  board: Board,
  tiles: Array<{ face: string; row: number; col: number }>,
): Placement[] {
  const placements: Placement[] = [];
  for (const { face, row, col } of tiles) {
    const tile = makeTile(face, `new-${row}-${col}`);
    board.placeTile({ row, col }, tile);
    placements.push({ tile, position: { row, col } });
  }
  return placements;
}

describe("Scorer.scoreTurn", () => {
  test("base score is sum of tile values with no multipliers", () => {
    const board = Board.create();
    const placements = placeNew(board, [
      { face: "4", row: 7, col: 5 },
      { face: "+", row: 7, col: 6 },
      { face: "5", row: 7, col: 7 },
      { face: "=", row: 7, col: 8 },
      { face: "9", row: 7, col: 9 },
    ]);
    const equations = BoardScanner.scan(board, placements);
    const score = Scorer.scoreTurn(board, placements, equations);
    expect(score.equationScores).toEqual([9]);
    expect(score.bingoBonus).toBe(0);
    expect(score.total).toBe(9);
  });

  test("piece multiplier applies only to newly placed tiles", () => {
    const board = Board.create();
    placeExisting(board, [{ face: "5", row: 7, col: 10 }]);
    const placements = placeNew(board, [{ face: "2", row: 7, col: 11 }]); // 2x_piece

    const equations = BoardScanner.scan(board, placements);
    const score = Scorer.scoreTurn(board, placements, equations);

    // 5(value 2) + 2(value 1 on 2x_piece => 2)
    expect(score.equationScores).toEqual([4]);
    expect(score.total).toBe(4);
  });

  test("equation multipliers compound for newly placed tiles", () => {
    const board = Board.create();
    const placements = placeNew(board, [
      { face: "1", row: 0, col: 0 }, // 3x_eq
      { face: "1", row: 0, col: 1 },
      { face: "1", row: 0, col: 2 },
      { face: "BLANK", row: 0, col: 3 }, // 2x_piece, value 0
      { face: "1", row: 0, col: 4 },
      { face: "1", row: 0, col: 5 },
      { face: "1", row: 0, col: 6 },
      { face: "1", row: 0, col: 7 }, // 3x_eq
    ]);

    const equations = BoardScanner.scan(board, placements);
    const score = Scorer.scoreTurn(board, placements, equations);

    // Base = 7, equation multiplier = 3 * 3 = 9, plus bingo (8 tiles) = 40
    expect(score.equationScores).toEqual([63]);
    expect(score.bingoBonus).toBe(40);
    expect(score.total).toBe(103);
  });

  test("cross equations are scored independently", () => {
    const board = Board.create();
    placeExisting(board, [
      { face: "4", row: 6, col: 7 },
      { face: "5", row: 8, col: 7 },
    ]);
    const placements = placeNew(board, [
      { face: "1", row: 7, col: 5 },
      { face: "+", row: 7, col: 6 },
      { face: "2", row: 7, col: 7 },
      { face: "=", row: 7, col: 8 },
      { face: "3", row: 7, col: 9 },
    ]);

    const equations = BoardScanner.scan(board, placements);
    const score = Scorer.scoreTurn(board, placements, equations);
    const sorted = [...score.equationScores].sort((a, b) => a - b);

    // Main row: 1+2+1+1+1 = 6
    // Cross col: 2+1+2 = 5
    expect(sorted).toEqual([5, 6]);
    expect(score.total).toBe(11);
  });

  test("bingo bonus adds +40 when all 8 rack tiles are placed", () => {
    const board = Board.create();
    const placements = placeNew(board, [
      { face: "BLANK", row: 7, col: 0 },
      { face: "BLANK", row: 7, col: 1 },
      { face: "BLANK", row: 7, col: 2 },
      { face: "BLANK", row: 7, col: 3 },
      { face: "BLANK", row: 7, col: 4 },
      { face: "BLANK", row: 7, col: 5 },
      { face: "BLANK", row: 7, col: 6 },
      { face: "BLANK", row: 7, col: 7 },
    ]);

    const equations = BoardScanner.scan(board, placements);
    const score = Scorer.scoreTurn(board, placements, equations);

    expect(score.equationScores).toEqual([0]);
    expect(score.bingoBonus).toBe(40);
    expect(score.total).toBe(40);
  });

  test("includes detailed breakdown for equation and tile contributions", () => {
    const board = Board.create();
    const placements = placeNew(board, [
      { face: "2", row: 7, col: 3 }, // 2x_piece
      { face: "+", row: 7, col: 4 },
    ]);
    placeExisting(board, [{ face: "1", row: 7, col: 5 }]);
    const equations = BoardScanner.scan(board, placements);
    const score = Scorer.scoreTurn(board, placements, equations);

    expect(score.equations).toHaveLength(1);
    const eq = score.equations[0]!;
    expect(eq.baseSum).toBe(5); // (1*2) + 2 + 1
    expect(eq.equationMultiplier).toBe(1);
    expect(eq.total).toBe(5);
    const premiumTile = eq.tiles.find((t) => t.position.row === 7 && t.position.col === 3)!;
    expect(premiumTile.premium).toBe("2x_piece");
    expect(premiumTile.pieceMultiplier).toBe(2);
    expect(premiumTile.contribution).toBe(2);
  });

  test("all premium cells apply correct multiplier behavior", () => {
    const premiumCells = PREMIUM_SQUARES.map(([row, col, premium]) => ({
      row,
      col,
      premium,
    }));

    const expectedScoreFor = (premium: PremiumType): number => {
      // Existing tile 5 has value 2 and new tile 2 has value 1.
      switch (premium) {
        case "2x_piece":
          return 2 + 1 * 2;
        case "3x_piece":
          return 2 + 1 * 3;
        case "2x_eq":
          return (2 + 1) * 2;
        case "3x_eq":
          return (2 + 1) * 3;
        case "normal":
          return 3;
      }
    };

    for (const cell of premiumCells) {
      const board = Board.create();
      const neighborCol = cell.col < 14 ? cell.col + 1 : cell.col - 1;

      placeExisting(board, [{ face: "5", row: cell.row, col: neighborCol }]);
      const placements = placeNew(board, [{ face: "2", row: cell.row, col: cell.col }]);

      const equations = BoardScanner.scan(board, placements);
      const score = Scorer.scoreTurn(board, placements, equations);
      const expected = expectedScoreFor(cell.premium);

      expect(score.equationScores).toEqual([expected]);
      expect(score.total).toBe(expected);
      expect(score.equations).toHaveLength(1);

      const detail = score.equations[0]!;
      const newTileDetail = detail.tiles.find(
        (t) => t.position.row === cell.row && t.position.col === cell.col,
      )!;

      if (cell.premium === "2x_piece") {
        expect(newTileDetail.pieceMultiplier).toBe(2);
        expect(detail.equationMultiplier).toBe(1);
      } else if (cell.premium === "3x_piece") {
        expect(newTileDetail.pieceMultiplier).toBe(3);
        expect(detail.equationMultiplier).toBe(1);
      } else if (cell.premium === "2x_eq") {
        expect(newTileDetail.pieceMultiplier).toBe(1);
        expect(detail.equationMultiplier).toBe(2);
      } else if (cell.premium === "3x_eq") {
        expect(newTileDetail.pieceMultiplier).toBe(1);
        expect(detail.equationMultiplier).toBe(3);
      }
    }
  });
});
