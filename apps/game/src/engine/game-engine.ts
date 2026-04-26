import type { BlankAssignment, GamePhase, GameState, Placement, Player, Position, Tile } from "@entities";
import { GAME_CONFIG } from "@entities";
import { Board } from "./board";
import { assignTile, TileBag } from "./tile-bag";
import { TurnManager, type PlayAndScoreResult } from "./turn-manager";
import seedrandom from "seedrandom";

export type GameActionResult =
  | {
      ok: true;
      phase: GamePhase;
      turnNumber: number;
      currentPlayerId: string;
      scoreDelta: number;
    }
  | {
      ok: false;
      error: string;
    };

export interface CreateGameOptions {
  seed?: number | string;
  startPosition?: Position;
  /** Pass-out threshold ("everyone passes once in a row"). Defaults to players.length. */
  consecutivePassesLimit?: number;
}

export interface GameEngineSetup {
  board?: Board;
  bag?: TileBag;
  players: Player[];
  currentPlayerIndex?: number;
  phase?: GamePhase;
  consecutivePasses?: number;
  turnNumber?: number;
  isFirstMove?: boolean;
  rngSeed?: number | string;
  consecutivePassesLimit?: number;
}

function cloneTile(tile: Tile): Tile {
  return { ...tile };
}

function clonePlayer(player: Player): Player {
  return {
    id: player.id,
    score: player.score,
    rack: player.rack.map(cloneTile),
  };
}

function scoreRack(rack: Tile[]): number {
  return rack.reduce((sum, tile) => sum + tile.value, 0);
}

export class GameEngine {
  private readonly board: Board;
  private readonly bag: TileBag;
  private readonly players: Player[];
  private currentPlayerIndex: number;
  private phase: GamePhase;
  private consecutivePasses: number;
  private turnNumber: number;
  private isFirstMove: boolean;
  private readonly swapRng: seedrandom.PRNG;
  private readonly consecutivePassesLimit: number;

  private constructor(setup: Required<GameEngineSetup>) {
    this.board = setup.board;
    this.bag = setup.bag;
    this.players = setup.players;
    this.currentPlayerIndex = setup.currentPlayerIndex;
    this.phase = setup.phase;
    this.consecutivePasses = setup.consecutivePasses;
    this.turnNumber = setup.turnNumber;
    this.isFirstMove = setup.isFirstMove;
    this.swapRng = seedrandom(String(setup.rngSeed));
    this.consecutivePassesLimit = setup.consecutivePassesLimit;
  }

  getConsecutivePassesLimit(): number {
    return this.consecutivePassesLimit;
  }

  static create(playerIds: string[], options: CreateGameOptions = {}): GameEngine {
    if (playerIds.length < 2) {
      throw new Error("Game requires at least 2 players");
    }
    const seed = options.seed ?? Date.now();
    const board = Board.create(options.startPosition ?? GAME_CONFIG.DEFAULT_START_POSITION);
    const bag = TileBag.create(seed);
    const players: Player[] = playerIds.map((id) => ({
      id,
      rack: bag.draw(GAME_CONFIG.RACK_SIZE),
      score: 0,
    }));
    return new GameEngine({
      board,
      bag,
      players,
      currentPlayerIndex: 0,
      phase: "playing",
      consecutivePasses: 0,
      turnNumber: 1,
      isFirstMove: true,
      rngSeed: seed,
      consecutivePassesLimit: options.consecutivePassesLimit ?? playerIds.length,
    });
  }

  static fromSetup(setup: GameEngineSetup): GameEngine {
    if (setup.players.length < 2) {
      throw new Error("Game requires at least 2 players");
    }
    return new GameEngine({
      board: setup.board ?? Board.create(),
      bag: setup.bag ?? TileBag.create("setup"),
      players: setup.players.map(clonePlayer),
      currentPlayerIndex: setup.currentPlayerIndex ?? 0,
      phase: setup.phase ?? "playing",
      consecutivePasses: setup.consecutivePasses ?? 0,
      turnNumber: setup.turnNumber ?? 1,
      isFirstMove: setup.isFirstMove ?? true,
      rngSeed: setup.rngSeed ?? "setup",
      consecutivePassesLimit: setup.consecutivePassesLimit ?? setup.players.length,
    });
  }

  getState(): GameState {
    return {
      board: this.board.getSnapshot(),
      tileBag: this.bag.peekAll().map(cloneTile),
      players: this.players.map(clonePlayer),
      currentPlayerId: this.players[this.currentPlayerIndex]!.id,
      phase: this.phase,
      consecutivePasses: this.consecutivePasses,
      turnNumber: this.turnNumber,
      isFirstMove: this.isFirstMove,
      startPosition: this.board.startPosition,
    };
  }

  private validateAndPreparePlay(
    moves: Array<{ tileId: string; position: Position; assignedFace?: BlankAssignment }>,
  ): { ok: true; placements: Placement[] } | { ok: false; error: string } {
    const player = this.players[this.currentPlayerIndex]!;
    const byId = new Map(player.rack.map((t) => [t.id, t] as const));
    const seen = new Set<string>();
    const placements: Placement[] = [];

    for (const move of moves) {
      if (seen.has(move.tileId)) {
        return { ok: false, error: `Duplicate tile id in move: ${move.tileId}` };
      }
      seen.add(move.tileId);
      const tile = byId.get(move.tileId);
      if (!tile) {
        return { ok: false, error: `Tile not in current player's rack: ${move.tileId}` };
      }
      placements.push({
        tile: move.assignedFace !== undefined ? assignTile(tile, move.assignedFace) : tile,
        position: move.position,
      });
    }

    const placed: Position[] = [];
    try {
      for (const p of placements) {
        this.board.placeTile(p.position, p.tile);
        placed.push(p.position);
      }
    } catch (e) {
      for (const pos of placed) this.board.removeTile(pos);
      return { ok: false, error: e instanceof Error ? e.message : "Failed to place tiles" };
    }

    return { ok: true, placements };
  }

