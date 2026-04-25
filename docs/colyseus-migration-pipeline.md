# Colyseus Migration Pipeline

This pipeline keeps the current engine stable while you migrate networking/runtime to Colyseus.

## Stages

1. Baseline Engine Gate  
   Goal: prevent regressions in existing game logic.  
   Checks:
   - `bun run typecheck`
   - `bun run test`

2. Migration Readiness Gate  
   Goal: ensure migration changes do not break engine behavior.  
   Checks:
   - `bun run ci:engine`
   - `bun test tests/colyseus` (only when `tests/colyseus/` exists)

3. Package Gate  
   Goal: verify repository remains buildable and CI scripts are valid.  
   Checks:
   - `bun run typecheck`
   - `bun run ci:engine`

## Local Execution

Run the same gates locally before pushing:

```bash
bun run ci
bun run ci:engine
```

When Colyseus tests exist:

```bash
bun test tests/colyseus
```

## Suggested Migration Milestones

- M1: Add Colyseus server bootstrap (`src/colyseus/server.ts`) without changing engine API.
- M2: Add room lifecycle + state sync tests in `tests/colyseus/`.
- M3: Integrate engine turn actions through room message handlers.
- M4: Add reconnect/timeout/disconnect tests.
- M5: Cut over transport entrypoint and keep engine tests as permanent guardrail.

## CI File

Pipeline definition: `.github/workflows/colyseus-migration.yml`
