import { GameEngine, type GameActionResult, type CreateGameOptions } from "@engine/game-engine";
import { MatchClock } from "./match-clock";
import type { TimeControl, BlankAssignment, Position } from "@entities";

export interface PlayMoveInput {
  tileId: string;
  position: Position;
  assignedFace?: BlankAssignment;
}

export class MatchSession {
  private engine: GameEngine | null = null;
  
  constructor(
    public readonly matchClock: MatchClock,
    private readonly seed: string
  ) {}

  getEngine(): GameEngine | null {
    return this.engine;
  }

  isStarted(): boolean {
    return this.engine !== null;
  }

  start(playerIds: string[], options?: Omit<CreateGameOptions, "seed">): void {
    this.engine = GameEngine.create(playerIds, {
      ...options,
      seed: this.seed,
      consecutivePassesLimit: playerIds.length,
    });
    this.matchClock.resetAllBanks();
  }

  startTurn(nowMs: number): void {
    this.matchClock.startTurn(nowMs);
  }

  tick(nowMs: number): void {
    if (!this.engine || this.engine.getState().phase !== "playing") return;
    this.matchClock.tick(this.engine.getState().currentPlayerId, nowMs);
  }

  private afterAction(result: GameActionResult, actorId: string, nowMs: number): GameActionResult {
    if (!result.ok) return result;
    
    this.matchClock.settleTurn(actorId, nowMs);

    if (result.phase === "finished") {
      this.matchClock.stopTurn();
    } else {
      this.matchClock.startTurn(nowMs);
    }
    
    return result;
  }

  play(actorId: string, moves: PlayMoveInput[], nowMs: number): GameActionResult {
    if (!this.engine) return { ok: false, error: "Game not started" };
    if (this.engine.getState().currentPlayerId !== actorId) {
      return { ok: false, error: "Not your turn" };
    }
    const result = this.engine.play(moves);
    return this.afterAction(result, actorId, nowMs);
  }

  swap(actorId: string, tileIds: string[], nowMs: number): GameActionResult {
    if (!this.engine) return { ok: false, error: "Game not started" };
    if (this.engine.getState().currentPlayerId !== actorId) {
      return { ok: false, error: "Not your turn" };
    }
    const result = this.engine.swap(tileIds);
    return this.afterAction(result, actorId, nowMs);
  }

  pass(actorId: string, nowMs: number): GameActionResult {
    if (!this.engine) return { ok: false, error: "Game not started" };
    if (this.engine.getState().currentPlayerId !== actorId) {
      return { ok: false, error: "Not your turn" };
    }
    const result = this.engine.pass();
    return this.afterAction(result, actorId, nowMs);
  }
}
