import type { Position, PremiumEntry } from "./board.types";
import type { TileConfig } from "./tile.types";
import { TILE_CONFIGS } from "./tile.types";
import { PREMIUM_SQUARES } from "./board.types";

export interface GameMode {
  id: string;
  boardSize: number;
  rackSize: number;
  bingoBonus: number;
  swapBagMinimum: number;
  startPosition: Position;
  tileConfigs: TileConfig[];
  premiumSquares: readonly PremiumEntry[];
}

export const CLASSIC_MODE: GameMode = {
  id: "classic",
  boardSize: 15,
  rackSize: 8,
  bingoBonus: 40,
  swapBagMinimum: 5,
  startPosition: { row: 7, col: 7 },
  tileConfigs: TILE_CONFIGS,
  premiumSquares: PREMIUM_SQUARES,
};
