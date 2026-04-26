import { ArraySchema } from "@colyseus/schema";
import type { TimeControl, GameMode } from "@entities";
import { CLASSIC_MODE } from "@entities";
import { CellView, MatchStateSchema, PlayerView } from "./schema";

export function createInitialMatchState(input: {
  matchId: string;
  timeControl: TimeControl;
  maxPlayers: number;
  minPlayers: number;
  nowMs: number;
  mode?: GameMode;
}): MatchStateSchema {
  const state = new MatchStateSchema();
  const mode = input.mode ?? CLASSIC_MODE;
  state.matchId = input.matchId;
  state.phase = "waiting";
  state.ready = false;
  state.boardSize = mode.boardSize;
  state.board = new ArraySchema<CellView>();
  state.players = new ArraySchema<PlayerView>();
  state.serverTime = input.nowMs;
  state.baseMinutes = input.timeControl.baseMinutes;
  state.incrementSeconds = input.timeControl.incrementSeconds;
  state.turnMinutes = input.timeControl.turnMinutes;
  state.started = false;
  state.maxPlayers = input.maxPlayers;
  state.minPlayers = input.minPlayers;
  return state;
}
