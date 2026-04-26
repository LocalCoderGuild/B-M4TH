import type { Position, Placement, Direction } from "@entities";
import { getEffectiveFace } from "@entities";
import { Board } from "./board";
import { posKey } from "./pos-key";

export interface ScannedEquation {
  faces: string[];
  positions: Position[];
}

const DIR_STEP: Record<Direction, { dr: number; dc: number }> = {
  horizontal: { dr: 0, dc: 1 },
  vertical: { dr: 1, dc: 0 },
};

function getLine(
  board: Board,
  pos: Position,
  dir: Direction,
): ScannedEquation | null {
  const { dr, dc } = DIR_STEP[dir];

  let r = pos.row;
  let c = pos.col;
  while (board.isInBounds({ row: r - dr, col: c - dc }) && board.isOccupied({ row: r - dr, col: c - dc })) {
    r -= dr;
    c -= dc;
  }

  const faces: string[] = [];
  const positions: Position[] = [];
  while (board.isInBounds({ row: r, col: c }) && board.isOccupied({ row: r, col: c })) {
    const cell = board.getCell({ row: r, col: c });
    faces.push(getEffectiveFace(cell.tile!));
    positions.push({ row: r, col: c });
    r += dr;
    c += dc;
  }

  return positions.length >= 2 ? { faces, positions } : null;
}

function lineKey(eq: ScannedEquation): string {
  return eq.positions.map((p) => posKey(p.row, p.col)).join("|");
}

export class BoardScanner {
  static scan(board: Board, placements: Placement[]): ScannedEquation[] {
    if (placements.length === 0) return [];

    const results: ScannedEquation[] = [];
    const seen = new Set<string>();

    const addLine = (line: ScannedEquation | null) => {
      if (!line) return;
      const key = lineKey(line);
      if (!seen.has(key)) {
        seen.add(key);
        results.push(line);
      }
    };

    const allSameRow = placements.every((p) => p.position.row === placements[0]!.position.row);
    const allSameCol = placements.every((p) => p.position.col === placements[0]!.position.col);

    if (placements.length === 1) {
      addLine(getLine(board, placements[0]!.position, "horizontal"));
      addLine(getLine(board, placements[0]!.position, "vertical"));
    } else if (allSameRow) {
      // scan main H line from any placed tile (all land on the same line)
      addLine(getLine(board, placements[0]!.position, "horizontal"));
      // cross V lines for each placed tile
      for (const p of placements) {
        addLine(getLine(board, p.position, "vertical"));
      }
    } else if (allSameCol) {
      addLine(getLine(board, placements[0]!.position, "vertical"));
      for (const p of placements) {
        addLine(getLine(board, p.position, "horizontal"));
      }
    }
    // non-linear placements → [] (turn manager handles the error)

    return results;
  }
}
