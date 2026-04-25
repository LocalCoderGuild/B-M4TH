import { randomBytes } from "node:crypto";
import {
  DEFAULT_TIME_CONTROL,
  MATCH_TTL_MS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  type TimeControl,
} from "@entities";

export interface MatchRecord {
  matchId: string;
  seed: string;
  hostName: string;
  roomId: string | null;
  createdAt: number;
  timeControl: TimeControl;
  maxPlayers: number;
  minPlayers: number;
}

export interface MatchRegistryOptions {
  ttlMs?: number;
  sweepIntervalMs?: number;
  now?: () => number;
}
export { DEFAULT_TIME_CONTROL, MAX_PLAYERS, MIN_PLAYERS };
export type { TimeControl };

function mintMatchId(): string {
  return randomBytes(9).toString("base64url");
}

function mintSeed(): string {
  return randomBytes(16).toString("base64url");
}

export class MatchRegistry {
  private readonly matches = new Map<string, MatchRecord>();
  private readonly ttlMs: number;
  private readonly now: () => number;
  private sweepTimer?: ReturnType<typeof setInterval>;

  constructor(opts: MatchRegistryOptions = {}) {
    this.ttlMs = opts.ttlMs ?? MATCH_TTL_MS;
    this.now = opts.now ?? Date.now;
    const interval = opts.sweepIntervalMs ?? 5 * 60 * 1000;
    if (interval > 0 && typeof setInterval === "function") {
      this.sweepTimer = setInterval(() => this.sweep(), interval);
      this.sweepTimer.unref?.();
    }
  }

  create(
    hostName: string,
    timeControl: TimeControl = DEFAULT_TIME_CONTROL,
    maxPlayers: number = MIN_PLAYERS,
  ): MatchRecord {
    const clampedMax = Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, Math.round(maxPlayers)));
    const record: MatchRecord = {
      matchId: mintMatchId(),
      seed: mintSeed(),
      hostName,
      roomId: null,
      createdAt: this.now(),
      timeControl: { ...timeControl },
      maxPlayers: clampedMax,
      minPlayers: MIN_PLAYERS,
    };
    this.matches.set(record.matchId, record);
    return record;
  }

  get(matchId: string): MatchRecord | null {
    const record = this.matches.get(matchId);
    if (!record) return null;
    if (this.now() - record.createdAt > this.ttlMs) {
      this.matches.delete(matchId);
      return null;
    }
    return record;
  }

  bindRoom(matchId: string, roomId: string): void {
    const record = this.matches.get(matchId);
    if (!record) return;
    record.roomId = roomId;
  }

  updateTimeControl(matchId: string, timeControl: TimeControl): void {
    const record = this.matches.get(matchId);
    if (!record) return;
    record.timeControl = { ...timeControl };
  }

  remove(matchId: string): void {
    this.matches.delete(matchId);
  }

  sweep(): number {
    const cutoff = this.now();
    let removed = 0;
    for (const [matchId, record] of this.matches) {
      if (cutoff - record.createdAt > this.ttlMs) {
        this.matches.delete(matchId);
        removed++;
      }
    }
    return removed;
  }

  size(): number {
    return this.matches.size;
  }

  dispose(): void {
    if (this.sweepTimer) clearInterval(this.sweepTimer);
    this.matches.clear();
  }
}
