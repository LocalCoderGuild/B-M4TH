import { TILE_CONFIGS } from "@entities";
import type { Tile } from "@entities";

export function makeTile(face: string, id: string = face): Tile {
  const cfg = TILE_CONFIGS.find((t) => t.face === face);
  if (!cfg) throw new Error(`Unknown tile face: ${face}`);
  return { id, type: cfg.type, face: cfg.face, value: cfg.value };
}
