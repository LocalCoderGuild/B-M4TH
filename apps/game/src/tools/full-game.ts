import {
  CLASSIC_MODE,
  type BoardCell,
  type GameState,
  type Placement,
  type Position,
  type Tile,
  type BlankAssignment,
  type Player,
} from "@entities";
import { Board } from "@engine/board";
import { GameEngine } from "@engine/game-engine";
import { TurnManager } from "@engine/turn-manager";
import { posKey } from "@engine/pos-key";
import { ALL_OPERATOR_FACES } from "@b-m4th/shared";

const PREMIUM_SYMBOL: Record<BoardCell["premium"], string> = {
  normal: ".",
  "2x_piece": "o",
  "3x_piece": "C",
  "2x_eq": "Y",
  "3x_eq": "R",
};

const ARITHMETIC_FACES = ALL_OPERATOR_FACES.filter(
  (f): f is "+" | "-" | "×" | "÷" => f !== "=",
);

interface ParsedArgs {
  seed: string;
  players: number;
  maxTurns: number;
  printBoard: boolean;
}

interface NumberOption {
  tileId: string;
  face: string;
  number: number;
  assignedFace?: BlankAssignment;
}

interface SymbolOption {
  tileId: string;
  face: string;
  assignedFace?: BlankAssignment;
}

interface CandidatePlayTile {
  tileId: string;
  assignedFace?: BlankAssignment;
}

interface MoveCandidate {
  tiles: CandidatePlayTile[];
  faces: string[];
}

interface ChosenMove {
  candidate: MoveCandidate;
  moves: Array<{ tileId: string; position: Position; assignedFace?: BlankAssignment }>;
  score: number;
}

interface Anchor {
  position: Position;
  face: string;
}

function parseArgs(argv: string[]): ParsedArgs {
  let seed = `seed-${Date.now()}`;
  let players = 2;
  let maxTurns = 300;
  let printBoard = true;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--seed" && argv[i + 1]) {
      seed = argv[i + 1]!;
      i++;
      continue;
    }
    if (arg === "--players" && argv[i + 1]) {
      players = Number(argv[i + 1]);
      i++;
      continue;
    }
    if (arg === "--max-turns" && argv[i + 1]) {
      maxTurns = Number(argv[i + 1]);
      i++;
      continue;
    }
    if (arg === "--no-board") {
      printBoard = false;
      continue;
    }
  }

  if (!Number.isInteger(players) || players < 2) {
    throw new Error("--players must be an integer >= 2");
  }
  if (!Number.isInteger(maxTurns) || maxTurns < 1) {
    throw new Error("--max-turns must be an integer >= 1");
  }

  return { seed, players, maxTurns, printBoard };
}

function faceOf(tile: Tile): string {
  return tile.assignedFace ?? tile.face;
}

function parseNumberFace(face: string): number | null {
  if (!/^\d+$/.test(face)) return null;
  return Number(face);
}

function evaluateBinary(a: number, b: number, op: string): number | null {
  if (op === "+") return a + b;
  if (op === "-") return a - b;
  if (op === "×") return a * b;
  if (op === "÷") {
    if (b === 0 || a % b !== 0) return null;
    return a / b;
  }
  return null;
}

function coversStartPosition(state: GameState, positions: Position[]): boolean {
  return positions.some(
    (p) => p.row === state.startPosition.row && p.col === state.startPosition.col,
  );
}

function isCellEmpty(board: BoardCell[][], pos: Position): boolean {
  return board[pos.row]?.[pos.col]?.tile === null;
}

