import { createServer } from "node:http";
import { Server, matchMaker } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { createHttpApp, type MatchProvisioner, type SeatReservation } from "./http";
import { InviteStore } from "./invite-store";
import { MatchRegistry } from "./match-registry";
import { MatchRoom, MATCH_ROOM_NAME } from "./match-room";

export interface BootstrapOptions {
  port?: number;
  host?: string;
  clientOrigin?: string;
  publicBaseUrl?: string;
}

export async function bootstrap(opts: BootstrapOptions = {}): Promise<{
  close: () => Promise<void>;
  port: number;
}> {
  const invites = new InviteStore();
  const matches = new MatchRegistry();

  const provisioner: MatchProvisioner = {
    async ensureRoom(matchId, { seed }) {
      const existing = matches.get(matchId);
      if (existing?.roomId) {
        const rooms = await matchMaker.query({ roomId: existing.roomId });
        if (rooms.length > 0) return existing.roomId;
      }
      const room = await matchMaker.createRoom(MATCH_ROOM_NAME, { matchId, seed });
      matches.bindRoom(matchId, room.roomId);
      return room.roomId;
    },
    async reserveSeat(roomId, clientOptions): Promise<SeatReservation> {
      const targets = await matchMaker.query({ roomId });
      const listing = targets[0];
      if (!listing) throw new Error(`Room ${roomId} not available`);
      const reservation = await matchMaker.reserveSeatFor(listing, clientOptions);
      return reservation as unknown as SeatReservation;
    },
  };

  const app = createHttpApp({
    invites,
    matches,
    provisioner,
    clientOrigin: opts.clientOrigin,
    publicBaseUrl: opts.publicBaseUrl,
  });

  const httpServer = createServer(app);
  const gameServer = new Server({
    transport: new WebSocketTransport({ server: httpServer }),
  });

  gameServer.define(MATCH_ROOM_NAME, MatchRoom, { invites, matches } as any);

  const port = opts.port ?? Number(process.env.PORT ?? 2567);
  const host = opts.host ?? "0.0.0.0";
  void host;

  await gameServer.listen(port, undefined, undefined, () => {
    /* Colyseus listen callback — unused */
  });

  const actualPort = (httpServer.address() as { port: number } | null)?.port ?? port;

  return {
    port: actualPort,
    close: async () => {
      await gameServer.gracefullyShutdown(false);
    },
  };
}

if (import.meta.main) {
  bootstrap({
    publicBaseUrl: process.env.PUBLIC_BASE_URL,
    clientOrigin: process.env.CLIENT_ORIGIN,
  })
    .then(({ port }) => {
      console.log(`B-M4TH server listening on :${port}`);
      if (process.env.PUBLIC_BASE_URL) {
        console.log(`Magic links will use ${process.env.PUBLIC_BASE_URL}`);
      }
    })
    .catch((err) => {
      console.error("Failed to start server:", err);
      process.exit(1);
    });
}
