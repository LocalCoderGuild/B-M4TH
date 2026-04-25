import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Server, matchMaker } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { InviteStore } from "../../src/colyseus/invite-store";
import { MatchRegistry } from "../../src/colyseus/match-registry";
import { MatchRoom, MATCH_ROOM_NAME } from "../../src/colyseus/match-room";

let colyseus: ColyseusTestServer;
let invites: InviteStore;
let matches: MatchRegistry;

beforeAll(async () => {
  invites = new InviteStore({ sweepIntervalMs: 0 });
  matches = new MatchRegistry();
  const server = new Server({ transport: new WebSocketTransport({ server: undefined as any }) });
  server.define(MATCH_ROOM_NAME, MatchRoom, { invites, matches } as any);
  colyseus = await boot(server);
});

afterAll(async () => {
  await colyseus.shutdown();
});

async function withMatch(hostName: string): Promise<{ matchId: string; seed: string; roomId: string; room: MatchRoom }> {
  const record = matches.create(hostName);
  const room = (await matchMaker.createRoom(MATCH_ROOM_NAME, {
    matchId: record.matchId,
    seed: record.seed,
  })) as MatchRoom;
  matches.bindRoom(record.matchId, room.roomId);
  return { matchId: record.matchId, seed: record.seed, roomId: room.roomId, room };
}

