# B-M4TH Build Report

## Running the project (local dev)

Two processes: the **Colyseus game server** and the **Vite web client**. Run each in its own terminal.

### Terminal 1 — game server

From the repo root:

```bash
PUBLIC_BASE_URL=http://localhost:5173 \
CLIENT_ORIGIN=http://localhost:5173 \
bun run dev:server
```

- `PUBLIC_BASE_URL` — origin used when minting magic links (so the link lands on the Vite frontend, not the Colyseus port).
- `CLIENT_ORIGIN` — CORS allowlist.
- Server listens on **:2567** (HTTP + WebSocket on the same port).
- `--hot` reload is enabled; server restarts on source edits.

Health check: `curl http://localhost:2567/api/health` → `{"ok":true}`.

### Terminal 2 — web client

```bash
cd apps/web
bun run dev
```

Vite serves on **http://localhost:5173**.

### End-to-end playtest

1. Open http://localhost:5173 → enter your name → **Create new match**.
2. You get two magic links: **your link** and **opponent link**. Send the opponent link to the other player (copy button).
3. Open your own link (or click *Open my link now*). Enter your display name. You land in the match room and see “Waiting for the other player.”
4. Second player opens the opponent link, enters a name, and joins. Phase transitions to **playing**.
5. On your turn: drag tiles from the rack onto the board. Tap a pending tile to remove it. Click **Commit play** (or **Pass** / **Swap**). The server validates the move, scores it, refills your rack, and hands the turn over.

Reconnect: hard-refresh your tab during a match — the page auto-reconnects using the tab-scoped session token; if the grace window expired you’re sent home.

### Other useful scripts

| Command | What it does |
|---|---|
| `bun run ci` | Typecheck + all tests (290 tests across engine + server + e2e) |
| `bun run ci:engine` | Engine-only tests |
| `bun test tests/colyseus` | Server + E2E integration tests |
| `bun run game:full` | Greedy self-play terminal simulator (pure engine) |
| `bun run start:server` | Production server (no hot reload) |
| `cd apps/web && bun run build` | Production web bundle → `apps/web/dist/` |
| `cd apps/web && bun run preview` | Serve the built bundle locally |

### Production deployment sketch

- Build the web bundle: `cd apps/web && bun run build`. Serve `dist/` from any static host (the app uses `BrowserRouter`, so the host must fall back to `index.html` for unmatched routes).
- Run the server behind a TLS-terminating proxy. The Colyseus WS transport shares the HTTP listener, so one upgraded route is enough.
- Set env vars:
  - `PORT` (default 2567)
  - `PUBLIC_BASE_URL=https://your-frontend.example.com`
  - `CLIENT_ORIGIN=https://your-frontend.example.com`
  - Frontend build needs `VITE_SERVER_URL=https://your-api.example.com` at `vite build` time.

---

## What was built

Started from a repo with a solid **pure engine core** (`src/engine`, `src/entities`), a stub Colyseus folder, and an empty React/Pixi scaffold. Built the full playable multiplayer game on top in five runnable slices.

### Slice 1 — Server skeleton + invite store

- `src/colyseus/invite-store.ts` — crypto-random 32-byte magic-link tokens (base64url), 1h TTL, single-use via `consume()`, lazy expiry sweep.
- `src/colyseus/match-registry.ts` — tracks matches (matchId / seed / hostName / bound Colyseus roomId). Rooms aren't created until someone actually claims an invite, so abandoned matches don't leak Colyseus rooms.
- `src/colyseus/http.ts` — Express app, Zod-validated bodies, CORS-locked:
  - `POST /api/matches` — creates two invites + two magic links.
  - `GET /api/invites/:token` — preview (non-destructive), used by the InvitePage.
  - `POST /api/invites/:token/claim` — consumes invite → reserves a Colyseus seat → returns the reservation payload.
- `tests/colyseus/invite-store.test.ts` + `tests/colyseus/http.test.ts` — 14 tests.

### Slice 2 — Real Colyseus MatchRoom

