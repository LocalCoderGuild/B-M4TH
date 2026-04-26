import type { Tile, Position, BoardCell, PremiumType, PremiumEntry } from "@entities";
import { CLASSIC_MODE } from "@entities";

const PREMIUM_SYMBOL: Record<PremiumType, string> = {
  normal: " . ",
  "2x_piece": " o ",
  "3x_piece": " C ",
  "2x_eq": " Y ",
  "3x_eq": " R ",
};

export class Board {
  private grid: BoardCell[][];
  private readonly _startPosition: Position;
  public readonly size: number;

  private constructor(grid: BoardCell[][], startPosition: Position, size: number) {
    this.grid = grid;
    this._startPosition = startPosition;
    this.size = size;
  }

  static create(
    size: number = CLASSIC_MODE.boardSize,
    startPosition: Position = CLASSIC_MODE.startPosition,
    premiumSquares: readonly PremiumEntry[] = CLASSIC_MODE.premiumSquares
  ): Board {
    const grid: BoardCell[][] = Array.from({ length: size }, () =>
      Array.from({ length: size }, () => ({
        tile: null,
        premium: "normal" as PremiumType,
      })),
    );
    for (const [row, col, premium] of premiumSquares) {
      if (row >= 0 && row < size && col >= 0 && col < size) {
        grid[row]![col]!.premium = premium;
      }
    }
    return new Board(grid, startPosition, size);
  }

  get startPosition(): Position {
    return { ...this._startPosition };
  }

  isInBounds(pos: Position): boolean {
    return (
      pos.row >= 0 &&
      pos.row < this.size &&
      pos.col >= 0 &&
      pos.col < this.size
    );
  }

  getCell(pos: Position): BoardCell {
    if (!this.isInBounds(pos)) {
      throw new RangeError(`Out of bounds: (${pos.row}, ${pos.col})`);
    }
    return this.grid[pos.row]![pos.col]!;
  }

  isOccupied(pos: Position): boolean {
    return this.getCell(pos).tile !== null;
  }

  placeTile(pos: Position, tile: Tile): void {
    const cell = this.getCell(pos);
    if (cell.tile !== null) {
      throw new Error(`Cell (${pos.row}, ${pos.col}) is already occupied`);
    }
    cell.tile = tile;
  }

  removeTile(pos: Position): Tile | null {
    const cell = this.getCell(pos);
    const tile = cell.tile;
    cell.tile = null;
    return tile;
  }

  getSnapshot(): BoardCell[][] {
    return this.grid.map((row) => row.map((cell) => ({ ...cell })));
  }

  toString(): string {
    const lines: string[] = [];
    for (let r = 0; r < this.size; r++) {
      const cells = this.grid[r]!.map((cell, c) => {
        if (cell.tile !== null) {
          return cell.tile.face.padEnd(3, " ").slice(0, 3);
        }
        if (r === this._startPosition.row && c === this._startPosition.col) return " ★ ";
        return PREMIUM_SYMBOL[cell.premium];
      });
      lines.push(cells.join(""));
    }
    return lines.join("\n");
  }
}