function hasAdjacentExistingTile(board: BoardCell[][], positions: Position[]): boolean {
  const occupiedByMove = new Set(positions.map((p) => posKey(p.row, p.col)));
  for (const pos of positions) {
    const neighbors: Position[] = [
      { row: pos.row - 1, col: pos.col },
      { row: pos.row + 1, col: pos.col },
      { row: pos.row, col: pos.col - 1 },
      { row: pos.row, col: pos.col + 1 },
    ];
    for (const n of neighbors) {
      if (n.row < 0 || n.row >= CLASSIC_MODE.boardSize || n.col < 0 || n.col >= CLASSIC_MODE.boardSize) {
        continue;
      }
      const key = posKey(n.row, n.col);
      if (occupiedByMove.has(key)) continue;
      if (board[n.row]?.[n.col]?.tile !== null) {
        return true;
      }
    }
  }
  return false;
}

function buildBoardFromState(state: GameState): Board {
  const board = Board.create(CLASSIC_MODE.boardSize, state.startPosition, CLASSIC_MODE.premiumSquares);
  for (let row = 0; row < CLASSIC_MODE.boardSize; row++) {
    for (let col = 0; col < CLASSIC_MODE.boardSize; col++) {
      const cell = state.board[row]?.[col];
      if (cell?.tile) {
        board.placeTile({ row, col }, { ...cell.tile });
      }
    }
  }
  return board;
}

function makeNumberOptions(rack: Tile[]): NumberOption[] {
  const options: NumberOption[] = [];
  for (const tile of rack) {
    const face = faceOf(tile);
    const number = parseNumberFace(face);
    if (number !== null) {
      options.push({ tileId: tile.id, face, number });
      continue;
    }
    if (tile.face === "BLANK") {
      for (let n = 0; n <= 20; n++) {
        options.push({
          tileId: tile.id,
          face: String(n),
          number: n,
          assignedFace: String(n) as BlankAssignment,
        });
      }
    }
  }
  return options;
}

function makeOperatorOptions(rack: Tile[]): SymbolOption[] {
  const options: SymbolOption[] = [];
  for (const tile of rack) {
    const face = faceOf(tile);
    if (ARITHMETIC_FACES.includes(face as (typeof ARITHMETIC_FACES)[number])) {
      options.push({ tileId: tile.id, face });
      continue;
    }
    if (tile.face === "+/-") {
      options.push({ tileId: tile.id, face: "+", assignedFace: "+" });
      options.push({ tileId: tile.id, face: "-", assignedFace: "-" });
      continue;
    }
    if (tile.face === "×/÷") {
      options.push({ tileId: tile.id, face: "×", assignedFace: "×" });
      options.push({ tileId: tile.id, face: "÷", assignedFace: "÷" });
      continue;
    }
    if (tile.face === "BLANK") {
      for (const op of ARITHMETIC_FACES) {
        options.push({ tileId: tile.id, face: op, assignedFace: op });
      }
    }
  }
  return options;
}

function makeEqualsOptions(rack: Tile[]): SymbolOption[] {
  const options: SymbolOption[] = [];
  for (const tile of rack) {
    const face = faceOf(tile);
    if (face === "=") {
      options.push({ tileId: tile.id, face: "=" });
      continue;
    }
    if (tile.face === "BLANK") {
      options.push({ tileId: tile.id, face: "=", assignedFace: "=" });
    }
  }
  return options;
}

