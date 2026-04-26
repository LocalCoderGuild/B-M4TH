import type { BoardCell, Position } from "./board.types";
import type { Player } from "./player.types";
import type { Tile } from "./tile.types";

export type GamePhase = "waiting" | "playing" | "finished";
export type Direction = "horizontal" | "vertical";

export interface GameState {
  board: BoardCell[][];
  tileBag: Tile[];
  players: Player[];
  currentPlayerId: string;
  phase: GamePhase;
  consecutivePasses: number;
  turnNumber: number;
  isFirstMove: boolean;
  startPosition: Position;
  mode: string;
}