describe("MatchRoom integration", () => {
  test("two clients join, names appear in shared state, game transitions to playing", async () => {
    const { matchId, roomId } = await withMatch("Alice");

    const host = await colyseus.connectTo(colyseus.getRoomById(roomId), {
      matchId,
      role: "host",
      name: "Alice",
    });
    const guest = await colyseus.connectTo(colyseus.getRoomById(roomId), {
      matchId,
      role: "player",
      name: "Bob",
    });

    // Host explicitly starts the match (no auto-start).
    host.send("startMatch", {});
    await new Promise((r) => setTimeout(r, 200));

    expect(host.state.players.length).toBe(2);
    const names = [...host.state.players].map((p) => p.name).sort();
    expect(names).toEqual(["Alice", "Bob"]);
    expect(host.state.phase).toBe("playing");
    expect(guest.state.phase).toBe("playing");
    expect(host.state.board.length).toBe(15 * 15);

    void host.leave(true);
    void guest.leave(true);
  });

  test("room defaults the per-turn timer to 3 minutes and host can change it pre-start", async () => {
    const { matchId, roomId } = await withMatch("Alice");
    const host = await colyseus.connectTo(colyseus.getRoomById(roomId), {
      matchId,
      role: "host",
      name: "Alice",
    });
    const liveRoom = colyseus.getRoomById(roomId) as MatchRoom;

    expect(liveRoom.state.turnMinutes).toBe(3);
    host.send("setTimeControl", { baseMinutes: 10, incrementSeconds: 5, turnMinutes: 4 });
    await new Promise((r) => setTimeout(r, 100));
    expect(liveRoom.state.turnMinutes).toBe(4);

    void host.leave(true);
  });

  test("rejects a join whose matchId does not belong to the room", async () => {
    const { roomId } = await withMatch("Alice");
    await expect(
      colyseus.connectTo(colyseus.getRoomById(roomId), {
        matchId: "wrong",
        role: "host",
        name: "Alice",
      }),
    ).rejects.toThrow();
  });

  test("rejects a join with missing name", async () => {
    const { matchId, roomId } = await withMatch("Alice");
    await expect(
      colyseus.connectTo(colyseus.getRoomById(roomId), { matchId, role: "host" }),
    ).rejects.toThrow();
  });

  test("rejects a join with invalid slot", async () => {
    const { matchId, roomId } = await withMatch("Alice");
    await expect(
      colyseus.connectTo(colyseus.getRoomById(roomId), { matchId, name: "Alice" } as any),
    ).rejects.toThrow();
  });

  test("private rack is pushed only to the owning client via 'rack' message", async () => {
    const { matchId, roomId } = await withMatch("Alice");

    const host = await colyseus.connectTo(colyseus.getRoomById(roomId), {
      matchId,
      role: "host",
      name: "Alice",
    });
    const hostRacks: Array<{ tiles: Array<{ id: string }> }> = [];
    host.onMessage("rack", (msg: { tiles: Array<{ id: string }> }) => hostRacks.push(msg));

    const guest = await colyseus.connectTo(colyseus.getRoomById(roomId), {
      matchId,
      role: "player",
      name: "Bob",
    });
    const guestRacks: Array<{ tiles: Array<{ id: string }> }> = [];
    guest.onMessage("rack", (msg: { tiles: Array<{ id: string }> }) => guestRacks.push(msg));

    // Host explicitly starts the match (no auto-start).
    host.send("startMatch", {});
    // Ready handshake — server re-broadcasts rack after listeners are attached.
    host.send("ready", {});
    guest.send("ready", {});

    // Poll until racks arrive.
    const deadline = Date.now() + 2000;
    while (Date.now() < deadline && (hostRacks.length === 0 || guestRacks.length === 0)) {
      await new Promise((r) => setTimeout(r, 25));
    }

    expect(hostRacks.length).toBeGreaterThan(0);
    expect(guestRacks.length).toBeGreaterThan(0);
    const hostRack = hostRacks[hostRacks.length - 1]!;
    const guestRack = guestRacks[guestRacks.length - 1]!;
    expect(hostRack.tiles.length).toBe(8);
    expect(guestRack.tiles.length).toBe(8);

    const hostIds = hostRack.tiles.map((t) => t.id).sort();
    const guestIds = guestRack.tiles.map((t) => t.id).sort();
    expect(hostIds).not.toEqual(guestIds);

    // fire-and-forget leave (awaiting hangs in the test harness)
    void host.leave(true);
    void guest.leave(true);
  });

  test("repeated rack recovery requests are throttled", async () => {
    const { matchId, roomId } = await withMatch("Alice");

    const host = await colyseus.connectTo(colyseus.getRoomById(roomId), {
      matchId,
      role: "host",
      name: "Alice",
    });
    const guest = await colyseus.connectTo(colyseus.getRoomById(roomId), {
      matchId,
      role: "player",
      name: "Bob",
    });

    host.send("startMatch", {});
    const startDeadline = Date.now() + 2000;
    while (Date.now() < startDeadline && host.state.phase !== "playing") {
      await new Promise((r) => setTimeout(r, 25));
    }

    const hostRacks: Array<{ tiles: Array<{ id: string }> }> = [];
    host.onMessage("rack", (msg: { tiles: Array<{ id: string }> }) => hostRacks.push(msg));

    host.send("requestRack", {});
    host.send("requestRack", {});
    await new Promise((r) => setTimeout(r, 150));
    expect(hostRacks).toHaveLength(1);

    await new Promise((r) => setTimeout(r, 1050));
    host.send("requestRack", {});
    const deadline = Date.now() + 1000;
    while (Date.now() < deadline && hostRacks.length < 2) {
      await new Promise((r) => setTimeout(r, 25));
    }
    expect(hostRacks).toHaveLength(2);

    void host.leave(true);
    void guest.leave(true);
  });

  test("pass action advances the turn and increments consecutivePasses", async () => {
    const { matchId, roomId } = await withMatch("Alice");
    const host = await colyseus.connectTo(colyseus.getRoomById(roomId), {
      matchId,
      role: "host",
      name: "Alice",
    });
    const guest = await colyseus.connectTo(colyseus.getRoomById(roomId), {
      matchId,
      role: "player",
      name: "Bob",
    });

    // Host starts the match; wait for phase=playing to propagate.
    host.send("startMatch", {});
    const deadline = Date.now() + 2000;
    while (Date.now() < deadline && host.state.phase !== "playing") {
      await new Promise((r) => setTimeout(r, 25));
    }
    const firstPlayer = host.state.currentSessionId;
    expect(firstPlayer).toBeTruthy();
    const currentClient = firstPlayer === host.sessionId ? host : guest;

    // Rate-limit window is 500ms — pass after a tiny gap to avoid race with setup.
    await new Promise((r) => setTimeout(r, 600));
    currentClient.send("pass", {});

    const turnDeadline = Date.now() + 2000;
    while (Date.now() < turnDeadline && host.state.currentSessionId === firstPlayer) {
      await new Promise((r) => setTimeout(r, 25));
    }

    expect(host.state.currentSessionId).not.toBe(firstPlayer);
    expect(host.state.consecutivePasses).toBe(1);
    expect(host.state.lastMove?.action).toBe("pass");

    void host.leave(true);
    void guest.leave(true);
  });

  test("clock deducts elapsed from the outgoing player's bank on pass", async () => {
    const { matchId, roomId } = await withMatch("Alice");
    const host = await colyseus.connectTo(colyseus.getRoomById(roomId), {
      matchId,
      role: "host",
      name: "Alice",
    });
    const guest = await colyseus.connectTo(colyseus.getRoomById(roomId), {
      matchId,
      role: "player",
      name: "Bob",
    });

    // Clear Fischer increment so deduction assertions stay unambiguous.
    host.send("setTimeControl", { baseMinutes: 10, incrementSeconds: 0, turnMinutes: 3 });
    await new Promise((r) => setTimeout(r, 100));
    host.send("startMatch", {});
    const startDeadline = Date.now() + 2000;
    while (Date.now() < startDeadline && host.state.phase !== "playing") {
      await new Promise((r) => setTimeout(r, 25));
    }
    const firstPlayer = host.state.currentSessionId;
    const baseBankMs = host.state.baseMinutes * 60 * 1000;
    const initialBank = host.state.players.find((p) => p.sessionId === firstPlayer)?.bankRemainingMs;
    expect(initialBank).toBe(baseBankMs);

    // Hold turn open for ~700ms then pass.
    await new Promise((r) => setTimeout(r, 700));
    const currentClient = firstPlayer === host.sessionId ? host : guest;
    currentClient.send("pass", {});

    const deadline = Date.now() + 2000;
    while (Date.now() < deadline && host.state.currentSessionId === firstPlayer) {
      await new Promise((r) => setTimeout(r, 25));
    }
    const settled = host.state.players.find((p) => p.sessionId === firstPlayer)!;
    expect(settled.bankRemainingMs).toBeLessThan(baseBankMs);
    expect(settled.bankRemainingMs).toBeGreaterThan(baseBankMs - 3000);
    expect(settled.overtimePenalty).toBe(0);

    void host.leave(true);
    void guest.leave(true);
  });

  test("submitted overdue turns subtract 10 points per started minute", async () => {
    const { matchId, roomId } = await withMatch("Alice");
    const host = await colyseus.connectTo(colyseus.getRoomById(roomId), {
      matchId,
      role: "host",
      name: "Alice",
    });
    const guest = await colyseus.connectTo(colyseus.getRoomById(roomId), {
      matchId,
      role: "player",
      name: "Bob",
    });

    host.send("setTimeControl", { baseMinutes: 10, incrementSeconds: 0, turnMinutes: 1 });
    await new Promise((r) => setTimeout(r, 100));
    host.send("startMatch", {});
    const startDeadline = Date.now() + 2000;
    while (Date.now() < startDeadline && host.state.phase !== "playing") {
      await new Promise((r) => setTimeout(r, 25));
    }

    const firstPlayer = host.state.currentSessionId;
    const currentClient = firstPlayer === host.sessionId ? host : guest;
    const roomImpl = colyseus.getRoomById(roomId) as MatchRoom & { turnStartedAt: number | null };
    roomImpl.turnStartedAt = Date.now() - 121_000;

    await new Promise((r) => setTimeout(r, 600));
    currentClient.send("pass", {});

    const deadline = Date.now() + 2000;
    while (Date.now() < deadline && host.state.currentSessionId === firstPlayer) {
      await new Promise((r) => setTimeout(r, 25));
    }

    const settled = host.state.players.find((p) => p.sessionId === firstPlayer)!;
    expect(settled.overtimePenalty).toBe(20);
    expect(settled.score).toBe(-20);

    void host.leave(true);
    void guest.leave(true);
  });

  test("pickColor: each player gets a distinct default color and can pick a different one", async () => {
    const { matchId, roomId } = await withMatch("Alice");
    const host = await colyseus.connectTo(colyseus.getRoomById(roomId), {
      matchId,
      role: "host",
      name: "Alice",
    });
    const guest = await colyseus.connectTo(colyseus.getRoomById(roomId), {
      matchId,
      role: "player",
      name: "Bob",
    });
    await new Promise((r) => setTimeout(r, 100));

    const hostPlayer = () => host.state.players.find((p) => p.sessionId === host.sessionId)!;
    const guestPlayer = () => host.state.players.find((p) => p.sessionId === guest.sessionId)!;
    expect(hostPlayer().color).not.toBe("");
    expect(guestPlayer().color).not.toBe("");
    expect(hostPlayer().color).not.toBe(guestPlayer().color);

    host.send("pickColor", { color: "violet" });
    await new Promise((r) => setTimeout(r, 100));
    expect(hostPlayer().color).toBe("violet");

    void host.leave(true);
    void guest.leave(true);
  });

  test("pickColor: rejects a collision with another player's color", async () => {
    const { matchId, roomId } = await withMatch("Alice");
    const host = await colyseus.connectTo(colyseus.getRoomById(roomId), {
      matchId,
      role: "host",
      name: "Alice",
    });
    const guest = await colyseus.connectTo(colyseus.getRoomById(roomId), {
      matchId,
      role: "player",
      name: "Bob",
    });
    await new Promise((r) => setTimeout(r, 100));

    const errors: Array<{ code: string }> = [];
    guest.onMessage("error", (msg: { code: string }) => errors.push(msg));

    const hostColor = host.state.players.find((p) => p.sessionId === host.sessionId)!.color;
    guest.send("pickColor", { color: hostColor });
    await new Promise((r) => setTimeout(r, 100));

    const guestPlayer = host.state.players.find((p) => p.sessionId === guest.sessionId)!;
    expect(guestPlayer.color).not.toBe(hostColor);
    expect(errors.some((e) => e.code === "color_taken")).toBe(true);

    void host.leave(true);
    void guest.leave(true);
  });

  test("pickColor: rejects changes after the match has started", async () => {
    const { matchId, roomId } = await withMatch("Alice");
    const host = await colyseus.connectTo(colyseus.getRoomById(roomId), {
      matchId,
      role: "host",
      name: "Alice",
    });
    const guest = await colyseus.connectTo(colyseus.getRoomById(roomId), {
      matchId,
      role: "player",
      name: "Bob",
    });

    host.send("startMatch", {});
    const startDeadline = Date.now() + 2000;
    while (Date.now() < startDeadline && host.state.phase !== "playing") {
      await new Promise((r) => setTimeout(r, 25));
    }

    const errors: Array<{ code: string }> = [];
    host.onMessage("error", (msg: { code: string }) => errors.push(msg));

    const before = host.state.players.find((p) => p.sessionId === host.sessionId)!.color;
    host.send("pickColor", { color: before === "violet" ? "yellow" : "violet" });
    await new Promise((r) => setTimeout(r, 100));

    const after = host.state.players.find((p) => p.sessionId === host.sessionId)!.color;
    expect(after).toBe(before);
    expect(errors.some((e) => e.code === "already_started")).toBe(true);

    void host.leave(true);
    void guest.leave(true);
  });
});
