import { defaultColorForSeat, PLAYER_COLOR_KEYS, validateDisplayName } from "@b-m4th/shared";
import type { PlayerColorKey } from "@b-m4th/shared";
import type { JoinOptions, SeatRecord } from "./match-room.types";

export interface JoinAuthContext {
  expectedMatchId: string;
  options: JoinOptions;
  started: boolean;
  hostSessionId: string;
  playerCount: number;
  maxPlayers: number;
}

export function getJoinAuthError(ctx: JoinAuthContext): string | null {
  if (ctx.options?.matchId !== ctx.expectedMatchId) {
    return "Invite does not belong to this match";
  }
  if (ctx.options?.role !== "host" && ctx.options?.role !== "player") {
    return "Invalid role";
  }
  const parsedName = validateDisplayName(ctx.options.name);
  if (!parsedName.ok) {
    return "Invalid player name";
  }
  if (ctx.started) {
    return "Match already started";
  }
  if (ctx.options.role === "host" && ctx.hostSessionId !== "") {
    return "Host seat already taken";
  }
  if (ctx.playerCount >= ctx.maxPlayers) {
    return "Match is full";
  }
  return null;
}

export function resolveJoinName(name: JoinOptions["name"]): string {
  const parsedName = validateDisplayName(name);
  return parsedName.ok ? parsedName.value : "Player";
}

export function nextAvailableSeatIndex(
  players: Iterable<{ seatIndex: number }>,
  maxPlayers: number,
  fallback: number,
): number {
  const taken = new Set<number>();
  for (const p of players) taken.add(p.seatIndex);
  for (let i = 0; i < maxPlayers; i++) {
    if (!taken.has(i)) return i;
  }
  return fallback;
}

export function pickFirstAvailableColor(
  players: Iterable<{ sessionId: string; color: string; seatIndex: number }>,
  ownSessionId: string,
  seatIndex: number,
): PlayerColorKey {
  const taken = new Set<string>();
  for (const p of players) {
    if (p.sessionId !== ownSessionId && p.color) taken.add(p.color);
  }
  const preferred = defaultColorForSeat(seatIndex);
  if (!taken.has(preferred)) return preferred;
  for (const key of PLAYER_COLOR_KEYS) {
    if (!taken.has(key)) return key;
  }
  return preferred;
}

export function createSeatRecord(input: {
  sessionId: string;
  role: "host" | "player";
  seatIndex: number;
  name: string;
  bankRemainingMs: number;
}): SeatRecord {
  return {
    sessionId: input.sessionId,
    role: input.role,
    seatIndex: input.seatIndex,
    name: input.name,
    connected: true,
    bankRemainingMs: input.bankRemainingMs,
    overtimePenalty: 0,
    penaltyScoreTotal: 0,
  };
}
