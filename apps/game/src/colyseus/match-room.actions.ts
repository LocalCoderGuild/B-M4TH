import type { Position, BlankAssignment } from "@entities";
import { posKey } from "@engine/pos-key";

export interface PlayMoveInput {
  tileId: string;
  position: Position;
  assignedFace?: BlankAssignment;
}

export interface PendingUpdateMoveInput {
  tileId: string;
  row: number;
  col: number;
  face: string;
  assignedFace?: BlankAssignment;
  value: number;
}

export function toEnginePlayMoves(moves: PlayMoveInput[]): Array<{
  tileId: string;
  position: Position;
  assignedFace?: BlankAssignment;
}> {
  return moves.map((m) => ({
    tileId: m.tileId,
    position: m.position,
    assignedFace: m.assignedFace,
  }));
}

export function findDuplicatePositionKey(
  moves: Array<{ position: Position }>,
): string | null {
  const seen = new Set<string>();
  for (const m of moves) {
    const key = posKey(m.position.row, m.position.col);
    if (seen.has(key)) return key;
    seen.add(key);
  }
  return null;
}

export function toOpponentPendingPlacements(moves: PendingUpdateMoveInput[]): Array<{
  row: number;
  col: number;
  face: string;
  assignedFace?: BlankAssignment;
  value: number;
}> {
  return moves.map((m) => ({
    row: m.row,
    col: m.col,
    face: m.face,
    assignedFace: m.assignedFace,
    value: m.value,
  }));
}

export function toPreviewPlayMoves(moves: PendingUpdateMoveInput[]): Array<{
  tileId: string;
  position: Position;
  assignedFace?: BlankAssignment;
}> {
  return moves.map((m) => ({
    tileId: m.tileId,
    position: { row: m.row, col: m.col },
    assignedFace: m.assignedFace,
  }));
}