  play(
    moves: Array<{ tileId: string; position: Position; assignedFace?: BlankAssignment }>,
  ): GameActionResult {
    if (this.phase !== "playing") {
      return { ok: false, error: "Game is not in playing phase" };
    }
    if (moves.length === 0) {
      return { ok: false, error: "No tiles selected for play" };
    }

    const prepared = this.validateAndPreparePlay(moves);
    if (!prepared.ok) return prepared;
    const { placements } = prepared;
    const player = this.players[this.currentPlayerIndex]!;

    const validated: PlayAndScoreResult = TurnManager.validateAndScorePlay(
      this.board,
      placements,
      this.isFirstMove,
    );

    if (!validated.ok) {
      for (const p of placements) {
        this.board.removeTile(p.position);
      }
      return { ok: false, error: validated.error };
    }

    // Remove played tiles from rack.
    const played = new Set(moves.map((m) => m.tileId));
    player.rack = player.rack.filter((t) => !played.has(t.id));
    player.score += validated.score.total;

    // Refill rack.
    const need = GAME_CONFIG.RACK_SIZE - player.rack.length;
    if (need > 0) {
      player.rack.push(...this.bag.draw(need));
    }

    this.consecutivePasses = 0;
    this.isFirstMove = false;

    if (this.bag.isEmpty && player.rack.length === 0) {
      this.finishByRackEmpty(player.id);
    } else {
      this.advanceTurn();
    }

    return {
      ok: true,
      phase: this.phase,
      turnNumber: this.turnNumber,
      currentPlayerId: this.players[this.currentPlayerIndex]!.id,
      scoreDelta: validated.score.total,
    };
  }

  /** Read-only: place tiles temporarily, validate + score, then revert. Returns the
   *  potential score for the given moves without committing any state change. */
  previewPlay(
    moves: Array<{ tileId: string; position: Position; assignedFace?: BlankAssignment }>,
  ): { ok: true; score: number } | { ok: false; error: string } {
    if (this.phase !== "playing") {
      return { ok: false, error: "Game is not in playing phase" };
    }
    if (moves.length === 0) {
      return { ok: true, score: 0 };
    }
    const prepared = this.validateAndPreparePlay(moves);
    if (!prepared.ok) return prepared;
    const { placements } = prepared;

    const result = TurnManager.validateAndScorePlay(this.board, placements, this.isFirstMove);
    for (const p of placements) this.board.removeTile(p.position);
    if (!result.ok) return { ok: false, error: result.error };
    return { ok: true, score: result.score.total };
  }

  swap(tileIds: string[]): GameActionResult {
    if (this.phase !== "playing") {
      return { ok: false, error: "Game is not in playing phase" };
    }
    if (tileIds.length === 0) {
      return { ok: false, error: "No tiles selected for swap" };
    }
    const swapValid = TurnManager.validateSwap(this.bag);
    if (!swapValid.ok) {
      return { ok: false, error: swapValid.error };
    }

    const player = this.players[this.currentPlayerIndex]!;
    const seen = new Set<string>();
    const returned: Tile[] = [];

    for (const tileId of tileIds) {
      if (seen.has(tileId)) {
        return { ok: false, error: `Duplicate tile id in swap: ${tileId}` };
      }
      seen.add(tileId);
      const tile = player.rack.find((t) => t.id === tileId);
      if (!tile) {
        return { ok: false, error: `Tile not in current player's rack: ${tileId}` };
      }
      returned.push(tile);
    }

    player.rack = player.rack.filter((t) => !seen.has(t.id));
    const drawn = this.bag.swap(returned, this.swapRng);
    player.rack.push(...drawn);

    this.consecutivePasses = 0;
    this.advanceTurn();

    return {
      ok: true,
      phase: this.phase,
      turnNumber: this.turnNumber,
      currentPlayerId: this.players[this.currentPlayerIndex]!.id,
      scoreDelta: 0,
    };
  }

  pass(): GameActionResult {
    if (this.phase !== "playing") {
      return { ok: false, error: "Game is not in playing phase" };
    }

    this.consecutivePasses++;
    if (this.consecutivePasses >= this.consecutivePassesLimit) {
      this.phase = "finished";
      this.turnNumber++;
      return {
        ok: true,
        phase: this.phase,
        turnNumber: this.turnNumber,
        currentPlayerId: this.players[this.currentPlayerIndex]!.id,
        scoreDelta: 0,
      };
    }

    this.advanceTurn();
    return {
      ok: true,
      phase: this.phase,
      turnNumber: this.turnNumber,
      currentPlayerId: this.players[this.currentPlayerIndex]!.id,
      scoreDelta: 0,
    };
  }

  private finishByRackEmpty(finisherId: string): void {
    const finisher = this.players.find((p) => p.id === finisherId)!;
    for (const p of this.players) {
      if (p.id === finisherId) continue;
      const penalty = scoreRack(p.rack) * 2;
      p.score -= penalty;
      finisher.score += penalty;
    }
    this.phase = "finished";
    this.turnNumber++;
  }

  private advanceTurn(): void {
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
    this.turnNumber++;
  }
}
