import { createServer } from "node:http";
import { Server, matchMaker } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { BunWebSockets } from "@colyseus/bun-websockets";
import {
  createElysiaApp,
  createHttpApp,
  type MatchProvisioner,
  type SeatReservation,
} from "../http";
import { InviteStore } from "./invite-store";
import { MatchRegistry } from "./match-registry";
import { MatchRoom, MATCH_ROOM_NAME } from "./match-room";
import { env } from "src/env";

export interface BootstrapOptions {
  port?: number;
  host?: string;
  clientOrigin?: string;
  publicBaseUrl?: string;
}

type TServerInfo = {
  host: string;
  port: number;
  baseURL: string;
};

export async function bootstrap(opts: BootstrapOptions = {}): Promise<{
  close: () => Promise<void>;
  engineServer: TServerInfo;
  apiServer: TServerInfo;
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
      const room = await matchMaker.createRoom(MATCH_ROOM_NAME, {
        matchId,
        seed,
      });
      matches.bindRoom(matchId, room.roomId);
      return room.roomId;
    },
    async reserveSeat(roomId, clientOptions): Promise<SeatReservation> {
      const targets = await matchMaker.query({ roomId });
      const listing = targets[0];
      if (!listing) throw new Error(`Room ${roomId} not available`);
      const reservation = await matchMaker.reserveSeatFor(
        listing,
        clientOptions,
      );
      return reservation as unknown as SeatReservation;
    },
  };

  const deps = {
    invites,
    matches,
    provisioner,
    clientOrigin: opts.clientOrigin,
    publicBaseUrl: opts.publicBaseUrl,
  };
  console.debug("origin", deps.clientOrigin);

  const gameServer = new Server({
    transport: new BunWebSockets({}),
  });

  gameServer.define(MATCH_ROOM_NAME, MatchRoom, { invites, matches } as any);

  const engineServer: TServerInfo = {
    port: env.ENGINE_PORT,
    host: env.ENGINE_HOST,
    baseURL: env.PUBLIC_ENGINE_URL ?? env.ENGINE_HOST,
  };

  await gameServer.listen(
    engineServer.port,
    engineServer.host,
    undefined,
    () => {
      /* Colyseus listen callback — unused */
    },
  );

  const apiServer: TServerInfo = {
    port: env.API_PORT,
    host: env.API_HOST,
    baseURL: env.PUBLIC_API_URL ?? env.ENGINE_HOST,
  };

  const elysia = createElysiaApp(deps);
  elysia.listen({ hostname: apiServer.host, port: apiServer.port });

  return {
    engineServer,
    apiServer,
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
    .then(({ engineServer, apiServer }) => {
      console.log(`B-M4TH service instance`);
      console.log(
        `****** [engine] ${engineServer.host}:${engineServer.port} => ${engineServer.baseURL}`,
      );
      console.log(
        `****** [api] ${apiServer.host}:${apiServer.port} => ${apiServer.baseURL}`,
      );
    })
    .catch((err) => {
      console.error("Failed to start server:", err);
      process.exit(1);
    });
}