- Installed `colyseus`, `@colyseus/schema`, `@colyseus/ws-transport`, `@colyseus/tools`, `express`, `cors`, `zod`, `@colyseus/testing`.
- `src/colyseus/schema.ts` — `MatchStateSchema` (board, players, lastMove, clock fields) with `@type` decorators. Required `experimentalDecorators: true` + `useDefineForClassFields: false` in root `tsconfig.json`.
- `src/colyseus/match-room.ts` — `Room<{ state: MatchStateSchema }>`:
  - `onAuth` validates `matchId`, `slot`, `name`.
  - `onJoin` binds sessionId to slot; when both slots filled, starts the engine.
  - `onLeave` allows reconnection within 30s (code ≠ 1000).
  - **Private rack is never in the shared schema** — it's pushed only to the owning client via `client.send("rack", …)` (simpler and safer than `@filter()` per advisor feedback).
  - Messages: `play`, `swap`, `pass`, `ready`, all Zod-validated + rate-limited 500 ms/client.
- `src/colyseus/server.ts` — bootstrap: Express + `WebSocketTransport` on one HTTP server; injects the invite store / match registry / provisioner into the room via `gameServer.define`.
- `tests/colyseus/match-room.test.ts` — 5 tests using `@colyseus/testing` (two-client join, private-rack isolation, auth rejections).

### Slice 3 — Engine wired + full frontend

- Frontend stack: **React 19 + Mantine v9 + PixiJS 8 + Zustand + react-router v7 + @colyseus/sdk v0.17**.
- Routed pages: `/` (Home), `/invite/:token` (Invite), `/room/:matchId` (Match).
- `apps/web/src/api/client.ts` — `createMatch`, `peekInvite`, `claimInvite` — reads `VITE_SERVER_URL`.
- `apps/web/src/net/colyseus.ts` — single-active-`Room` wrapper: projects schema state into Zustand, subscribes to `rack` / `error` messages, stashes `reconnectionToken` in **`sessionStorage`** (tab-scoped).
- `apps/web/src/store/match-store.ts` — Zustand store with `snapshot`, `rack`, `pending`, `drag`, `lastError`.
- `apps/web/src/scene/board-scene.ts` — PixiJS scene: 15×15 grid, premium-cell coloring (2x/3x piece & equation), placed tiles (solid), pending tiles (ghost), hover highlight. Responsive `ResizeObserver`. Draw optimization: board only repaints on `turnNumber` change, not on every 20 fps patch.
- `apps/web/src/scene/BoardCanvas.tsx` — React↔Pixi bridge. Global `pointerup` safety net resets drag state if the user releases outside a cell (pointer capture deliberately **not used** — it breaks Pixi event routing).
- `apps/web/src/ui/RackStrip.tsx` — player's rack with drag-to-place and swap mode.
- `apps/web/src/ui/TurnControls.tsx` — Commit / Clear / Pass. Pending placements are cleared by the state-change subscription when `turnNumber` advances, not on send — so rejected plays don't evaporate the user's work.
- `apps/web/src/ui/ScorePanel.tsx` — per-player name, score, bank-time progress bar with **live countdown** (`bankRemainingMs − turnElapsedMs`).
- `apps/web/src/ui/BlankAssignModal.tsx` — digit/operator picker triggered by a `CustomEvent` when a blank tile is dropped on the board.
- `apps/web/src/ui/InviteShare.tsx` — copy-to-clipboard magic links.
- `apps/web/src/pages/HomePage.tsx`, `InvitePage.tsx`, `MatchPage.tsx`.

### Slice 4 — Server-authoritative chess clock + Trigger-B endgame

- New fields: `turnStartedAt`, `clockTickHandle` in `MatchRoom`.
- `this.clock.setInterval(500, onClockTick)` updates `turnElapsedMs` and a live overtime-penalty preview on the current player's `PlayerView`.
- `settleTurn(outgoingSessionId)` fires on every successful action: deducts elapsed from bank (floor at 0), applies overtime penalty (`ceil(overage / 60 s) × 10`) to score. `allowed = min(turnLimit, bankBefore)`.
- **Clock keeps ticking during disconnect** — the natural bank ceiling prevents stall attacks.
- `applyTriggerBAdjustmentIfNeeded()` — engine emits `phase=finished` after 3 consecutive passes but doesn't apply the rack-value adjustment; the room does it (symmetric: each player's score += `2 × opponent.rack`).
- Added `tests/colyseus/match-room.test.ts` clock settlement test.

