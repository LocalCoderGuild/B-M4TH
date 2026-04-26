import type { InviteStore } from "./invite-store";
import type { MatchRegistry } from "./match-registry";

export const MATCH_ROOM_NAME = "match";

export interface MatchRoomDefineOptions {
  invites: InviteStore;
  matches: MatchRegistry;
  /** Optional: override clock timer interval (ms). Useful in tests. */
  clockIntervalMs?: number;
}

export const MATCH_ROOM_DEFAULTS = {
  autoDisposeTimeoutMs: 30_000,
  reconnectionGraceSeconds: 300, // 5 minutes
  actionRateLimitWindowMs: 500,
  rackRecoveryWindowMs: 1000,
  pendingUpdateThrottleMs: 100,
  clockTickIntervalMs: 500,
  consentedCloseCode: 1000,
} as const;
