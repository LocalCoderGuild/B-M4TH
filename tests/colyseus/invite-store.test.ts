import { beforeEach, describe, expect, test } from "bun:test";
import { InviteStore } from "../../src/colyseus/invite-store";

describe("InviteStore", () => {
  let now: number;
  let store: InviteStore;

  beforeEach(() => {
    now = 1_000_000;
    store = new InviteStore({ ttlMs: 1000, sweepIntervalMs: 0, now: () => now });
  });

  test("mints unique, opaque tokens", () => {
    const a = store.create("m1");
    const b = store.create("m1");
    expect(a.token).not.toBe(b.token);
    expect(a.token.length).toBeGreaterThanOrEqual(40);
    expect(a.token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  test("peek returns invite without consuming it", () => {
    const invite = store.create("m1");
    expect(store.peek(invite.token)?.matchId).toBe("m1");
    expect(store.size()).toBe(1);
  });

  test("claim is non-destructive (multi-use)", () => {
    const invite = store.create("m1");
    expect(store.claim(invite.token)?.matchId).toBe("m1");
    expect(store.claim(invite.token)?.matchId).toBe("m1");
    expect(store.size()).toBe(1);
  });

  test("revoke invalidates a specific token", () => {
    const invite = store.create("m1");
    store.revoke(invite.token);
    expect(store.claim(invite.token)).toBeNull();
  });

  test("expired invites are rejected by peek and claim", () => {
    const invite = store.create("m1");
    now += 1001;
    expect(store.peek(invite.token)).toBeNull();
    expect(store.claim(invite.token)).toBeNull();
  });

  test("sweep removes only expired invites", () => {
    const fresh = store.create("m1");
    now += 500;
    store.create("m2");
    now += 600;
    expect(store.sweep()).toBe(1);
    expect(store.size()).toBe(1);
    expect(store.peek(fresh.token)).toBeNull();
  });

  test("revokeMatch clears all tokens for that match", () => {
    store.create("m1");
    store.create("m1");
    store.create("m2");
    store.revokeMatch("m1");
    expect(store.size()).toBe(1);
  });

  test("unknown token returns null without side effects", () => {
    expect(store.peek("nope")).toBeNull();
    expect(store.claim("nope")).toBeNull();
  });
});
