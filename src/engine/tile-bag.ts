import type { Tile, TileConfig, BlankAssignment } from "@entities";
import { VALID_BLANK_ASSIGNMENTS, GAME_CONFIG, PLUS_MINUS_OPTIONS, MUL_DIV_OPTIONS, TILE_CONFIGS } from "@entities";
import { randomUUID } from "crypto";
import seedrandom from "seedrandom";

function createTile(config: TileConfig): Tile {
  return {
    id: randomUUID(),
    type: config.type,
    face: config.face,
    value: config.value,
  };
}

function shuffle<T>(array: T[], rng: seedrandom.PRNG): T[] {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

const VALID_BLANK_SET = new Set<string>(VALID_BLANK_ASSIGNMENTS);

function isValidBlankAssignment(v: string): v is BlankAssignment {
  return VALID_BLANK_SET.has(v);
}

const ASSIGNMENT_VALIDATORS: Partial<Record<string, readonly string[]>> = {
  "+/-": PLUS_MINUS_OPTIONS,
  "×/÷": MUL_DIV_OPTIONS,
};

export class TileBag {
  private stack: Tile[];

  private constructor(stack: Tile[]) {
    this.stack = stack;
  }

  static create(seed: number | string = Date.now()): TileBag {
    const tiles: Tile[] = [];
    for (const config of TILE_CONFIGS) {
      for (let i = 0; i < config.count; i++) {
        tiles.push(createTile(config));
      }
    }
    const rng = seedrandom(String(seed));
    const shuffled = shuffle(tiles, rng);
    return new TileBag(shuffled);
  }

  static fromTiles(tiles: Tile[]): TileBag {
    return new TileBag([...tiles]);
  }

  draw(count: number): Tile[] {
    if (count <= 0) return [];
    const actual = Math.min(count, this.stack.length);
    const drawn = this.stack.splice(-actual);
    return drawn;
  }

  push(...tiles: Tile[]): void {
    this.stack.push(...tiles);
  }

  shuffle(rng: seedrandom.PRNG): void {
    this.stack = shuffle(this.stack, rng);
  }

  swap(returnedTiles: Tile[], rng: seedrandom.PRNG): Tile[] {
    this.push(...returnedTiles);
    this.shuffle(rng);
    return this.draw(returnedTiles.length);
  }

  canSwap(): boolean {
    return this.stack.length > GAME_CONFIG.SWAP_BAG_MINIMUM;
  }

  get size(): number {
    return this.stack.length;
  }

  get isEmpty(): boolean {
    return this.stack.length === 0;
  }

  peekAll(): readonly Tile[] {
    return this.stack.map((t) => ({ ...t }));
  }

  filterByFace(face: string): readonly Tile[] {
    return this.stack.filter((t) => t.face === face).map((t) => ({ ...t }));
  }
}

export function getTotalTileCount(): number {
  return TILE_CONFIGS.reduce((sum, c) => sum + c.count, 0);
}

export function getTileConfigs(): readonly TileConfig[] {
  return TILE_CONFIGS;
}

export function assignTile(tile: Tile, assignment: BlankAssignment): Tile {
  if (tile.type === "blank") {
    if (!isValidBlankAssignment(assignment)) {
      throw new Error(`Invalid blank assignment: "${assignment}"`);
    }
    return { ...tile, assignedFace: assignment };
  }

  const allowed = ASSIGNMENT_VALIDATORS[tile.face];
  if (!allowed) {
    throw new Error(`Tile "${tile.face}" cannot be assigned`);
  }
  if (!allowed.includes(assignment)) {
    throw new Error(`"${tile.face}" cannot be assigned "${assignment}"`);
  }

  return { ...tile, assignedFace: assignment };
}
