# Repository Guidelines

## Project Structure & Module Organization
Core game logic lives in `src/engine`, shared domain types and constants in `src/entities`, and Colyseus server code in `src/colyseus`. Utility scripts such as the terminal simulator live in `src/tools`. The frontend is isolated in `apps/web/src` with pages in `pages`, reusable UI in `ui`, scene rendering in `scene`, and network/state code in `net`, `api`, and `store`.

Tests mirror the runtime layout: `tests/engine`, `tests/colyseus`, and `tests/web`. Design and rollout notes live in `docs`, and CI workflows live in `.github/workflows`.

## Build, Test, and Development Commands
Use Bun for all local work.

- `rtk bun run dev:server`: run the Colyseus server with hot reload.
- `rtk bun run start:server`: start the server without hot reload.
- `rtk bun run game:full`: run the terminal full-game simulator.
- `rtk bun run typecheck`: run root TypeScript checks.
- `rtk bun test`: run the full backend and shared test suite.
- `rtk bun run ci`: run the root CI sequence (`typecheck` + `test`).
- `cd apps/web && rtk bun run dev`: start the Vite frontend.
- `cd apps/web && rtk bun run build`: build the frontend for production.

## Coding Style & Naming Conventions
This codebase is TypeScript-first with `strict` mode enabled. Follow the existing style: 2-space indentation, semicolons, double quotes, and trailing commas where they improve diffs. Use `PascalCase` for React components and classes, `camelCase` for functions and variables, and `kebab-case` for file names unless a React component file already uses `PascalCase`.

Prefer the configured path aliases such as `@engine` and `@entities` over deep relative imports.

## Testing Guidelines
Tests use Bun’s built-in runner (`bun:test`). Add tests beside the relevant area under `tests/...`, mirroring the source path and using `*.test.ts` naming. Cover engine rule changes with deterministic fixtures or seeded game setup, and add Colyseus or web smoke coverage when behavior crosses process boundaries.

## Commit & Pull Request Guidelines
Recent history follows Conventional Commit style, for example `feat(bot): ...`, `test(gameplay): ...`, and `ci: ...`. Keep that format and scope commits to one logical change.

PRs should include a short summary, test evidence (`rtk bun run ci`, targeted test commands, or web build output), and screenshots for `apps/web` UI changes. Call out protocol, schema, or API contract changes explicitly because they affect both server and client paths.

## Agent-Specific Notes
Repository automation expects shell commands to be prefixed with `rtk` for token-efficient execution.
