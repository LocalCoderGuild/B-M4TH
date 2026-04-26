export type TileType = "number" | "operator" | "blank";

export const VALID_BLANK_ASSIGNMENTS = [
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
  "13",
  "14",
  "15",
  "16",
  "17",
  "18",
  "19",
  "20",
  "+",
  "-",
  "×",
  "÷",
  "=",
] as const;

export type BlankAssignment = (typeof VALID_BLANK_ASSIGNMENTS)[number];

export interface TileConfig {
  type: TileType;
  face: string;
  value: number;
  count: number;
}

export interface Tile extends Omit<TileConfig, "count"> {
  id: string;
  assignedFace?: BlankAssignment;
}

export function getEffectiveFace(tile: Tile): string {
  return tile.assignedFace ?? tile.face;
}

export const PLUS_MINUS_OPTIONS = ["+", "-"] as const;
export const MUL_DIV_OPTIONS = ["×", "÷"] as const;

export const TILE_CONFIGS: TileConfig[] = [
  { face: "0", value: 1, count: 5, type: "number" },
  { face: "1", value: 1, count: 6, type: "number" },
  { face: "2", value: 1, count: 6, type: "number" },
  { face: "3", value: 1, count: 5, type: "number" },
  { face: "4", value: 2, count: 5, type: "number" },
  { face: "5", value: 2, count: 4, type: "number" },
  { face: "6", value: 2, count: 4, type: "number" },
  { face: "7", value: 2, count: 4, type: "number" },
  { face: "8", value: 2, count: 4, type: "number" },
  { face: "9", value: 2, count: 4, type: "number" },
  { face: "10", value: 3, count: 2, type: "number" },
  { face: "11", value: 4, count: 1, type: "number" },
  { face: "12", value: 3, count: 2, type: "number" },
  { face: "13", value: 6, count: 1, type: "number" },
  { face: "14", value: 4, count: 1, type: "number" },
  { face: "15", value: 4, count: 1, type: "number" },
  { face: "16", value: 4, count: 1, type: "number" },
  { face: "17", value: 6, count: 1, type: "number" },
  { face: "18", value: 4, count: 1, type: "number" },
  { face: "19", value: 7, count: 1, type: "number" },
  { face: "20", value: 5, count: 1, type: "number" },
  { face: "+", value: 2, count: 4, type: "operator" },
  { face: "-", value: 2, count: 4, type: "operator" },
  { face: "×", value: 2, count: 4, type: "operator" },
  { face: "÷", value: 2, count: 4, type: "operator" },
  { face: "+/-", value: 1, count: 5, type: "operator" },
  { face: "×/÷", value: 1, count: 4, type: "operator" },
  { face: "=", value: 1, count: 11, type: "operator" },
  { face: "BLANK", value: 0, count: 4, type: "blank" },
];
