import { describe, expect, test } from "bun:test";
import { Board } from "@engine/board";
import { TurnManager } from "@engine/turn-manager";
import { type Placement, CLASSIC_MODE } from "@entities";
import { makeTile } from "../helpers/make-tile";

let tileCounter = 0;

function play(
  board: Board,
  tiles: Array<{ face: string; row: number; col: number }>,
  isFirstMove: boolean,
): Placement[] {
  const ps: Placement[] = [];
  for (const { face, row, col } of tiles) {
    const tile = makeTile(face, `gp-${face}-${row}-${col}-${tileCounter++}`);
    board.placeTile({ row, col }, tile);
    ps.push({ tile, position: { row, col } });
  }
  return ps;
}

function printAdvancedBoard(
  board: Board,
  label: string,
  extras?: { equationCount?: number; totalScore?: number; bingoBonus?: number },
) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`[ADV] ${label}`);
  if (extras) {
    const eqText = extras.equationCount !== undefined ? `eq=${extras.equationCount}` : undefined;
    const scoreText = extras.totalScore !== undefined ? `score=${extras.totalScore}` : undefined;
    const bingoText = extras.bingoBonus !== undefined ? `bingo=${extras.bingoBonus}` : undefined;
    console.log([eqText, scoreText, bingoText].filter(Boolean).join(" | "));
  }
  console.log("-".repeat(60));
  console.log("     " + Array.from({ length: 15 }, (_, i) => String(i).padStart(2, " ") + " ").join(""));
  const lines = board.toString().split("\n");
  lines.forEach((line, r) => {
    console.log(String(r).padStart(2, " ") + " | " + line);
  });
  console.log("=".repeat(60));
}

