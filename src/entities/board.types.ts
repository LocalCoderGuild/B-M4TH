import type { Tile } from "./tile.types";

export interface Position {
  row: number;
  col: number;
}

export type PremiumType =
  | "normal"
  | "2x_piece"
  | "3x_piece"
  | "2x_eq"
  | "3x_eq";

export interface BoardCell {
  tile: Tile | null;
  premium: PremiumType;
}

export interface Placement {
  tile: Tile;
  position: Position;
}

export type PremiumEntry = readonly [row: number, col: number, premium: PremiumType];

export const PREMIUM_SQUARES: readonly PremiumEntry[] = [
  // 3x Equation (red)
  [0, 0, "3x_eq"],
  [0, 7, "3x_eq"],
  [0, 14, "3x_eq"],
  [7, 0, "3x_eq"],
  [7, 14, "3x_eq"],
  [14, 0, "3x_eq"],
  [14, 7, "3x_eq"],
  [14, 14, "3x_eq"],

  // 3x Piece (cyan)
  [1, 5, "3x_piece"],
  [1, 9, "3x_piece"],
  [4, 4, "3x_piece"],
  [4, 10, "3x_piece"],
  [5, 1, "3x_piece"],
  [5, 5, "3x_piece"],
  [5, 9, "3x_piece"],
  [5, 13, "3x_piece"],
  [9, 1, "3x_piece"],
  [9, 5, "3x_piece"],
  [9, 9, "3x_piece"],
  [9, 13, "3x_piece"],
  [10, 4, "3x_piece"],
  [10, 10, "3x_piece"],
  [13, 5, "3x_piece"],
  [13, 9, "3x_piece"],

  // 2x Equation (yellow)
  [1, 1, "2x_eq"],
  [1, 13, "2x_eq"],
  [2, 2, "2x_eq"],
  [2, 12, "2x_eq"],
  [3, 3, "2x_eq"],
  [3, 11, "2x_eq"],
  [11, 3, "2x_eq"],
  [11, 11, "2x_eq"],
  [12, 2, "2x_eq"],
  [12, 12, "2x_eq"],
  [13, 1, "2x_eq"],
  [13, 13, "2x_eq"],

  // 2x Piece (orange)
  [0, 3, "2x_piece"],
  [0, 11, "2x_piece"],
  [2, 6, "2x_piece"],
  [2, 8, "2x_piece"],
  [3, 0, "2x_piece"],
  [3, 7, "2x_piece"],
  [3, 14, "2x_piece"],
  [6, 2, "2x_piece"],
  [6, 6, "2x_piece"],
  [6, 8, "2x_piece"],
  [6, 12, "2x_piece"],
  [7, 3, "2x_piece"],
  [7, 11, "2x_piece"],
  [8, 2, "2x_piece"],
  [8, 6, "2x_piece"],
  [8, 8, "2x_piece"],
  [8, 12, "2x_piece"],
  [11, 0, "2x_piece"],
  [11, 7, "2x_piece"],
  [11, 14, "2x_piece"],
  [12, 6, "2x_piece"],
  [12, 8, "2x_piece"],
  [14, 3, "2x_piece"],
  [14, 11, "2x_piece"],
];
