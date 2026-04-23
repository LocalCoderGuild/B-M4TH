import type { BoardCell, Position } from "./board.types";
import type { Player } from "./player.types";
import type { Tile } from "./tile.types";

export type GamePhase = "waiting" | "playing" | "finished";
export type Direction = "horizontal" | "vertical";

export const GAME_CONFIG = {
  BOARD_SIZE: 15,
  RACK_SIZE: 8,
  SWAP_BAG_MINIMUM: 5,
  BINGO_BONUS: 40,
  TOTAL_BANK_TIME_SECONDS: 22 * 60,
  TURN_TIME_LIMIT_SECONDS: 10 * 60,
  OVERTIME_PENALTY_PER_MINUTE: 10,
  CONSECUTIVE_PASSES_LIMIT: 3,
  DEFAULT_START_POSITION: { row: 7, col: 7 },
} as const;

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
}
