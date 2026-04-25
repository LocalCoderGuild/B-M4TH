# Frontend Architecture

## Overview

The frontend should use `React + PixiJS + Colyseus`.

- `React` owns app shell UI.
- `PixiJS` owns the interactive board.
- `Colyseus` owns realtime game state.

This keeps rendering fast, UI maintainable, and multiplayer authoritative.

## Core Layers

### App Shell

Use `React` for:

- lobby and room join flow
- score panels and turn status
- settings, modals, and error states
- debug and replay controls

### Game Renderer

Use `PixiJS` for:

- board grid and premium cells
- tiles and drag/drop feedback
- animation for placement, scoring, and invalid moves
- responsive canvas scaling

### Multiplayer Layer

Use `Colyseus` for:

- room creation and join/leave
- authoritative turns and scores
- reconnect and spectator support
- client/server state sync

## State Flow

1. `Colyseus` updates the room state.
2. `React` reads high-level match state and renders UI.
3. `PixiJS` renders board state from a shared store or adapter.
4. User actions dispatch to `Colyseus`, never directly to local game logic.

## Suggested Directory Layout

- `apps/web/` for the client app.
- `apps/web/src/ui/` for React components.
- `apps/web/src/scene/` for PixiJS board scene code.
- `src/colyseus/` for room and schema code.
- `tests/web/` for smoke and interaction tests.
- `tests/colyseus/` for sync and lifecycle tests.

## Migration Plan

1. Build the Colyseus room and state schema first.
2. Add a thin adapter that maps room state to board view models.
3. Render the board in PixiJS with dummy state.
4. Connect React HUD and controls to real room events.
5. Add reconnect, timeout, and turn-validation tests.

## Rules

- Keep game rules in the engine or Colyseus server, not the UI.
- Do not store source-of-truth board state in React local state.
- Treat PixiJS as a renderer, not the game rules layer.
