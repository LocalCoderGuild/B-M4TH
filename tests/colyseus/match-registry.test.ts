import { describe, expect, test } from "bun:test";
import { MatchRegistry } from "../../src/colyseus/match-registry";

describe("MatchRegistry", () => {
  test("sweep removes only expired matches", () => {
    let now = 0;
    const registry = new MatchRegistry({
      ttlMs: 1000,
      sweepIntervalMs: 0,
      now: () => now,
    });

    const a = registry.create("Alice");
    now = 900;
    const b = registry.create("Bob");

    now = 1600;
    expect(registry.sweep()).toBe(1);
    expect(registry.get(a.matchId)).toBeNull();
    expect(registry.get(b.matchId)?.matchId).toBe(b.matchId);

    registry.dispose();
  });

  test("get lazily expires stale matches", () => {
    let now = 0;
    const registry = new MatchRegistry({
      ttlMs: 1000,
      sweepIntervalMs: 0,
      now: () => now,
    });

    const record = registry.create("Alice");
    now = 1001;
    expect(registry.get(record.matchId)).toBeNull();
    expect(registry.size()).toBe(0);

    registry.dispose();
  });
});
