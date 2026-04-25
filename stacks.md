# Frontend Stack

## Recommended Stack

- `React` for the app shell, lobby, score panels, dialogs, and settings.
- `PixiJS` for the game board, tiles, drag/drop feedback, and animations.
- `Colyseus` for realtime multiplayer state, turn sync, reconnects, and spectators.

## Why This Stack

This game is a 2D board game with a heavy visual state layer and realtime multiplayer. `React` keeps the UI maintainable, while `PixiJS` handles fast canvas rendering better than React DOM alone. `Colyseus` fits the authoritative room/state model needed for multiplayer.

## Role Split

- `React`: lobby, match flow, player list, score view, modals, debug panels.
- `PixiJS`: board grid, premium cells, tile rendering, hover states, move animation.
- `Colyseus`: room lifecycle, player state, turn updates, reconnect handling.

## Suggested Layout

- `apps/web/` for the client app.
- `src/colyseus/` for server room and state adapters.
- `tests/web/` for client smoke and rendering tests.
- `tests/colyseus/` for sync and reconnect tests.

## Avoid

- Do not build the board in React DOM only.
- Do not use a full physics game engine unless the game scope grows beyond a board game.
- Do not split UI and rendering into unrelated libraries without a clear ownership model.
