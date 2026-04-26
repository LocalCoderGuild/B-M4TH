import { minutesToMs } from "@b-m4th/shared";

export interface LifecycleSeatRecord {
  sessionId: string;
  bankRemainingMs: number;
  overtimePenalty: number;
  penaltyScoreTotal: number;
}

export interface LifecyclePlayerView {
  sessionId: string;
  bankRemainingMs: number;
  turnElapsedMs: number;
  overtimePenalty: number;
  score: number;
}

export interface TriggerBPlayer {
  id: string;
  rack: Array<{ value: number }>;
}

export interface WinnerCandidate {
  sessionId: string;
  score: number;
}

export interface SettledTurn {
  bankRemainingMs: number;
  overtimePenalty: number;
  penaltyDelta: number;
}

export function syncSeatBanks(
  seats: Iterable<LifecycleSeatRecord>,
  playerViewForSession: (sessionId: string) => LifecyclePlayerView | undefined,
  bankMs: number,
  resetPenalty: boolean,
): void {
  for (const seat of seats) {
    seat.bankRemainingMs = bankMs;
    if (resetPenalty) {
      seat.penaltyScoreTotal = 0;
      seat.overtimePenalty = 0;
    }
    const view = playerViewForSession(seat.sessionId);
    if (!view) continue;
    view.bankRemainingMs = bankMs;
    view.turnElapsedMs = 0;
    if (resetPenalty) {
      view.overtimePenalty = 0;
    }
  }
}

export function settleTurnState(params: {
  bankBeforeMs: number;
  elapsedMs: number;
  turnMinutes: number;
  incrementSeconds: number;
  previewPenalty: (overageMs: number) => number;
}): SettledTurn {
  const turnLimitMs = minutesToMs(params.turnMinutes);
  const allowedMs = Math.min(turnLimitMs, params.bankBeforeMs);
  const bankAfterElapsedMs = Math.max(0, params.bankBeforeMs - params.elapsedMs);
  const overageMs = Math.max(0, params.elapsedMs - allowedMs);
  const penalty = params.previewPenalty(overageMs);
  const incrementMs = params.incrementSeconds * 1000;
  const bankWithIncrementMs =
    incrementMs > 0 && bankAfterElapsedMs > 0
      ? bankAfterElapsedMs + incrementMs
      : bankAfterElapsedMs;

  return {
    bankRemainingMs: bankWithIncrementMs,
    overtimePenalty: penalty,
    penaltyDelta: penalty,
  };
}

export function calculateTriggerBBonuses(players: TriggerBPlayer[]): Map<string, number> {
  const rackValueById = new Map<string, number>();
  for (const p of players) {
    rackValueById.set(p.id, p.rack.reduce((sum, t) => sum + t.value, 0));
  }
  let totalRackValue = 0;
  for (const v of rackValueById.values()) totalRackValue += v;

  const bonuses = new Map<string, number>();
  for (const p of players) {
    const othersRackValue = totalRackValue - (rackValueById.get(p.id) ?? 0);
    bonuses.set(p.id, othersRackValue * 2);
  }
  return bonuses;
}

export function pickWinnerSessionId(players: WinnerCandidate[]): string {
  let best: WinnerCandidate | null = null;
  for (const p of players) {
    if (!best || p.score > best.score) best = p;
  }
  return best?.sessionId ?? "";
}
