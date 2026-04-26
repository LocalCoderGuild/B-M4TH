import { describe, expect, test } from "bun:test";
import { GameEngine } from "@engine/game-engine";
import { Board } from "@engine/board";
import { TileBag } from "@engine/tile-bag";
import type { Player } from "@entities";
import { makeTile } from "../helpers/make-tile";

describe("GameEngine.create", () => {
  test("initializes board, racks, and starting player", () => {
    const engine = GameEngine.create(["p1", "p2"], { seed: "engine-seed" });
    const state = engine.getState();

    expect(state.phase).toBe("playing");
    expect(state.players).toHaveLength(2);
    expect(state.players[0]!.rack).toHaveLength(8);
    expect(state.players[1]!.rack).toHaveLength(8);
    expect(state.currentPlayerId).toBe("p1");
    expect(state.turnNumber).toBe(1);
    expect(state.isFirstMove).toBe(true);
  });
});

describe("GameEngine full game ending - Trigger A (bag empty + empty rack)", () => {
  test("finishes game and applies opponent-rack x2 final adjustment", () => {
    const p1Rack = [
      makeTile("1", "p1-1"),
      makeTile("+", "p1-plus"),
      makeTile("1", "p1-2"),
      makeTile("=", "p1-eq"),
      makeTile("2", "p1-3"),
    ];
    const p2Rack = [makeTile("10", "p2-10"), makeTile("5", "p2-5")];
    const players: Player[] = [
      { id: "p1", rack: p1Rack, score: 0 },
      { id: "p2", rack: p2Rack, score: 0 },
    ];

    const engine = GameEngine.fromSetup({
      board: Board.create(),
      bag: TileBag.fromTiles([]),
      players,
      currentPlayerIndex: 0,
      phase: "playing",
      isFirstMove: true,
      turnNumber: 1,
    });

    const result = engine.play([
      { tileId: "p1-1", position: { row: 7, col: 5 } },
      { tileId: "p1-plus", position: { row: 7, col: 6 } },
      { tileId: "p1-2", position: { row: 7, col: 7 } },
      { tileId: "p1-eq", position: { row: 7, col: 8 } },
      { tileId: "p1-3", position: { row: 7, col: 9 } },
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.phase).toBe("finished");

    const state = engine.getState();
    expect(state.phase).toBe("finished");
    expect(state.turnNumber).toBe(2);

    const p1 = state.players.find((p) => p.id === "p1")!;
    const p2 = state.players.find((p) => p.id === "p2")!;

    // Turn score: 1 + 2 + 1 + 1 + 1 = 6
    // Endgame bonus: opponent rack (10=3,5=2) => (3+2)*2 = 10
    expect(p1.score).toBe(16);
    expect(p2.score).toBe(-10);
    expect(p1.rack).toHaveLength(0);
  });
});

describe("GameEngine full game ending - Trigger B (consecutive passes)", () => {
  test("finishes after N (=players.length) consecutive passes (2-player)", () => {
    const engine = GameEngine.create(["p1", "p2"], { seed: "pass-seed" });

    const r1 = engine.pass();
    expect(r1.ok).toBe(true);
    if (r1.ok) expect(r1.phase).toBe("playing");

    const r2 = engine.pass();
    expect(r2.ok).toBe(true);
    if (r2.ok) expect(r2.phase).toBe("finished");

    const state = engine.getState();
    expect(state.phase).toBe("finished");
    expect(state.consecutivePasses).toBe(2);
    expect(state.turnNumber).toBe(3);
  });

  test("finishes after N (=players.length) consecutive passes (3-player)", () => {
    const engine = GameEngine.create(["p1", "p2", "p3"], { seed: "pass-seed-3" });

    expect(engine.pass().ok).toBe(true);
    expect(engine.pass().ok).toBe(true);
    const r3 = engine.pass();
    expect(r3.ok).toBe(true);
    if (r3.ok) expect(r3.phase).toBe("finished");

    const state = engine.getState();
    expect(state.consecutivePasses).toBe(3);
  });

  test("explicit consecutivePassesLimit overrides default", () => {
    const engine = GameEngine.create(["p1", "p2"], {
      seed: "pass-seed",
      consecutivePassesLimit: 4,
    });
    expect(engine.pass().ok).toBe(true);
    expect(engine.pass().ok).toBe(true);
    expect(engine.pass().ok).toBe(true);
    const r4 = engine.pass();
    if (r4.ok) expect(r4.phase).toBe("finished");
    expect(engine.getState().consecutivePasses).toBe(4);
  });
});
