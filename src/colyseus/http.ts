import cors from "cors";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { MAX_PLAYERS, MIN_PLAYERS, TIME_CONTROL_LIMITS } from "@entities";
import { InviteStore } from "./invite-store";
import { MatchRegistry } from "./match-registry";

export interface SeatReservation {
  room: { roomId: string; name: string; processId: string; publicAddress?: string };
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

const timeControlBody = z
  .object({
    baseMinutes: z.number().int()
      .min(TIME_CONTROL_LIMITS.baseMinutes.min)
      .max(TIME_CONTROL_LIMITS.baseMinutes.max),
    incrementSeconds: z.number().int()
      .min(TIME_CONTROL_LIMITS.incrementSeconds.min)
      .max(TIME_CONTROL_LIMITS.incrementSeconds.max),
    turnMinutes: z.number().int()
      .min(TIME_CONTROL_LIMITS.turnMinutes.min)
      .max(TIME_CONTROL_LIMITS.turnMinutes.max),
  })
  .optional();

const createMatchBody = z.object({
  hostName: z.string().trim().min(1).max(40),
  timeControl: timeControlBody,
  maxPlayers: z.number().int().min(MIN_PLAYERS).max(MAX_PLAYERS).optional(),
});

const claimBody = z.object({
  name: z.string().trim().min(1).max(40),
});

function buildLink(baseUrl: string, token: string): string {
  const normalized = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  return `${normalized}/invite/${token}`;
}

export function createHttpApp(deps: HttpDeps): Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json({ limit: "16kb" }));
  app.use(
    cors({
      origin: deps.clientOrigin ?? true,
      credentials: false,
      methods: ["GET", "POST", "OPTIONS"],
    }),
  );

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.post("/api/matches", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = createMatchBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid body", issues: parsed.error.issues });
        return;
      }
      const hostName = parsed.data.hostName;
      const record = deps.matches.create(
        hostName,
        parsed.data.timeControl,
        parsed.data.maxPlayers,
      );
      const invite = deps.invites.create(record.matchId);
      const roomId = await deps.provisioner.ensureRoom(record.matchId, { seed: record.seed });
      deps.matches.bindRoom(record.matchId, roomId);
      const hostReservation = await deps.provisioner.reserveSeat(roomId, {
        matchId: record.matchId,
        role: "host",
        name: hostName,
      });
      const base = deps.publicBaseUrl ?? `${req.protocol}://${req.get("host") ?? "localhost"}`;
      res.status(201).json({
        matchId: record.matchId,
        maxPlayers: record.maxPlayers,
        minPlayers: record.minPlayers,
        inviteToken: invite.token,
        inviteLink: buildLink(base, invite.token),
        hostReservation,
      });
    } catch (e) {
      next(e);
    }
  });

  app.get("/api/invites/:token", (req: Request, res: Response) => {
    const token = String(req.params.token ?? "");
    const invite = deps.invites.peek(token);
    if (!invite) {
      res.status(404).json({ error: "Invite not found or expired" });
      return;
    }
    const match = deps.matches.get(invite.matchId);
    if (!match) {
      res.status(404).json({ error: "Match not found or expired" });
      return;
    }
    res.json({
      matchId: invite.matchId,
      expiresAt: invite.expiresAt,
      hostName: match.hostName,
      maxPlayers: match.maxPlayers,
      minPlayers: match.minPlayers,
    });
  });

  app.post("/api/invites/:token/claim", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = String(req.params.token ?? "");
      const parsed = claimBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid body", issues: parsed.error.issues });
        return;
      }
      const invite = deps.invites.claim(token);
      if (!invite) {
        res.status(404).json({ error: "Invite not found or expired" });
        return;
      }
      const match = deps.matches.get(invite.matchId);
      if (!match) {
        res.status(404).json({ error: "Match no longer exists" });
        return;
      }

      const roomId = await deps.provisioner.ensureRoom(invite.matchId, { seed: match.seed });
      deps.matches.bindRoom(invite.matchId, roomId);

      const reservation = await deps.provisioner.reserveSeat(roomId, {
        matchId: invite.matchId,
        role: "player",
        name: parsed.data.name,
      });

      res.json({
        matchId: invite.matchId,
        reservation,
      });
    } catch (e) {
      next(e);
    }
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  });

  return app;
}