describe("7-turn gameplay simulation with player scores", () => {
  const board = Board.create();
  let p1Score = 0;
  let p2Score = 0;
  const turnScores: number[] = [];

  test("Turn 1 — first move: 4 + 5 = 9 (horizontal, row 7, cols 5–9, covers center)", () => {
    //  row 7:  [5]4  [6]+  [7]5★  [8]=  [9]9
    const ps = play(board, [
      { face: "4", row: 7, col: 5 },
      { face: "+", row: 7, col: 6 },
      { face: "5", row: 7, col: 7 },
      { face: "=", row: 7, col: 8 },
      { face: "9", row: 7, col: 9 },
    ], true);

    const result = TurnManager.validateAndScorePlay(board, ps, true);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.equations).toHaveLength(1);
      expect(result.equations[0]!.faces).toEqual(["4", "+", "5", "=", "9"]);
      p1Score += result.score.total;
      turnScores.push(result.score.total);
    }
  });

  test("Turn 2 — vertical down from '5' at (7,7): 5 × 2 = 10", () => {
    //  col 7:  [7]5 (existing)  [8]×  [9]2  [10]=  [11]10
    const ps = play(board, [
      { face: "×", row: 8, col: 7 },
      { face: "2", row: 9, col: 7 },
      { face: "=", row: 10, col: 7 },
      { face: "10", row: 11, col: 7 },
    ], false);

    const result = TurnManager.validateAndScorePlay(board, ps, false);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.equations).toHaveLength(1);
      expect(result.equations[0]!.faces).toEqual(["5", "×", "2", "=", "10"]);
      p2Score += result.score.total;
      turnScores.push(result.score.total);
    }
  });

  test("Turn 3 — vertical down from '9' at (7,9): 9 - 3 = 6", () => {
    //  col 9:  [7]9 (existing)  [8]-  [9]3  [10]=  [11]6
    const ps = play(board, [
      { face: "-", row: 8, col: 9 },
      { face: "3", row: 9, col: 9 },
      { face: "=", row: 10, col: 9 },
      { face: "6", row: 11, col: 9 },
    ], false);

    const result = TurnManager.validateAndScorePlay(board, ps, false);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.equations).toHaveLength(1);
      expect(result.equations[0]!.faces).toEqual(["9", "-", "3", "=", "6"]);
      p1Score += result.score.total;
      turnScores.push(result.score.total);
    }
  });

  test("Turn 4 — horizontal in row 11 bridging '10' and '6': 10 + 6 = 16", () => {
    //  row 11:  [7]10 (existing)  [8]+  [9]6 (existing)  [10]=  [11]16
    //  new tiles placed: + at (11,8), = at (11,10), 16 at (11,11)
    const ps = play(board, [
      { face: "+", row: 11, col: 8 },
      { face: "=", row: 11, col: 10 },
      { face: "16", row: 11, col: 11 },
    ], false);

    const result = TurnManager.validateAndScorePlay(board, ps, false);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.equations).toHaveLength(1);
      expect(result.equations[0]!.faces).toEqual(["10", "+", "6", "=", "16"]);
      p2Score += result.score.total;
      turnScores.push(result.score.total);
    }
  });

  test("Turn 5 — vertical down from '4' at (7,5): 4 - 1 = 3", () => {
    //  col 5:  [7]4 (existing)  [8]-  [9]1  [10]=  [11]3
    const ps = play(board, [
      { face: "-", row: 8, col: 5 },
      { face: "1", row: 9, col: 5 },
      { face: "=", row: 10, col: 5 },
      { face: "3", row: 11, col: 5 },
    ], false);

    const result = TurnManager.validateAndScorePlay(board, ps, false);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.equations).toHaveLength(1);
      expect(result.equations[0]!.faces).toEqual(["4", "-", "1", "=", "3"]);
      p1Score += result.score.total;
      turnScores.push(result.score.total);
    }
  });

  test("Turn 6 — valid chain extension: 4 - 1 = 3 = 3", () => {
    // Extending col 5 creates the chain equation 4 - 1 = 3 = 3 (all segments equal 3)
    const ps = play(board, [
      { face: "=", row: 12, col: 5 },
      { face: "3", row: 13, col: 5 },
    ], false);

    const result = TurnManager.validateAndScorePlay(board, ps, false);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.equations).toHaveLength(1);
      expect(result.equations[0]!.faces).toEqual(["4", "-", "1", "=", "3", "=", "3"]);
      p2Score += result.score.total;
      turnScores.push(result.score.total);
    }
  });

  test("Turn 7 — extend down from '16' at (11,11): 16 = 16", () => {
    //  col 11: [11]16 (existing) [12]= [13]16
    const ps = play(board, [
      { face: "=", row: 12, col: 11 },
      { face: "16", row: 13, col: 11 },
    ], false);

    const result = TurnManager.validateAndScorePlay(board, ps, false);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.equations).toHaveLength(1);
      expect(result.equations[0]!.faces).toEqual(["16", "=", "16"]);
      p1Score += result.score.total;
      turnScores.push(result.score.total);
    }
  });

  test("score totals are accumulated correctly across players", () => {
    const total = turnScores.reduce((acc, n) => acc + n, 0);
    expect(turnScores).toHaveLength(7);
    expect(p1Score + p2Score).toBe(total);
    expect(p1Score).toBeGreaterThan(0);
    expect(p2Score).toBeGreaterThan(0);
  });
});

describe("gameplay scoring - invalid turn", () => {
  test("invalid move does not return score", () => {
    const board = Board.create();
    const ps = play(board, [
      { face: "1", row: 0, col: 0 },
      { face: "+", row: 0, col: 1 },
      { face: "2", row: 0, col: 2 },
      { face: "=", row: 0, col: 3 },
      { face: "3", row: 0, col: 4 },
    ], true);

    const result = TurnManager.validateAndScorePlay(board, ps, true);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/center/i);
    }
  });
});

