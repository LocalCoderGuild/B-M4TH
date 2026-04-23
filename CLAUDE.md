# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads .env, so don't use dotenv.

## Commands

```sh
bun test                          # run all tests
bun test tests/engine/tile-bag    # run a single test file
bun test --watch                  # run tests in watch mode
```

## APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

## Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

## Frontend

Use HTML imports with `Bun.serve()`. Don't use `vite`. HTML imports fully support React, CSS, Tailwind.

Server:

```ts#index.ts
import index from "./index.html"

Bun.serve({
  routes: {
    "/": index,
    "/api/users/:id": {
      GET: (req) => {
        return new Response(JSON.stringify({ id: req.params.id }));
      },
    },
  },
  // optional websocket support
  websocket: {
    open: (ws) => {
      ws.send("Hello, world!");
    },
    message: (ws, message) => {
      ws.send(message);
    },
    close: (ws) => {
      // handle close
    }
  },
  development: {
    hmr: true,
    console: true,
  }
})
```

HTML files can import .tsx, .jsx or .js files directly and Bun's bundler will transpile & bundle automatically. `<link>` tags can point to stylesheets and Bun's CSS bundler will bundle.

```html#index.html
<html>
  <body>
    <h1>Hello, world!</h1>
    <script type="module" src="./frontend.tsx"></script>
  </body>
</html>
```

With the following `frontend.tsx`:

```tsx#frontend.tsx
import React from "react";
import { createRoot } from "react-dom/client";

// import .css files directly and it works
import './index.css';

const root = createRoot(document.body);

export default function Frontend() {
  return <h1>Hello, world!</h1>;
}

root.render(<Frontend />);
```

Then, run index.ts

```sh
bun --hot ./index.ts
```

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.mdx`.

## Project: "Project Equation" — A-Math Style Board Game

A server-authoritative, real-time multiplayer math board game (15×15 grid). Currently in **Phase 1: Core Game Engine** (pure TypeScript, no server or UI yet). See `plan.md` for the full 5-phase roadmap and `todo.md` for the current step checklist.

### Architecture

The engine is built as isolated, framework-agnostic TypeScript modules:

- **`src/entities/`** — Domain types and pure data (`Tile`, `Board`, `Player`, `GameState`). All exported via barrel at `src/entities/index.ts`.
- **`src/engine/`** — Stateful logic classes (`TileBag`, and future: `Board`, `TurnManager`, `Lexer`, `Evaluator`, `Scorer`, `GameEngine`).
- **`tests/`** mirrors `src/` structure (e.g. `tests/engine/tile-bag.test.ts`).

### Path Aliases

Configured in `tsconfig.json`:
- `@entities` → `src/entities`
- `@engine` → `src/engine`

### Key Domain Rules

- Tiles: 100-tile bag — digits (0–20), operators (`+`, `-`, `×`, `÷`, `=`), combo tiles (`+/-`, `×/÷`), and 4 BLANKs.
- BLANK tiles and combo tiles (`+/-`, `×/÷`) require assignment via `assignTile()` before use.
- `getEffectiveFace(tile)` returns `assignedFace ?? face` — always use this when reading a tile's value.
- `TileBag.create(seed)` uses `seedrandom` for deterministic shuffles; `canSwap()` requires >5 tiles in bag.
- `GAME_CONFIG` (in `game.types.ts`) holds all numeric constants: board size (15), rack size (8), bingo bonus (+40), time limits, etc.
- Scoring: tile base values + 2×/3× piece multipliers on newly placed tiles + 2×/3× equation multipliers (compounding) + Bingo (+40 for playing all 8 tiles). Premium squares only count on the turn first placed.
- Endgame: Trigger A (empty bag + empty rack) or Trigger B (3 consecutive passes). Opponent's remaining tiles × 2 are awarded to the finishing player.
