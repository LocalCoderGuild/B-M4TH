import type { BoardCell, Tile } from "@entities";
import { GAME_CONFIG } from "@entities";
import { CellView, TileView } from "./schema";

export function cellToView(cell: BoardCell): CellView {
  const view = new CellView();
  view.premium = cell.premium;
  if (cell.tile) {
    const tv = new TileView();
    tv.id = cell.tile.id;
    tv.face = cell.tile.face;
    tv.tileType = cell.tile.type;
    tv.value = cell.tile.value;
    tv.assignedFace = cell.tile.assignedFace ?? "";
    view.tile = tv;
  }
  return view;
}

export function previewPenalty(overageMs: number): number {
  if (overageMs <= 0) return 0;
  const minutesOver = Math.ceil(overageMs / 60_000);
  return minutesOver * GAME_CONFIG.OVERTIME_PENALTY_PER_MINUTE;
}

export function tilesToClient(rack: Tile[]): Array<{
  id: string;
  face: string;
  type: string;
  value: number;
  assignedFace: string | null;
}> {
  return rack.map((t) => ({
    id: t.id,
    face: t.face,
    type: t.type,
    value: t.value,
    assignedFace: t.assignedFace ?? null,
  }));
}
