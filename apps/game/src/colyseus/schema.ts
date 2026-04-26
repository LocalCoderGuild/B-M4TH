import { ArraySchema, Schema, type } from "@colyseus/schema";
import {
  CLASSIC_MODE,
  MIN_PLAYERS,
  SCHEMA_DEFAULT_TIME_CONTROL,
} from "@entities";

export type PhaseEnum = "waiting" | "playing" | "finished";
export type SlotEnum = "host" | "player";

export class TileView extends Schema {
  @type("string") id: string = "";
  @type("string") face: string = "";
  @type("string") tileType: string = "";
  @type("number") value: number = 0;
  @type("string") assignedFace: string = "";
}

export class CellView extends Schema {
  @type(TileView) tile?: TileView;
  @type("string") premium: string = "normal";
}

export class PlayerView extends Schema {
  @type("string") sessionId: string = "";
  @type("string") name: string = "";
  @type("string") slot: string = "player";
  @type("number") seatIndex: number = 0;
  @type("number") score: number = 0;
  @type("number") rackCount: number = 0;
  @type("boolean") connected: boolean = false;
  @type("number") bankRemainingMs: number = 0;
  @type("number") turnElapsedMs: number = 0;
  @type("number") overtimePenalty: number = 0;
  @type("string") color: string = "";
}

export class LastMoveView extends Schema {
  @type("string") sessionId: string = "";
  @type("string") action: string = "";
  @type("number") scoreDelta: number = 0;
  @type("number") turnNumber: number = 0;
  @type(["number"]) placedIndices = new ArraySchema<number>();
}

export class MatchStateSchema extends Schema {
  @type("string") matchId: string = "";
  @type("string") phase: string = "waiting";
  @type("boolean") ready: boolean = false;
  @type("number") turnNumber: number = 0;
  @type("string") currentSessionId: string = "";
  @type("boolean") isFirstMove: boolean = true;
  @type("number") consecutivePasses: number = 0;
  @type("number") bagRemaining: number = 0;
  @type("number") boardSize: number = CLASSIC_MODE.boardSize;
  @type([CellView]) board = new ArraySchema<CellView>();
  @type([PlayerView]) players = new ArraySchema<PlayerView>();
  @type(LastMoveView) lastMove?: LastMoveView;
  @type("string") winnerSessionId: string = "";
  @type("number") serverTime: number = 0;
  @type("number") baseMinutes: number = SCHEMA_DEFAULT_TIME_CONTROL.baseMinutes;
  @type("number") incrementSeconds: number = SCHEMA_DEFAULT_TIME_CONTROL.incrementSeconds;
  @type("number") turnMinutes: number = SCHEMA_DEFAULT_TIME_CONTROL.turnMinutes;
  @type("boolean") started: boolean = false;
  @type("string") hostSessionId: string = "";
  @type("number") maxPlayers: number = MIN_PLAYERS;
  @type("number") minPlayers: number = MIN_PLAYERS;
}
