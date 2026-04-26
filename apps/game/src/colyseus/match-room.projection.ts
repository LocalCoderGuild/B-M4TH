import { ArraySchema } from "@colyseus/schema";
import type { Position, GameState } from "@entities";
import { cellToView } from "./match-room.helpers";
import { LastMoveView, type MatchStateSchema, type PlayerView } from "./schema";

export interface SyncFromEngineContext {
  action: string;
  scoreDelta: number;
  placedPositions: Position[];
  actorSessionId?: string;
}

export function syncFromEngineSnapshot(params: {
  state: MatchStateSchema;
  snapshot: GameState;
  seats: ReadonlyMap<string, { penaltyScoreTotal: number }>;
  playerViewForSession: (sessionId: string) => PlayerView | undefined;
  ctx: SyncFromEngineContext;
  nowMs: number;
}): void {
  const { state, snapshot, seats, playerViewForSession, ctx, nowMs } = params;

  state.turnNumber = snapshot.turnNumber;
  state.currentSessionId = snapshot.currentPlayerId;
  state.phase = snapshot.phase;
  state.isFirstMove = snapshot.isFirstMove;
  state.consecutivePasses = snapshot.consecutivePasses;
  state.bagRemaining = snapshot.tileBag.length;
  state.serverTime = nowMs;

  state.board.clear();
  for (const row of snapshot.board) {
    for (const cell of row) state.board.push(cellToView(cell));
  }

  for (const enginePlayer of snapshot.players) {
    const view = playerViewForSession(enginePlayer.id);
    const seat = seats.get(enginePlayer.id);
    if (!view) continue;
    view.score = enginePlayer.score - (seat?.penaltyScoreTotal ?? 0);
    view.rackCount = enginePlayer.rack.length;
  }

  const lastMove = new LastMoveView();
  lastMove.sessionId = ctx.actorSessionId ?? state.currentSessionId;
  lastMove.action = ctx.action;
  lastMove.scoreDelta = ctx.scoreDelta;
  lastMove.turnNumber = snapshot.turnNumber;
  lastMove.placedIndices = new ArraySchema<number>(
    ...ctx.placedPositions.map((p) => p.row * state.boardSize + p.col),
  );
  state.lastMove = lastMove;
}
