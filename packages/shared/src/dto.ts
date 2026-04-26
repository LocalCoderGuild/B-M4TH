export interface TileDto {
  id: string;
  face: string;
  type: string;
  value: number;
  assignedFace: string | null;
}

export interface BoardTileDto {
  id: string;
  face: string;
  assignedFace: string;
  value: number;
  tileType: string;
}

export interface BoardCellDto {
  index: number;
  row: number;
  col: number;
  premium: string;
  tile: BoardTileDto | null;
}

export interface PlayerDto {
  sessionId: string;
  name: string;
  slot: "host" | "player";
  seatIndex: number;
  score: number;
  rackCount: number;
  connected: boolean;
  bankRemainingMs: number;
  turnElapsedMs: number;
  overtimePenalty: number;
  color: string;
}

export interface LastMoveDto {
  sessionId: string;
  action: string;
  scoreDelta: number;
  turnNumber: number;
  placedIndices: number[];
}

export interface MatchStateDto {
  matchId: string;
  phase: "waiting" | "playing" | "finished";
  ready: boolean;
  turnNumber: number;
  currentSessionId: string;
  isFirstMove: boolean;
  consecutivePasses: number;
  bagRemaining: number;
  boardSize: number;
  board: BoardCellDto[];
  players: PlayerDto[];
  lastMove?: LastMoveDto;
  winnerSessionId: string;
  baseMinutes: number;
  incrementSeconds: number;
  turnMinutes: number;
  started: boolean;
  hostSessionId: string;
  maxPlayers: number;
  minPlayers: number;
}