function buildMoveCandidates(rack: Tile[]): MoveCandidate[] {
  const numberOptions = makeNumberOptions(rack);
  const operatorOptions = makeOperatorOptions(rack);
  const equalsOptions = makeEqualsOptions(rack);
  const candidates: MoveCandidate[] = [];
  const seen = new Set<string>();

  const pushUnique = (tiles: CandidatePlayTile[], faces: string[]): void => {
    const key = tiles
      .map((t) => `${t.tileId}:${t.assignedFace ?? ""}`)
      .join("|");
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push({ tiles, faces });
  };

  for (const eq of equalsOptions) {
    for (let i = 0; i < numberOptions.length; i++) {
      for (let j = i + 1; j < numberOptions.length; j++) {
        const left = numberOptions[i]!;
        const right = numberOptions[j]!;
        if (left.tileId === right.tileId || left.number !== right.number) continue;
        pushUnique(
          [
            { tileId: left.tileId, assignedFace: left.assignedFace },
            { tileId: eq.tileId, assignedFace: eq.assignedFace },
            { tileId: right.tileId, assignedFace: right.assignedFace },
          ],
          [left.face, "=", right.face],
        );
      }
    }
  }

  for (const eq of equalsOptions) {
    for (const op of operatorOptions) {
      for (let i = 0; i < numberOptions.length; i++) {
        for (let j = 0; j < numberOptions.length; j++) {
          if (i === j) continue;
          const left = numberOptions[i]!;
          const right = numberOptions[j]!;
          const used = new Set([left.tileId, right.tileId, op.tileId, eq.tileId]);
          if (used.size < 4) continue;
          const result = evaluateBinary(left.number, right.number, op.face);
          if (result === null) continue;
          for (let k = 0; k < numberOptions.length; k++) {
            if (k === i || k === j) continue;
            const out = numberOptions[k]!;
            if (used.has(out.tileId) || out.number !== result) continue;
            pushUnique(
              [
                { tileId: left.tileId, assignedFace: left.assignedFace },
                { tileId: op.tileId, assignedFace: op.assignedFace },
                { tileId: right.tileId, assignedFace: right.assignedFace },
                { tileId: eq.tileId, assignedFace: eq.assignedFace },
                { tileId: out.tileId, assignedFace: out.assignedFace },
              ],
              [left.face, op.face, right.face, "=", out.face],
            );
          }
        }
      }
    }
  }

  candidates.sort((a, b) => b.tiles.length - a.tiles.length);
  return candidates;
}

function scoreMove(
  state: GameState,
  rackById: Map<string, Tile>,
  moves: Array<{ tileId: string; position: Position; assignedFace?: BlankAssignment }>,
): number | null {
  const board = buildBoardFromState(state);
  const placements: Placement[] = [];

  for (const move of moves) {
    const tile = rackById.get(move.tileId);
    if (!tile) return null;
    const placedTile: Tile = move.assignedFace
      ? { ...tile, assignedFace: move.assignedFace }
      : { ...tile };
    try {
      board.placeTile(move.position, placedTile);
    } catch (err) {
      console.warn(`placeTile failed at (${move.position.row},${move.position.col}):`, err);
      return null;
    }
    placements.push({ tile: placedTile, position: move.position });
  }

  const result = TurnManager.validateAndScorePlay(board, placements, state.isFirstMove, CLASSIC_MODE);
  if (!result.ok) return null;
  return result.score.total;
}

function listAnchors(state: GameState): Anchor[] {
  const anchors: Anchor[] = [];
  for (let row = 0; row < CLASSIC_MODE.boardSize; row++) {
    for (let col = 0; col < CLASSIC_MODE.boardSize; col++) {
      const tile = state.board[row]?.[col]?.tile;
      if (!tile) continue;
      anchors.push({
        position: { row, col },
        face: faceOf(tile),
      });
    }
  }
  return anchors;
}