describe("gameplay scoring - bingo", () => {
  test("first move bingo with 8 tiles awards +40 bonus", () => {
    const board = Board.create();
    // 10 + 20 = 30 (8 tiles via digit concatenation), covers center at (7,7)
    const ps = play(board, [
      { face: "1", row: 7, col: 3 },
      { face: "0", row: 7, col: 4 },
      { face: "+", row: 7, col: 5 },
      { face: "2", row: 7, col: 6 },
      { face: "0", row: 7, col: 7 },
      { face: "=", row: 7, col: 8 },
      { face: "3", row: 7, col: 9 },
      { face: "0", row: 7, col: 10 },
    ], true);

    const result = TurnManager.validateAndScorePlay(board, ps, true);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.equations).toHaveLength(1);
      expect(result.equations[0]!.faces).toEqual(["1", "0", "+", "2", "0", "=", "3", "0"]);
      expect(result.score.bingoBonus).toBe(40);
      expect(result.score.total).toBeGreaterThan(40);
    }
  });
});

describe("10-turn full-equation drill", () => {
  test("plays 10 valid full-equation turns and accumulates player scores", () => {
    const turns = [
      ["1", "+", "1", "=", "2"],
      ["2", "+", "3", "=", "5"],
      ["4", "-", "1", "=", "3"],
      ["2", "×", "3", "=", "6"],
      ["10", "÷", "2", "=", "5"],
      ["12", "÷", "3", "=", "4"],
      ["6", "+", "7", "=", "13"],
      ["20", "-", "8", "=", "12"],
      ["9", "+", "8", "=", "17"],
      ["14", "-", "6", "=", "8"],
    ] as const;

    let p1 = 0;
    let p2 = 0;

    for (let i = 0; i < turns.length; i++) {
      const board = Board.create();
      const faces = turns[i]!;
      const ps = play(
        board,
        faces.map((face, idx) => ({ face, row: 7, col: 5 + idx })),
        true,
      );
      const result = TurnManager.validateAndScorePlay(board, ps, true);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.equations).toHaveLength(1);
        expect(result.equations[0]!.faces).toEqual([...faces]);
        if (i % 2 === 0) p1 += result.score.total;
        else p2 += result.score.total;
      }
    }

    expect(p1).toBeGreaterThan(0);
    expect(p2).toBeGreaterThan(0);
  });
});

describe("advanced gameplay scenarios", () => {
  test("single turn forms main + cross equations and both are scored", () => {
    const board = Board.create();
    printAdvancedBoard(board, "Initial board — scenario 1");

    // Existing vertical stem: 2 = 2 at col 8 after placement.
    board.placeTile({ row: 6, col: 8 }, makeTile("2"));
    board.placeTile({ row: 8, col: 8 }, makeTile("2"));

    // Main horizontal equation: 1 + 1 = 2
    const ps = play(board, [
      { face: "1", row: 7, col: 5 },
      { face: "+", row: 7, col: 6 },
      { face: "1", row: 7, col: 7 },
      { face: "=", row: 7, col: 8 }, // intersects vertical line
      { face: "2", row: 7, col: 9 },
    ], false);

    const result = TurnManager.validateAndScorePlay(board, ps, false);
    if (result.ok) {
      printAdvancedBoard(board, "After move — scenario 1", {
        equationCount: result.equations.length,
        totalScore: result.score.total,
        bingoBonus: result.score.bingoBonus,
      });
    }
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.equations).toHaveLength(2);
      const asStrings = result.equations.map((eq) => eq.faces.join(" "));
      expect(asStrings).toContain("1 + 1 = 2");
      expect(asStrings).toContain("2 = 2");

      // Main score: 1+2+1+1+1 = 6, Cross score: 1+1+1 = 3
      const sorted = [...result.score.equationScores].sort((a, b) => a - b);
      expect(sorted).toEqual([3, 6]);
      expect(result.score.total).toBe(9);
    }
  });

  test("premium-heavy opening with custom start position applies compound multipliers", () => {
    const board = Board.create(CLASSIC_MODE.boardSize, { row: 0, col: 3 });
    printAdvancedBoard(board, "Initial board — scenario 2 (custom start)");

    // Row 0 has premium hotspots: col0=3x_eq, col3=2x_piece, col7=3x_eq.
    // Equation (8 tiles): 10 + 20 = 30
    const ps = play(board, [
      { face: "1", row: 0, col: 0 },
      { face: "0", row: 0, col: 1 },
      { face: "+", row: 0, col: 2 },
      { face: "2", row: 0, col: 3 },
      { face: "0", row: 0, col: 4 },
      { face: "=", row: 0, col: 5 },
      { face: "3", row: 0, col: 6 },
      { face: "0", row: 0, col: 7 },
    ], true);

    const result = TurnManager.validateAndScorePlay(board, ps, true);
    if (result.ok) {
      printAdvancedBoard(board, "After move — scenario 2", {
        equationCount: result.equations.length,
        totalScore: result.score.total,
        bingoBonus: result.score.bingoBonus,
      });
    }
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.equations).toHaveLength(1);
      expect(result.equations[0]!.faces).toEqual(["1", "0", "+", "2", "0", "=", "3", "0"]);

      const eq = result.score.equations[0]!;
      expect(eq.baseSum).toBe(10); // includes 2x_piece on tile "2" at (0,3)
      expect(eq.equationMultiplier).toBe(9); // 3x_eq at col0 and col7
      expect(eq.total).toBe(90);
      expect(result.score.bingoBonus).toBe(40);
      expect(result.score.total).toBe(130);
    }
  });
});

