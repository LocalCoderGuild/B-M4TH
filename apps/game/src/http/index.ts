import { Elysia } from "elysia";
import { cors } from "@elysia/cors";

import { z } from "zod";
import {
  displayNameErrorMessage,
  validateDisplayName,
} from "@b-m4th/shared";
import { MAX_PLAYERS, MIN_PLAYERS } from "@entities";
import { InviteStore } from "../colyseus/invite-store";
import { MatchRegistry } from "../colyseus/match-registry";
import { timeControlSchema } from "../colyseus/schemas/time-control-schema";

export interface SeatReservation {
  room: {
    roomId: string;
    name: string;
    processId: string;
    publicAddress?: string;
  };
  sessionId: string;
  reconnectionToken?: string;
  devMode?: boolean;
}

export interface MatchProvisioner {
  ensureRoom(matchId: string, opts: { seed: string }): Promise<string>;
  reserveSeat(
    roomId: string,
    clientOptions: Record<string, unknown>,
  ): Promise<SeatReservation>;
}

export interface HttpDeps {
  invites: InviteStore;
  matches: MatchRegistry;
  provisioner: MatchProvisioner;
  clientOrigin?: string;
  publicBaseUrl?: string;
}

const timeControlBody = timeControlSchema.optional();

const displayNameSchema = z.unknown().transform((value, ctx) => {
  const parsed = validateDisplayName(value);
  if (!parsed.ok) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: displayNameErrorMessage(parsed.error),
    });
    return z.NEVER;
  }
  return parsed.value;
});

const createMatchBody = z.object({
  hostName: displayNameSchema,
  timeControl: timeControlBody,
  maxPlayers: z.number().int().min(MIN_PLAYERS).max(MAX_PLAYERS).optional(),
});

const claimBody = z.object({
  name: displayNameSchema,
});

function buildLink(baseUrl: string, token: string): string {
  const normalized = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  return `${normalized}/invite/${token}`;
}

export function createElysiaApp(deps: HttpDeps) {
  const app = new Elysia({ websocket: {} })
    .use(
      cors({
        origin: deps.clientOrigin ? deps.clientOrigin.split(",") : true,
        credentials: false,
        methods: ["GET", "POST", "OPTIONS"],
      }),
    )
    .onError(({ error, code, status }) => {
      if (code === "VALIDATION" || code === "PARSE") {
        return status(422, { error: "Invalid request body" });
      }
      const IS_DEBUG = Bun.env.NODE_ENV !== "production";
      console.error("HTTP unhandled error:", error);
      if (error instanceof Error) {
        return status(500, {
          error: error.message,
          name: error.name,
          internal: IS_DEBUG
            ? { stack: error.stack, cause: error.cause }
            : null,
        });
      }
      return { error };
    })
    .get("/api/health", () => {
      return { ok: true };
    })
    .post(
      "/api/matches",
      async ({ status, body, request: req }) => {
        const hostName = body.hostName;
        const record = deps.matches.create(
          hostName,
          body.timeControl,
          body.maxPlayers,
        );

        const invite = deps.invites.create(record.matchId);
        const roomId = await deps.provisioner.ensureRoom(record.matchId, {
          seed: record.seed,
        });
        deps.matches.bindRoom(record.matchId, roomId);
        const hostReservation = await deps.provisioner.reserveSeat(roomId, {
          matchId: record.matchId,
          role: "host",
          name: hostName,
        });

        const curURL = new URL(req.url);
        curURL.pathname = "";
        curURL.hash = "";

        const base = deps.publicBaseUrl ?? curURL.toString();

        return status(201, {
          matchId: record.matchId,
          maxPlayers: record.maxPlayers,
          minPlayers: record.minPlayers,
          inviteToken: invite.token,
          inviteLink: buildLink(base, invite.token),
          hostReservation,
        });
      },
      { body: createMatchBody },
    )
    .get(
      "/api/invites/:token",
      ({ params: { token }, status }) => {
        const invite = deps.invites.peek(token);

        if (!invite) {
          return status(404, { error: "Invite not found or expired" });
        }

        const match = deps.matches.get(invite.matchId);
        if (!match) {
          return status(404, { error: "Match not found or expired" });
        }

        return {
          matchId: invite.matchId,
          expiresAt: invite.expiresAt,
          hostName: match.hostName,
          maxPlayers: match.maxPlayers,
          minPlayers: match.minPlayers,
        };
      },
      { params: z.object({ token: z.string() }) },
    )
    .post(
      "/api/invites/:token/claim",
      async ({ request: req, params: { token }, body, status }) => {
        const invite = deps.invites.claim(token);

        if (!invite) {
          return status(404, { error: "Invite not found or expired" });
          return;
        }
        const match = deps.matches.get(invite.matchId);
        if (!match) {
          return status(404, { error: "Match no longer exists" });
        }

        const roomId = await deps.provisioner.ensureRoom(invite.matchId, {
          seed: match.seed,
        });
        deps.matches.bindRoom(invite.matchId, roomId);

        const reservation = await deps.provisioner.reserveSeat(roomId, {
          matchId: invite.matchId,
          role: "player",
          name: body.name,
        });

        return {
          matchId: invite.matchId,
          reservation,
        };
      },
      {
        params: z.object({ token: z.string() }),
        body: claimBody,
      },
    );
  return app;
}