function pickGreedyMove(engine: GameEngine, state: GameState): ChosenMove | null {
  const player = state.players.find((p) => p.id === state.currentPlayerId);
  if (!player) return null;

  const rackById = new Map(player.rack.map((t) => [t.id, t] as const));
  const candidates = buildMoveCandidates(player.rack);
  let best: ChosenMove | null = null;

  for (const candidate of candidates) {
    for (const dir of ["horizontal", "vertical"] as const) {
      const dr = dir === "horizontal" ? 0 : 1;
      const dc = dir === "horizontal" ? 1 : 0;
      const maxRow =
        dir === "horizontal"
          ? CLASSIC_MODE.boardSize - 1
          : CLASSIC_MODE.boardSize - candidate.tiles.length;
      const maxCol =
        dir === "horizontal"
          ? CLASSIC_MODE.boardSize - candidate.tiles.length
          : CLASSIC_MODE.boardSize - 1;

      for (let row = 0; row <= maxRow; row++) {
        for (let col = 0; col <= maxCol; col++) {
          const positions: Position[] = [];
          let canPlace = true;
          for (let idx = 0; idx < candidate.tiles.length; idx++) {
            const pos = { row: row + idx * dr, col: col + idx * dc };
            if (!isCellEmpty(state.board, pos)) {
              canPlace = false;
              break;
            }
            positions.push(pos);
          }
          if (!canPlace) continue;
          if (state.isFirstMove && !coversStartPosition(state, positions)) continue;
          if (!state.isFirstMove && !hasAdjacentExistingTile(state.board, positions)) continue;

          const moves = candidate.tiles.map((t, idx) => ({
            tileId: t.tileId,
            assignedFace: t.assignedFace,
            position: positions[idx]!,
          }));
          const score = scoreMove(state, rackById, moves);
          if (score === null) continue;

          if (
            !best ||
            score > best.score ||
            (score === best.score && candidate.tiles.length > best.candidate.tiles.length)
          ) {
            best = { candidate, moves, score };
          }
        }
      }
    }
  }

  // Prefer extending/bridging from existing tiles for denser boards.
  if (!state.isFirstMove) {
    const anchors = listAnchors(state);
    for (const anchor of anchors) {
      for (const candidate of candidates) {
        for (let anchorIdx = 0; anchorIdx < candidate.faces.length; anchorIdx++) {
          if (candidate.faces[anchorIdx] !== anchor.face) continue;

          for (const dir of ["horizontal", "vertical"] as const) {
            const dr = dir === "horizontal" ? 0 : 1;
            const dc = dir === "horizontal" ? 1 : 0;
            const moves: Array<{ tileId: string; position: Position; assignedFace?: BlankAssignment }> = [];
            let valid = true;

            for (let idx = 0; idx < candidate.tiles.length; idx++) {
              const offset = idx - anchorIdx;
              const pos = {
                row: anchor.position.row + offset * dr,
                col: anchor.position.col + offset * dc,
              };
              if (
                pos.row < 0 ||
                pos.row >= CLASSIC_MODE.boardSize ||
                pos.col < 0 ||
                pos.col >= CLASSIC_MODE.boardSize
              ) {
                valid = false;
                break;
              }

              if (idx === anchorIdx) {
                const existing = state.board[pos.row]?.[pos.col]?.tile;
                if (!existing || faceOf(existing) !== anchor.face) {
                  valid = false;
                }
                continue;
              }

              if (!isCellEmpty(state.board, pos)) {
                valid = false;
                break;
              }

              moves.push({
                tileId: candidate.tiles[idx]!.tileId,
                assignedFace: candidate.tiles[idx]!.assignedFace,
                position: pos,
              });
            }

            if (!valid || moves.length === 0) continue;
            const score = scoreMove(state, rackById, moves);
            if (score === null) continue;

            if (
              !best ||
              score > best.score ||
              (score === best.score && moves.length > best.moves.length)
            ) {
              best = { candidate, moves, score };
            }
          }
        }
      }
    }
  }

  if (!best) return null;
  const played = engine.play(best.moves);
  if (!played.ok) return null;
  return best;
}

function formatBoard(state: GameState): string {
  const headerCells = Array.from({ length: CLASSIC_MODE.boardSize }, (_, c) => c.toString().padStart(2, " "));
  const lines = [`    ${headerCells.join(" ")}`];

  for (let r = 0; r < CLASSIC_MODE.boardSize; r++) {
    const rowCells: string[] = [];
    for (let c = 0; c < CLASSIC_MODE.boardSize; c++) {
      const cell = state.board[r]?.[c];
      if (!cell) continue;
      if (cell.tile) {
        const face = faceOf(cell.tile);
        rowCells.push(face.padStart(2, " ").slice(-2));
        continue;
      }
      if (r === state.startPosition.row && c === state.startPosition.col) {
        rowCells.push(" ★");
        continue;
      }
      rowCells.push(` ${PREMIUM_SYMBOL[cell.premium]}`);
    }
    lines.push(`${r.toString().padStart(2, " ")} |${rowCells.join(" ")}`);
  }

  return lines.join("\n");
}

