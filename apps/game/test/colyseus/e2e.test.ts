/**
 * Full-stack end-to-end test: exercises the complete magic-link flow the way
 * a browser would — POST /api/matches, GET /invites/:token, POST /claim,
 * then consumeSeatReservation via the Colyseus SDK — and confirms two
 * independent SDK clients land in the same room and can drive a turn to
 * completion.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Client as ColyseusClient } from "@colyseus/sdk";
import { bootstrap } from "../../src/colyseus/server";

const TEST_ENGINE_PORT = 17566;
const TEST_API_PORT = 17567;

let server: Awaited<ReturnType<typeof bootstrap>>;
let httpBase: string;
let wsBase: string;

beforeAll(async () => {
  server = await bootstrap({
    enginePort: TEST_ENGINE_PORT,
    apiPort: TEST_API_PORT,
    clientOrigin: "*",
    publicBaseUrl: `http://127.0.0.1:${TEST_API_PORT}`,
  });
  httpBase = `http://127.0.0.1:${server.apiServer.port}`;
  wsBase = `ws://127.0.0.1:${server.engineServer.port}`;
});

afterAll(async () => {
  await server.close();
});

async function jsonPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${httpBase}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

async function jsonGet<T>(path: string): Promise<T> {
  const res = await fetch(`${httpBase}${path}`);
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  return (await res.json()) as T;
}

interface CreateResponse {
  matchId: string;
  inviteToken: string;
  inviteLink: string;
  hostReservation: any;
}

interface ClaimResponse {
  matchId: string;
  reservation: any;
}

describe("E2E: magic link → Colyseus join → gameplay", () => {
  test("two players claim magic links, join, pass, and the turn advances", async () => {
    // 1) Host creates a match
    const created = await jsonPost<CreateResponse>("/api/matches", { hostName: "Alice" });
    expect(created.matchId).toBeDefined();
    expect(created.inviteToken).toBeDefined();
    expect(created.inviteLink).toContain(`/invite/${created.inviteToken}`);

    // 2) Preview invite (non-destructive, what the InvitePage does)
    const peek = await jsonGet<{ hostName: string; maxPlayers: number; minPlayers: number }>(
      `/api/invites/${created.inviteToken}`,
    );
    expect(peek.hostName).toBe("Alice");
    expect(peek.maxPlayers).toBe(2);
    expect(peek.minPlayers).toBe(2);

    // 3) Host already has a seat; guest claims the live invite.
    const guestClaim = await jsonPost<ClaimResponse>(
      `/api/invites/${created.inviteToken}/claim`,
      { name: "Bob" },
    );
    expect(created.hostReservation).toBeDefined();
    expect(guestClaim.reservation).toBeDefined();

    // 4) Consume seat reservations with the real SDK
    const sdkHost = new ColyseusClient(wsBase);
    const sdkGuest = new ColyseusClient(wsBase);
    const hostRoom = await sdkHost.consumeSeatReservation<any>(created.hostReservation);
    const guestRoom = await sdkGuest.consumeSeatReservation<any>(guestClaim.reservation);

    // 5) Host starts the match (no auto-start), then wait for phase=playing.
    hostRoom.send("startMatch", {});
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline && hostRoom.state.phase !== "playing") {
      await new Promise((r) => setTimeout(r, 25));
    }
    expect(hostRoom.state.phase).toBe("playing");
    expect(hostRoom.state.players.length).toBe(2);
    expect(hostRoom.state.board.length).toBe(15 * 15);

    // 6) Private rack arrives out-of-band
    const hostRacks: Array<{ tiles: unknown[] }> = [];
    hostRoom.onMessage("rack", (m: any) => hostRacks.push(m));
    hostRoom.send("ready", {});
    const rackDeadline = Date.now() + 2000;
    while (Date.now() < rackDeadline && hostRacks.length === 0) {
      await new Promise((r) => setTimeout(r, 25));
    }
    expect(hostRacks[0]?.tiles.length).toBe(8);

    // 6b) Browser refresh/reconnect restores private rack via explicit request.
    const reconnectToken = (hostRoom as any).reconnectionToken as string | undefined;
    expect(reconnectToken).toBeTruthy();
    (hostRoom as any).connection?.close(4001);
    const reconnectingHost = new ColyseusClient(wsBase);
    const rejoinedHost = await reconnectingHost.reconnect<any>(reconnectToken!);
    const rejoinedRacks: Array<{ tiles: unknown[] }> = [];
    rejoinedHost.onMessage("rack", (m: any) => rejoinedRacks.push(m));
    rejoinedHost.send("requestRack", {});
    const reconnectRackDeadline = Date.now() + 2000;
    while (Date.now() < reconnectRackDeadline && rejoinedRacks.length === 0) {
      await new Promise((r) => setTimeout(r, 25));
    }
    expect(rejoinedRacks[0]?.tiles.length).toBe(8);

    // 7) Active player passes → turn advances
    const firstPlayer = rejoinedHost.state.currentSessionId;
    const activeRoom = firstPlayer === rejoinedHost.sessionId ? rejoinedHost : guestRoom;
    await new Promise((r) => setTimeout(r, 600)); // avoid rate-limit race
    activeRoom.send("pass", {});
    const advDeadline = Date.now() + 2000;
    while (Date.now() < advDeadline && rejoinedHost.state.currentSessionId === firstPlayer) {
      await new Promise((r) => setTimeout(r, 25));
    }
    expect(rejoinedHost.state.currentSessionId).not.toBe(firstPlayer);
    expect(rejoinedHost.state.consecutivePasses).toBe(1);

    void rejoinedHost.leave(true);
    void guestRoom.leave(true);
  });
});
