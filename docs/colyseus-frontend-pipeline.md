# Colyseus Frontend Pipeline

This pipeline covers the path from Colyseus state updates to the player-facing UI.

## Recommended Stack

- `Colyseus` for realtime room sync.
- `React` for lobby, HUD, dialogs, and game shell.
- `PixiJS` for the board canvas and tile animation layer.

For this game, I recommend `React + PixiJS`, not React alone. The board needs frequent visual updates, premium-cell overlays, and animated tile placement; PixiJS handles that cleanly while React manages layout and controls.

## Pipeline Stages

1. `Server Contract Gate`
   - Verifies engine and gameplay tests stay green.
   - Confirms frontend code can consume a stable state contract.

2. `Room Sync Gate`
   - Validates Colyseus room/state modules.
   - Runs `tests/colyseus/` when the folder exists.

3. `Frontend Smoke Gate`
   - Boots the client app in `apps/web/` when present.
   - Runs smoke tests against the game shell and state hydration.

## Suggested Folder Layout

- `src/colyseus/`: room, schema, and server adapters.
- `apps/web/`: frontend client.
- `tests/colyseus/`: room and sync tests.
- `tests/web/`: client smoke and rendering tests.

## Local Commands

```bash
bun run ci
bun test tests/colyseus
```

When the frontend exists:

```bash
cd apps/web
bun test
```
