import { beforeEach, describe, expect, test } from "bun:test";
import { createHttpApp, type MatchProvisioner, type SeatReservation } from "../../src/colyseus/http";
import { InviteStore } from "../../src/colyseus/invite-store";
import { MatchRegistry } from "../../src/colyseus/match-registry";

function mockReservation(roomId: string, sessionId: string): SeatReservation {
  return {
    room: { roomId, name: "match", processId: "p-test" },
    sessionId,
    reconnectionToken: "rec-" + sessionId,
  };
}

class StubProvisioner implements MatchProvisioner {
  public seatsReserved: Array<{ roomId: string; opts: Record<string, unknown> }> = [];
  public ensured = new Map<string, string>();
  private counter = 0;

  async ensureRoom(matchId: string): Promise<string> {
    const existing = this.ensured.get(matchId);
    if (existing) return existing;
    const roomId = `room-${this.ensured.size + 1}`;
    this.ensured.set(matchId, roomId);
    return roomId;
  }

  async reserveSeat(roomId: string, opts: Record<string, unknown>): Promise<SeatReservation> {
    this.seatsReserved.push({ roomId, opts });
    this.counter++;
    return mockReservation(roomId, `sess-${this.counter}`);
  }
}

async function req(app: ReturnType<typeof createHttpApp>, init: {
  method: string;
  path: string;
  body?: unknown;
}): Promise<{ status: number; body: any }> {
  const response = await new Promise<{ status: number; body: any }>((resolve, reject) => {
    const server = app.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Could not bind test server"));
        return;
      }
      const url = `http://127.0.0.1:${address.port}${init.path}`;
      fetch(url, {
        method: init.method,
        headers: init.body ? { "content-type": "application/json" } : undefined,
        body: init.body ? JSON.stringify(init.body) : undefined,
      })
        .then(async (res) => {
          const text = await res.text();
          let body: any = text;
          try {
            body = JSON.parse(text);
          } catch {
            /* non-json ok */
          }
          resolve({ status: res.status, body });
        })
        .catch(reject)
        .finally(() => server.close());
    });
  });
  return response;
}

describe("HTTP API", () => {
  let invites: InviteStore;
  let matches: MatchRegistry;
  let provisioner: StubProvisioner;
  let app: ReturnType<typeof createHttpApp>;

  beforeEach(() => {
    invites = new InviteStore({ sweepIntervalMs: 0 });
    matches = new MatchRegistry();
    provisioner = new StubProvisioner();
    app = createHttpApp({
      invites,
      matches,
      provisioner,
      publicBaseUrl: "https://play.example.com",
    });
  });

  test("POST /api/matches returns a shareable invite link and host reservation", async () => {
    const res = await req(app, {
      method: "POST",
      path: "/api/matches",
      body: { hostName: "Alice" },
    });
    expect(res.status).toBe(201);
    expect(res.body.matchId).toBeDefined();
    expect(res.body.inviteLink).toStartWith("https://play.example.com/invite/");
    expect(res.body.inviteToken).toBeDefined();
    expect(res.body.maxPlayers).toBe(2);
    expect(res.body.minPlayers).toBe(2);
    expect(res.body.hostReservation.sessionId).toMatch(/^sess-/);
    expect(provisioner.seatsReserved[0]).toMatchObject({
      roomId: "room-1",
      opts: { matchId: res.body.matchId, role: "host", name: "Alice" },
    });
    expect(invites.size()).toBe(1);
  });

  test("POST /api/matches respects maxPlayers up to 6", async () => {
    const res = await req(app, {
      method: "POST",
      path: "/api/matches",
      body: { hostName: "Alice", maxPlayers: 6 },
    });
    expect(res.status).toBe(201);
    expect(res.body.maxPlayers).toBe(6);
  });

  test("POST /api/matches accepts a per-turn timer in timeControl", async () => {
    const res = await req(app, {
      method: "POST",
      path: "/api/matches",
      body: {
        hostName: "Alice",
        timeControl: { baseMinutes: 12, incrementSeconds: 2, turnMinutes: 4 },
      },
    });
    expect(res.status).toBe(201);
    const record = matches.get(res.body.matchId);
    expect(record?.timeControl).toEqual({
      baseMinutes: 12,
      incrementSeconds: 2,
      turnMinutes: 4,
    });
  });

  test("POST /api/matches rejects blank host name", async () => {
    const res = await req(app, {
      method: "POST",
      path: "/api/matches",
      body: { hostName: "   " },
    });
    expect(res.status).toBe(400);
  });

  test("GET /api/invites/:token peeks without consuming", async () => {
    const created = await req(app, {
      method: "POST",
      path: "/api/matches",
      body: { hostName: "Alice", maxPlayers: 4 },
    });
    const token = created.body.inviteToken as string;

    const peek = await req(app, { method: "GET", path: `/api/invites/${token}` });
    expect(peek.status).toBe(200);
    expect(peek.body.hostName).toBe("Alice");
    expect(peek.body.maxPlayers).toBe(4);

    expect(invites.size()).toBe(1);
  });

  test("POST /api/invites/:token/claim is multi-use until revoked", async () => {
    const created = await req(app, {
      method: "POST",
      path: "/api/matches",
      body: { hostName: "Alice", maxPlayers: 4 },
    });
    const token = created.body.inviteToken as string;

    const first = await req(app, {
      method: "POST",
      path: `/api/invites/${token}/claim`,
      body: { name: "Bob" },
    });
    expect(first.status).toBe(200);
    expect(first.body.reservation.sessionId).toMatch(/^sess-/);

    const second = await req(app, {
      method: "POST",
      path: `/api/invites/${token}/claim`,
      body: { name: "Carol" },
    });
    expect(second.status).toBe(200);
    expect(second.body.reservation.sessionId).toMatch(/^sess-/);

    // Host + two guest claims = 3 seat reservations.
    expect(provisioner.seatsReserved.length).toBe(3);
  });

  test("claim reuses the host's room", async () => {
    const created = await req(app, {
      method: "POST",
      path: "/api/matches",
      body: { hostName: "Alice" },
    });
    const guest = await req(app, {
      method: "POST",
      path: `/api/invites/${created.body.inviteToken}/claim`,
      body: { name: "Bob" },
    });
    expect(created.body.hostReservation.room.roomId).toBe(guest.body.reservation.room.roomId);
    expect(provisioner.ensured.size).toBe(1);
  });

  test("unknown invite returns 404", async () => {
    const res = await req(app, { method: "GET", path: "/api/invites/nope" });
    expect(res.status).toBe(404);
  });

  test("/api/health returns ok", async () => {
    const res = await req(app, { method: "GET", path: "/api/health" });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
