# Repository Guidelines

## Project Structure & Module Organization
This repository is in Phase 1 (core engine only) for a math board game.

- `src/entities/`: domain types and constants (`Tile`, `Player`, `GameState`, `GAME_CONFIG`).
- `src/engine/`: engine logic (`board`, `tile-bag`, `lexer`, `evaluator`, `turn-manager`, `move-validator`).
- `tests/engine/`: Bun test suites mirroring engine modules (`*.test.ts`).
- Root docs: `plan.md`, `todo.md`, `rules.md`, and `CLAUDE.md`.

Use path aliases from `tsconfig.json`: `@entities/*`, `@engine/*`.

## Build, Test, and Development Commands
Default runtime/tooling is Bun.

- `bun test`: run all tests.
- `bun test tests/engine/board.test.ts`: run one test file.
- `bun test --watch`: watch mode for local development.
- `bun run <script>`: run project scripts when added.
- `bunx tsc --noEmit`: run TypeScript type checks.

## Coding Style & Naming Conventions
- Language: TypeScript (`"strict": true`).
- Indentation: 2 spaces; keep semicolon usage consistent with existing files.
- Naming: kebab-case for file names (`tile-bag.ts`), PascalCase for classes (`TileBag`), camelCase for variables/functions.
- Prefer small, focused modules and pure helpers where possible.
- Import internal modules via aliases (example: `import { Board } from "@engine/board"`).

## Testing Guidelines
- Framework: `bun:test` (`describe`, `test`, `expect`, `beforeEach`).
- Test files: `tests/<area>/<module>.test.ts`.
- Keep tests deterministic; use seeded behavior where randomness exists.
- Cover happy path, invalid input, and boundary cases (for board logic: bounds, occupancy, premium behavior).

## Commit & Pull Request Guidelines
Git history is minimal (`Initial commit`), so follow a clear baseline:

- Commit messages: imperative, concise, scoped when useful (example: `engine: validate out-of-bounds placement`).
- One logical change per commit.
- PRs should include: summary, key design decisions, test evidence (`bun test` output), and linked issue/task.
- For behavior changes, include before/after notes and affected modules.

## Agent-Specific Workflow Notes
- When using Codex CLI in this repo, prefix shell commands with `rtk` (see `/home/simon/.codex/RTK.md`).
- Prefer Bun-native workflows over Node-specific tooling.