### Slice 5 — Reconnection, pointer-drop fix, polish

- Reconnect logic moved into `MatchPage.tsx` — it tries `tryReconnect()` on mount if no room is active; redirects home on failure. Reconnection token is purged on explicit Leave.
- Removed `setPointerCapture` bug caught by advisor review.
- Cleaned stub `tests/web/smoke.test.ts` into a real dependency-health check.
- Updated `CLAUDE.md` with the full architecture + dev workflow.
- Added `tests/colyseus/e2e.test.ts` — full-stack end-to-end test using the real `@colyseus/sdk` (had to swap from the older `colyseus.js` package — SDK for server v0.17 lives under `@colyseus/sdk`).

---

## Quality / security summary

- **Crypto-strong invite tokens** (32 bytes, base64url), 1h TTL, single-use.
- **Two-layer auth:** invite token is consumed server-side to mint a Colyseus seat reservation; reservation (not token) authenticates the WebSocket join. Token never crosses the WS boundary.
- **Zod validation** on every inbound message (`play` / `swap` / `pass`); position bounds enforced.
- **Per-client rate limit** (500 ms between actions).
- **Private rack** never in the shared schema — out-of-band `client.send("rack", …)` to the owner only.
- **CORS** locked to `CLIENT_ORIGIN`; magic links use the configured `PUBLIC_BASE_URL`.
- **Seeded RNG** per match (tile bag determinism for replayability / debugging).
- **Clock anti-stall:** server-authoritative, continues during disconnect; bank time is the ceiling.
- **Auto-dispose:** rooms are created lazily on first claim; Colyseus disposes when the last client leaves.
- **Deterministic tests:** 290 passing including a real-SDK end-to-end test.

## What was NOT verified

- **I never opened the app in a browser.** This environment has no browser. The UI interaction paths (drag-drop, blank-assign modal, two-tab magic-link flow) are built and typecheck + `vite build` succeed, but have not been exercised against a real DOM. Please manually smoke-test per the steps in [Running the project](#end-to-end-playtest).

---

## Test inventory

| File | Purpose |
|---|---|
| `tests/engine/**/*.test.ts` | 10 files, 267 tests — pure engine (board, lexer, evaluator, scorer, turn-manager, move-validator, tile-bag, game-engine, board-scanner, gameplay scenarios) |
| `tests/colyseus/invite-store.test.ts` | 7 tests — token minting, TTL, single-use, revoke, sweep |
| `tests/colyseus/http.test.ts` | 7 tests — `/api/matches`, `/api/invites/:token`, claim (single-use, room-sharing), health |
| `tests/colyseus/match-room.test.ts` | 6 tests — two-client join, auth rejections, private rack isolation, pass action, clock settlement |
| `tests/colyseus/e2e.test.ts` | 1 test — full HTTP + real `@colyseus/sdk` flow (claim → `consumeSeatReservation` → ready → pass) |
| `tests/web/smoke.test.ts` | 1 test — frontend dependency scaffold check |

**Total: 290 passing, 0 failing.**

---

## Open questions for you

1. **Deployment target?** If you want production-ready config (Dockerfile, nginx config, env handling for a real domain with TLS), I can add that — or is this dev-only for now?
2. **Browser verification.** I couldn't open a browser from here. Want to walk through a manual two-tab smoke test together? I can watch for errors if you paste the browser console output.
3. **Bundle size.** The Vite build ships an 860 kB (gzip 271 kB) main chunk — Pixi + Mantine dominate. Worth code-splitting Pixi out of the home/invite routes? (They don't need it.)
4. **Premium-square legend.** The board shows short labels (`2×P`, `3×E`, …) on premium cells. Want a legend/tooltip in the sidebar explaining them, or is that clear enough?
5. **Spectator / rejoin-by-link.** Currently the magic links are single-use per slot. If a player loses their browser tab entirely (not just a refresh), they can't rejoin. Want a longer-lived "rejoin this match" link as a follow-up?