describe("default-start 10-turn bingo distribution", () => {
  test("player 1 has 5 bingos and player 2 has 3 bingos", () => {
    const turns: Array<{
      player: 1 | 2;
      faces: string[];
      expectsBingo: boolean;
    }> = [
      { player: 1, faces: ["1", "0", "+", "2", "0", "=", "3", "0"], expectsBingo: true }, // 10+20=30
      { player: 2, faces: ["2", "0", "-", "1", "0", "=", "1", "0"], expectsBingo: true }, // 20-10=10
      { player: 1, faces: ["1", "2", "+", "1", "8", "=", "3", "0"], expectsBingo: true }, // 12+18=30
      { player: 2, faces: ["1", "5", "+", "1", "5", "=", "3", "0"], expectsBingo: true }, // 15+15=30
      { player: 1, faces: ["1", "4", "+", "1", "6", "=", "3", "0"], expectsBingo: true }, // 14+16=30
      { player: 2, faces: ["1", "8", "+", "1", "2", "=", "3", "0"], expectsBingo: true }, // 18+12=30
      { player: 1, faces: ["1", "9", "+", "1", "1", "=", "3", "0"], expectsBingo: true }, // 19+11=30
      { player: 2, faces: ["4", "+", "5", "=", "9"], expectsBingo: false },
      { player: 1, faces: ["1", "7", "+", "1", "3", "=", "3", "0"], expectsBingo: true }, // 17+13=30
      { player: 2, faces: ["8", "-", "3", "=", "5"], expectsBingo: false },
    ];

    let p1Score = 0;
    let p2Score = 0;
    let p1Bingos = 0;
    let p2Bingos = 0;

    for (let i = 0; i < turns.length; i++) {
      const turn = turns[i]!;
      const board = Board.create(); // default start at (7,7)
      const startCol = turn.faces.length === 8 ? 3 : 5; // both ranges include col 7
      const ps = play(
        board,
        turn.faces.map((face, idx) => ({ face, row: 7, col: startCol + idx })),
        true,
      );

      const result = TurnManager.validateAndScorePlay(board, ps, true);
      expect(result.ok).toBe(true);
      if (!result.ok) continue;

      expect(result.equations).toHaveLength(1);
      expect(result.equations[0]!.faces).toEqual(turn.faces);
      expect(result.score.bingoBonus > 0).toBe(turn.expectsBingo);
      expect(result.score.bingoBonus).toBe(turn.expectsBingo ? 40 : 0);

      if (turn.player === 1) {
        p1Score += result.score.total;
        if (turn.expectsBingo) p1Bingos++;
      } else {
        p2Score += result.score.total;
        if (turn.expectsBingo) p2Bingos++;
      }
    }

    expect(p1Bingos).toBe(5);
    expect(p2Bingos).toBe(3);
    expect(p1Score).toBeGreaterThan(0);
    expect(p2Score).toBeGreaterThan(0);
  });
});
