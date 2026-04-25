import type { Position, Placement } from "@entities";
import { Board } from "./board";

const ORTHO_DIRS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
] as const;

export class MoveValidator {
  static isLinear(placements: Placement[]): boolean {
    if (placements.length <= 1) return true;
    const allSameRow = placements.every((p) => p.position.row === placements[0]!.position.row);
    const allSameCol = placements.every((p) => p.position.col === placements[0]!.position.col);
    return allSameRow || allSameCol;
  }

  static hasNoGaps(board: Board, placements: Placement[]): boolean {
    if (placements.length <= 1) return true;
    const allSameRow = placements.every((p) => p.position.row === placements[0]!.position.row);
    const sorted = [...placements].sort((a, b) =>
      allSameRow
        ? a.position.col - b.position.col
        : a.position.row - b.position.row,
    );
    const first = sorted[0]!;
    const last = sorted[sorted.length - 1]!;
    if (allSameRow) {
      for (let c = first.position.col + 1; c < last.position.col; c++) {
        if (!board.isOccupied({ row: first.position.row, col: c })) return false;
      }
    } else {
      for (let r = first.position.row + 1; r < last.position.row; r++) {
        if (!board.isOccupied({ row: r, col: first.position.col })) return false;
      }
    }
    return true;
  }

  static isConnected(board: Board, placements: Placement[], isFirstMove: boolean): boolean {
    if (placements.length === 0) return false;

    if (isFirstMove) {
      const { row, col } = board.startPosition;
      return placements.some((p) => p.position.row === row && p.position.col === col);
    }

    const placedKeys = new Set(
      placements.map((p) => `${p.position.row},${p.position.col}`),
    );

    return placements.some((p) =>
      ORTHO_DIRS.some(([dr, dc]) => {
        const neighbor: Position = {
          row: p.position.row + dr,
          col: p.position.col + dc,
        };
        return (
          !placedKeys.has(`${neighbor.row},${neighbor.col}`) &&
          board.isInBounds(neighbor) &&
          board.isOccupied(neighbor)
        );
      }),
    );
  }
}
