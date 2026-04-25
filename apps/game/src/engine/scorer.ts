import type { Placement, PremiumType, Position } from "@entities";
import { GAME_CONFIG } from "@entities";
import type { ScannedEquation } from "./board-scanner";
import { Board } from "./board";

export interface TileScoreDetail {
  position: Position;
  face: string;
  value: number;
  premium: PremiumType;
  isNewTile: boolean;
  pieceMultiplier: number;
  contribution: number;
}

export interface EquationScoreDetail {
  positions: Position[];
  faces: string[];
  baseSum: number;
  equationMultiplier: number;
  total: number;
  tiles: TileScoreDetail[];
}

export interface TurnScoreBreakdown {
  total: number;
  equationScores: number[];
  bingoBonus: number;
  equations: EquationScoreDetail[];
}

function posKey(row: number, col: number): string {
  return `${row},${col}`;
}

export class Scorer {
  static scoreTurn(
    board: Board,
    placements: Placement[],
    equations: ScannedEquation[],
  ): TurnScoreBreakdown {
    const placed = new Set(
      placements.map((p) => posKey(p.position.row, p.position.col)),
    );

    const equationDetails = equations.map((eq) => {
      let baseSum = 0;
      let equationMultiplier = 1;
      const tiles: TileScoreDetail[] = [];

      for (const pos of eq.positions) {
        const cell = board.getCell(pos);
        if (!cell.tile) {
          throw new Error(`Missing tile at (${pos.row}, ${pos.col}) while scoring`);
        }

        const isNewTile = placed.has(posKey(pos.row, pos.col));
        let pieceMultiplier = 1;

        if (isNewTile) {
          if (cell.premium === "2x_piece") pieceMultiplier = 2;
          else if (cell.premium === "3x_piece") pieceMultiplier = 3;

          if (cell.premium === "2x_eq") equationMultiplier *= 2;
          else if (cell.premium === "3x_eq") equationMultiplier *= 3;
        }

        const contribution = cell.tile.value * pieceMultiplier;
        baseSum += contribution;
        tiles.push({
          position: { row: pos.row, col: pos.col },
          face: cell.tile.face,
          value: cell.tile.value,
          premium: cell.premium,
          isNewTile,
          pieceMultiplier,
          contribution,
        });
      }

      return {
        positions: eq.positions.map((p) => ({ row: p.row, col: p.col })),
        faces: [...eq.faces],
        baseSum,
        equationMultiplier,
        total: baseSum * equationMultiplier,
        tiles,
      };
    });
    const equationScores = equationDetails.map((d) => d.total);

    const bingoBonus =
      placements.length === GAME_CONFIG.RACK_SIZE ? GAME_CONFIG.BINGO_BONUS : 0;
    const total =
      equationScores.reduce((acc, score) => acc + score, 0) + bingoBonus;

    return { total, equationScores, bingoBonus, equations: equationDetails };
  }
}