function formatScores(state: GameState): string {
  return state.players.map((p) => `${p.id}:${p.score}`).join(" | ");
}

function chooseSwapIds(rack: Tile[]): string[] {
  const unresolved = rack.filter((t) => {
    const f = faceOf(t);
    return f === "BLANK" || f === "+/-" || f === "×/÷";
  });
  if (unresolved.length > 0) {
    const rest = rack.filter((t) => !unresolved.some((u) => u.id === t.id));
    return [...unresolved, ...rest].slice(0, CLASSIC_MODE.rackSize).map((t) => t.id);
  }
  const sorted = [...rack].sort((a, b) => a.value - b.value);
  return sorted.slice(0, CLASSIC_MODE.rackSize).map((t) => t.id);
}

function countTiles(board: BoardCell[][]): number {
  let total = 0;
  for (const row of board) {
    for (const cell of row) {
      if (cell.tile) total++;
    }
  }
  return total;
}

function run(): void {
  const args = parseArgs(Bun.argv.slice(2));
  const playerIds = Array.from({ length: args.players }, (_, i) => `P${i + 1}`);
  const engine = GameEngine.create(playerIds, { seed: args.seed });

  console.log(`Full game simulation (greedy bot)`);
  console.log(`seed=${args.seed} | players=${args.players} | maxTurns=${args.maxTurns}`);

  let state = engine.getState();
  if (args.printBoard) console.log(formatBoard(state));
  console.log(`Scores: ${formatScores(state)} | tiles=${countTiles(state.board)} | bag=${state.tileBag.length}`);

  let turnCounter = 0;
  let stalledTurns = 0;

  while (state.phase === "playing" && turnCounter < args.maxTurns) {
    turnCounter++;
    const actorId = state.currentPlayerId;
    const beforeScore = state.players.find((p: Player) => p.id === actorId)?.score ?? 0;
    const greedy = pickGreedyMove(engine, state);
    let actionText = "";

    if (greedy) {
      const afterState = engine.getState();
      const afterScore = afterState.players.find((p: Player) => p.id === actorId)?.score ?? beforeScore;
      const delta = afterScore - beforeScore;
      actionText = `play ${greedy.candidate.faces.join(" ")} | +${delta}`;
      stalledTurns = delta > 0 ? 0 : stalledTurns + 1;
    } else {
      const player = state.players.find((p: Player) => p.id === actorId);
      const canSwap = state.tileBag.length > CLASSIC_MODE.swapBagMinimum && stalledTurns < 24;
      if (canSwap && player) {
        const swapIds = chooseSwapIds(player.rack);
        const swap = engine.swap(swapIds);
        if (swap.ok) {
          actionText = `swap ${swapIds.length} tile(s)`;
        } else {
          engine.pass();
          actionText = "pass";
        }
      } else {
        engine.pass();
        actionText = "pass";
      }
      stalledTurns++;
    }

    state = engine.getState();
    console.log(`\nTurn ${turnCounter} | ${actorId} -> ${actionText}`);
    if (args.printBoard) console.log(formatBoard(state));
    console.log(
      `Scores: ${formatScores(state)} | tiles=${countTiles(state.board)} | bag=${state.tileBag.length} | phase=${state.phase}`,
    );
  }

  if (state.phase !== "finished") {
    console.log(`\nStopped at max turns (${args.maxTurns}) before game finished.`);
  } else {
    console.log(`\nGame finished in ${turnCounter} turns.`);
  }

  const ranking = [...state.players].sort((a, b) => b.score - a.score);
  console.log("Final ranking:");
  for (let i = 0; i < ranking.length; i++) {
    const p = ranking[i]!;
    console.log(`${i + 1}. ${p.id} (${p.score})`);
  }
}

run();
