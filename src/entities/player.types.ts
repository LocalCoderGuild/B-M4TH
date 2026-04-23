import type { Tile } from "./tile.types";

export type TurnAction = "play" | "swap" | "pass";

export interface Player {
  id: string;
  rack: Tile[];
  score: number;
}
