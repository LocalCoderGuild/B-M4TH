import { randomBytes } from "node:crypto";

export interface Invite {
  token: string;
  matchId: string;
  expiresAt: number;
}

export interface InviteStoreOptions {
  ttlMs?: number;
  sweepIntervalMs?: number;
  now?: () => number;
}

const DEFAULT_TTL_MS = 60 * 60 * 1000;
const DEFAULT_SWEEP_INTERVAL_MS = 5 * 60 * 1000;

function mintToken(): string {
  return randomBytes(32).toString("base64url");
}

export class InviteStore {
  private readonly invites = new Map<string, Invite>();
  private readonly ttlMs: number;
  private readonly now: () => number;
  private sweepTimer?: ReturnType<typeof setInterval>;

  constructor(opts: InviteStoreOptions = {}) {
    this.ttlMs = opts.ttlMs ?? DEFAULT_TTL_MS;
    this.now = opts.now ?? Date.now;
    const interval = opts.sweepIntervalMs ?? DEFAULT_SWEEP_INTERVAL_MS;
    if (interval > 0 && typeof setInterval === "function") {
      this.sweepTimer = setInterval(() => this.sweep(), interval);
      this.sweepTimer.unref?.();
    }
  }

  /** Mint a multi-use invite for a match. Remains valid until TTL, the match
   * starts, or the room fills — whichever comes first. Invalidation is driven
   * by the caller via `revokeMatch` / `revoke`. */
  create(matchId: string): Invite {
    const token = mintToken();
    const invite: Invite = {
      token,
      matchId,
      expiresAt: this.now() + this.ttlMs,
    };
    this.invites.set(token, invite);
    return invite;
  }

  peek(token: string): Invite | null {
    const invite = this.invites.get(token);
    if (!invite) return null;
    if (invite.expiresAt <= this.now()) {
      this.invites.delete(token);
      return null;
    }
    return { ...invite };
  }

  /** Non-destructive claim: returns the invite if still valid. Callers invalidate
   * explicitly via `revokeMatch` (on start/fill). */
  claim(token: string): Invite | null {
    return this.peek(token);
  }

  revoke(token: string): void {
    this.invites.delete(token);
  }

  revokeMatch(matchId: string): void {
    for (const [token, invite] of this.invites) {
      if (invite.matchId === matchId) this.invites.delete(token);
    }
  }

  sweep(): number {
    const cutoff = this.now();
    let removed = 0;
    for (const [token, invite] of this.invites) {
      if (invite.expiresAt <= cutoff) {
        this.invites.delete(token);
        removed++;
      }
    }
    return removed;
  }

  size(): number {
    return this.invites.size;
  }

  dispose(): void {
    if (this.sweepTimer) clearInterval(this.sweepTimer);
    this.invites.clear();
  }
}
