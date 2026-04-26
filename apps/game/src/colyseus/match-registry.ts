import { randomBytes } from "node:crypto";
import {
  DEFAULT_TIME_CONTROL,
  MATCH_TTL_MS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  type TimeControl,
} from "@entities";
import { TtlMap, type TtlMapOptions } from "./ttl-map";

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

export type MatchRegistryOptions = TtlMapOptions & { ttlMs?: number };
export { DEFAULT_TIME_CONTROL, MAX_PLAYERS, MIN_PLAYERS };
export type { TimeControl };

function mintMatchId(): string {
  return randomBytes(9).toString("base64url");
}

function mintSeed(): string {
  return randomBytes(16).toString("base64url");
}

export class MatchRegistry extends TtlMap<MatchRecord> {
  constructor(opts: MatchRegistryOptions = {}) {
    super(opts.ttlMs ?? MATCH_TTL_MS, opts);
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
    this.set(record.matchId, record);
    return record;
  }

  get(matchId: string): MatchRecord | null {
    return this.getEntry(matchId);
  }

  bindRoom(matchId: string, roomId: string): void {
    const record = this.getEntry(matchId);
    if (!record) return;
    record.roomId = roomId;
  }

  updateTimeControl(matchId: string, timeControl: TimeControl): void {
    const record = this.getEntry(matchId);
    if (!record) return;
    record.timeControl = { ...timeControl };
  }

  remove(matchId: string): void {
    this.deleteEntry(matchId);
  }
}
