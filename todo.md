# Phase 1: Core Game Engine — Todo

## Step 1: Domain Types + TileBag + Tests ✅

- [x] Entity types: `Tile`, `TileConfig`, `Position`, `BoardCell`, `Placement`, `Player`, `GameState`
- [x] `TileBag` stack data structure with `draw()`, `push()`, `swap()`, `canSwap()`
- [x] Seeded RNG via `seedrandom` (deterministic shuffles)
- [x] `crypto.randomUUID()` for collision-free tile IDs
- [x] `assignTile()` for `BLANK`, `+/-`, `×/÷` with validation dispatch map
- [x] `getEffectiveFace()` helper
- [x] Barrel pattern (`src/entities/index.ts`) with path aliases (`@entities`, `@engine`)
- [x] 47 tests passing — distribution, draw, swap, determinism, encapsulation, assignment

## Step 2: Board (15x15 grid + premium squares) + Tests ✅

- [x] Define premium square layout (2x Piece, 3x Piece, 2x Eq, 3x Eq positions)
- [x] `Board` class — init 15x15 grid, place tile, remove tile, get cell, check connectivity
- [x] First-move center constraint via `MoveValidator.isConnected`
- [x] `startPosition` configurable on `Board.create()` for future random start support
- [x] `PREMIUM_SQUARES` + `PremiumEntry` promoted to `@entities`
- [x] Tests: grid size, premium counts, tile placement/removal, bounds, encapsulation, MoveValidator

## Step 3: Lexer (tokenizer for tile sequences) + Tests ✅

- [x] Tokenize tile face arrays into math tokens (numbers, operators, equals)
- [x] Adjacent number tiles concatenate (`"1"`, `"0"` → `10`; `"13"` → `13`)
- [x] Throws `LexError` for unresolved BLANK, combo tiles (`+/-`, `×/÷`), or unknown faces
- [x] Tests: single/multi-digit tiles, concatenation, all operators, error cases

## Step 4: Safe Evaluator (AST-based math, no eval) + Tests ✅

- [x] Recursive descent parser builds `NumNode | BinNode` AST (BODMAS/PEMDAS)
- [x] `evaluate(tokens)` splits on `=`, parses both sides, returns `lv === rv`
- [x] Integer-only division: throws `EvaluatorError` on remainder or divide-by-zero
- [x] Throws `EvaluatorError` for structural issues: no `=`, multiple `=`, empty sides, bad syntax
- [x] Tests: basic ops, BODMAS priority, concatenation, division rules, structural errors

## Step 5: Board Scanner (bidirectional raycasting) + Tests ✅

- [x] Detect direction of placed tiles (horizontal or vertical)
- [x] Raycast in both directions from each new tile to find complete line segments
- [x] Identify main equation + cross-equations formed by placements
- [x] Deduplication via `lineKey` prevents returning the same line twice
- [x] Tests: single tile, isolated tile, intersection (2 equations), multi-tile, cross-equation, deduplication

## Step 6: Turn Manager + Tests ✅

- [x] `MoveValidator.isLinear` — checks all tiles share a row or column
- [x] `MoveValidator.hasNoGaps` — checks every cell between placed tiles is occupied
- [x] `TurnManager.validatePlay` — linearity → gaps → connectivity → scanner → lex+evaluate each equation
- [x] `TurnManager.validateSwap` — delegates to `bag.canSwap()`
- [x] Tests: valid first/subsequent moves, non-linear, gap, disconnected, false equation, swap allowed/blocked

## Step 7: Scoring System + Tests ✅

- [x] Base score: sum tile values in equation
- [x] Premium Piece multipliers (2x Piece, 3x Piece) on newly placed tiles only
- [x] Premium Equation multipliers (2x Eq, 3x Eq) compound per equation
- [x] Cross-equation scoring (each perpendicular equation scored independently)
- [x] Bingo bonus (+40 when all 8 tiles played in one turn)
- [x] Tests: base score, each multiplier type, compound multipliers, bingo

## Step 8: Game State Manager + Tests ✅

- [x] `GameEngine` class — orchestrates full game lifecycle
- [x] Initialize: create board, tile bag, draw racks, assign player IDs
- [x] Turn flow: accept action → validate → apply → score → advance turn
- [x] Endgame: Trigger A (empty rack) and Trigger B (3 consecutive passes)
- [x] Final scoring adjustments (opponent tile values × 2)
- [ ] Chess clock integration hooks (time bank tracking)
- [x] Tests: full game simulation, endgame triggers, score adjustments

## Step 9: Colyseus Backend Scaffold + Tests ✅

- [x] Add `src/colyseus/` room/state/server placeholders
- [x] Keep engine rules authoritative on the server side
- [x] Add `tests/colyseus/` room smoke test
- [x] Document Colyseus backend role vs frontend client role

## Step 10: Frontend Scaffold (React + PixiJS) + Tests ✅

- [x] Add `apps/web/` workspace with Vite + React
- [x] Add PixiJS board canvas placeholder
- [x] Add React lobby/score/turn panels
- [x] Add `tests/web/` smoke test
- [x] Document recommended stack in `stacks.md`

## Step 11: Frontend Architecture + Migration Docs ✅

- [x] Add `docs/frontend-architecture.md`
- [x] Add `docs/colyseus-frontend-pipeline.md`
- [x] Keep server, renderer, and UI responsibilities separated
- [x] Define folder layout for `apps/web/`, `src/colyseus/`, `tests/web/`, and `tests/colyseus/`

## Step 12: Colyseus-to-Frontend Integration

- [ ] Connect `apps/web` to the Colyseus room
- [ ] Map room state into React HUD state
- [ ] Render live board state in PixiJS instead of placeholder graphics
- [ ] Add turn actions: play, swap, pass, reconnect
- [ ] Add gameplay sync tests for room join, state updates, and disconnect recovery
