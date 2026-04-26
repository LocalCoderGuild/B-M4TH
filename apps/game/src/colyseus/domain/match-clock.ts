import { minutesToMs } from "@b-m4th/shared";
import { settleTurnState } from "../match-room.lifecycle";
import { previewPenalty } from "../match-room.helpers";
import type { TimeControl } from "@entities";

export interface ClockPlayerState {
  sessionId: string;
  bankRemainingMs: number;
  turnElapsedMs: number;
  overtimePenalty: number;
  penaltyScoreTotal: number;
}

export class MatchClock {
  private turnStartedAt: number | null = null;
  private readonly playerStates = new Map<string, ClockPlayerState>();

  constructor(private timeControl: TimeControl) {}

  updateTimeControl(tc: TimeControl): void {
    this.timeControl = { ...tc };
  }

  getTimeControl(): TimeControl {
    return this.timeControl;
  }

  addPlayer(sessionId: string): void {
    this.playerStates.set(sessionId, {
      sessionId,
      bankRemainingMs: minutesToMs(this.timeControl.baseMinutes),
      turnElapsedMs: 0,
      overtimePenalty: 0,
      penaltyScoreTotal: 0,
    });
  }

  getPlayerState(sessionId: string): ClockPlayerState | undefined {
    return this.playerStates.get(sessionId);
  }

  getAllPlayers(): ClockPlayerState[] {
    return Array.from(this.playerStates.values());
  }

  resetAllBanks(): void {
    const bankMs = minutesToMs(this.timeControl.baseMinutes);
    for (const state of this.playerStates.values()) {
      state.bankRemainingMs = bankMs;
      state.turnElapsedMs = 0;
      state.overtimePenalty = 0;
      state.penaltyScoreTotal = 0;
    }
  }

  startTurn(nowMs: number): void {
    this.turnStartedAt = nowMs;
  }

  stopTurn(): void {
    this.turnStartedAt = null;
  }

  tick(currentSessionId: string, nowMs: number): void {
    if (this.turnStartedAt === null) return;
    const state = this.playerStates.get(currentSessionId);
    if (!state) return;

    const elapsed = nowMs - this.turnStartedAt;
    state.turnElapsedMs = elapsed;

    const allowed = Math.min(
      minutesToMs(this.timeControl.turnMinutes),
      state.bankRemainingMs
    );
    const overage = Math.max(0, elapsed - allowed);
    state.overtimePenalty = previewPenalty(overage);
  }

  settleTurn(outgoingSessionId: string, nowMs: number): void {
    if (this.turnStartedAt === null) return;
    const state = this.playerStates.get(outgoingSessionId);
    if (!state) return;

    const elapsed = nowMs - this.turnStartedAt;
    const settled = settleTurnState({
      bankBeforeMs: state.bankRemainingMs,
      elapsedMs: elapsed,
      turnMinutes: this.timeControl.turnMinutes,
      incrementSeconds: this.timeControl.incrementSeconds,
      previewPenalty,
    });

    state.bankRemainingMs = settled.bankRemainingMs;
    state.turnElapsedMs = 0;
    if (settled.penaltyDelta > 0) {
      state.penaltyScoreTotal += settled.penaltyDelta;
      state.overtimePenalty = settled.overtimePenalty;
    } else {
      state.overtimePenalty = 0;
    }
  }
}
