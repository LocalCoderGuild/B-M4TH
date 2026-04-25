# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

B-M4TH is a two-player math-equation board game (Scrabble-like, 15×15 grid) playable in the browser over a Colyseus-authoritative server, with magic-link invitations. Game rules (tile distribution, scoring order, endgame triggers, time control) are authoritative in `rules.md` — consult before changing engine behavior. The rack size, premium square layout, and timing constants live in `GAME_CONFIG` (`src/entities/game.types.ts`).

Runtime is **Bun**. TypeScript is `strict` with `noUncheckedIndexedAccess` and `experimentalDecorators` (required by `@colyseus/schema`).

## Commands

Root package:

- `bun test` — run all tests (`bun:test`).
- `bun test tests/engine/board.test.ts` — run a single test file.
- `bun run typecheck` — `bunx tsc --noEmit`.
- `bun run ci` — typecheck + all tests.
- `bun run ci:engine` — engine tests only.
- `bun run game:full` — greedy self-play simulator (`src/tools/full-game.ts`).
- `bun run dev:server` — start the Colyseus server with `--hot` reload (port 2567).
- `bun run start:server` — start the server without hot reload (production).

Web client (`apps/web/`):

- `cd apps/web && bun run dev` / `build` / `preview` / `typecheck`.

**Local two-process dev setup:**

```bash
# terminal 1 — server
PUBLIC_BASE_URL=http://localhost:5173 CLIENT_ORIGIN=http://localhost:5173 bun run dev:server

# terminal 2 — frontend
cd apps/web && bun run dev
```

`PUBLIC_BASE_URL` tells the server which origin to use when minting magic links (so they land back on the Vite dev server, not the Colyseus port). `CLIENT_ORIGIN` restricts CORS to that origin.

## Path aliases

Root `tsconfig.json`:

- `@entities`, `@entities/*` → `src/entities/*`
- `@engine`, `@engine/*` → `src/engine/*`

Engine/server imports must use these. `tests/**` is excluded from `tsc` include but Bun still runs them.

## Architecture

Three layers: **pure engine core** (`src/engine` + `src/entities`), **authoritative multiplayer server** (`src/colyseus`), and a **React/PixiJS client** (`apps/web`). Game rules live only in the engine — never in the UI.

### Engine (`src/engine/`)

Pipeline for a play action: `lexer` → `evaluator` (single `=`, BODMAS) → `board` + `board-scanner` (15×15, cross-equations) → `move-validator` (first move, interconnection) → `scorer` (per-tile × piece-premium, equation-premium, +40 Bingo) → `tile-bag` (seeded RNG) → `turn-manager` (pass counter, phase) → `game-engine` (top-level `play` / `swap` / `pass`, `GameActionResult`). The engine handles Trigger-A endgame (empty rack + empty bag) internally; Trigger-B (3 consecutive passes) sets `phase=finished` but the rack-value adjustment is applied by the server wrapper.

### Server (`src/colyseus/`)

- `invite-store.ts` — crypto-random 32-byte tokens (base64url), TTL 1h, single-use via `consume()`, lazy sweep.
- `match-registry.ts` — stores matchId/seed/hostName and the bound Colyseus roomId (lazy; only created on first claim to avoid leaking empty rooms).
- `http.ts` — Express app: `POST /api/matches` (creates two invites + links), `GET /api/invites/:token` (preview, non-destructive), `POST /api/invites/:token/claim` (consumes invite → reserves a Colyseus seat, returns reservation payload).
- `match-room.ts` — `Room<{ state: MatchStateSchema }>`, wraps `GameEngine`. Messages: `play` / `swap` / `pass` / `ready`, each Zod-validated + rate-limited (500ms/client). **Private racks are pushed via `client.send("rack", …)` only to the owning session** — never in the shared schema (avoids `@filter()` fragility). Turn clock is server-authoritative: bank deducted on settlement, overtime penalty (`ceil(overage/60s) × 10`) applied on turn transition. Clock keeps ticking while a player is disconnected — bank time is the natural ceiling on stall attacks. Trigger-B adjustment (each player's rack value × 2 added to the opponent's score) is applied in `applyTriggerBAdjustmentIfNeeded` when `consecutivePasses ≥ 3`.
- `schema.ts` — `@colyseus/schema` classes for the public state (board, players, lastMove, clock). `useDefineForClassFields: false` is required for `@type` decorators to work.
- `server.ts` — bootstrap: Express + `WebSocketTransport` on one HTTP server. Reads `PUBLIC_BASE_URL` / `CLIENT_ORIGIN` envs.

**Magic-link flow:** host `POST /api/matches` → server returns host+guest links → each player opens their link → client calls `/claim` with name → server consumes invite, calls `matchMaker.reserveSeatFor`, returns reservation → client `consumeSeatReservation` to join Colyseus. Reservations (not raw tokens) authenticate the WebSocket join, so the token never crosses the WS boundary.

### Client (`apps/web/`)

Three-layer split:

- **React** (`src/pages/`, `src/ui/`) — pages (Home, Invite, Match), rack, score panel, turn controls, blank-assignment modal. Mantine v9 for components.
- **PixiJS** (`src/scene/board-scene.ts`) — 15×15 grid, premium-cell coloring, placed tiles (solid) vs pending (ghost), hover highlight. Redraws only on `turnNumber` change (not on every 20 fps clock patch) for performance.
- **Colyseus client** (`src/net/colyseus.ts`) — single active `Room` ref, state projection into Zustand store, private rack stored out of the shared state. Reconnection token is stashed in **`localStorage`** (survives tab close). `MatchPage` calls `tryReconnect()` on mount if no room is active.

**Drag-drop bridge:** `useMatchStore.drag` is a shared DnD state. React rack sets `drag.tileId` on `pointerdown`; the Pixi scene reports hover cell via callbacks; on `pointerup` over a cell the store commits a `PendingPlacement`. The React rack uses `touch-action: none` and pointer capture to work on mobile. Blank tiles open a modal via a DOM `CustomEvent` (`b-m4th:assign-blank`) so the placement completes once an assigned face is chosen.

## Security / input-handling notes

- All inbound messages (`play` / `swap` / `pass`) are Zod-validated before reaching the engine. Position bounds (0..14), tile-id length caps, max-moves = rack size.
- Invite tokens are 32 bytes from `crypto.randomBytes`, base64url, TTL 1h, single-use.
- `@colyseus/schema` never carries private rack tiles; opponent rack state is only `rackCount`.
- CORS is locked to `CLIENT_ORIGIN` in production. The magic-link token is single-use — leaking it after claim gives no attacker capability.
- Rate limit: 500 ms between actions per client.
- Auto-dispose: Colyseus rooms disappear when the last client leaves (room is not created until the first `/claim`).

## Testing

- `tests/engine/` — pure engine unit tests (mirror module layout). Keep deterministic; seed any RNG.
- `tests/colyseus/` — invite-store unit tests, HTTP-route tests (spins up ephemeral Express on `127.0.0.1:0`), and `@colyseus/testing` integration tests for the `MatchRoom` (two clients join, private rack push, pass action, clock settlement).
- `tests/web/` — scaffold smoke check.

## Style

- kebab-case filenames (`tile-bag.ts`), PascalCase classes (`TileBag`), camelCase for everything else.
- Prefer small pure modules. Import via `@engine/*` / `@entities/*` aliases.
- Imperative, scoped commit messages (e.g. `engine: validate out-of-bounds placement`).
