import { randomBytes } from "node:crypto";
import { INVITE_TTL_MS } from "@entities";
import { TtlMap, type TtlMapOptions } from "./ttl-map";

export interface Invite {
  token: string;
  matchId: string;
  expiresAt: number;
}

export type InviteStoreOptions = TtlMapOptions & { ttlMs?: number };

function mintToken(): string {
  return randomBytes(32).toString("base64url");
}

export class InviteStore extends TtlMap<Invite> {
  constructor(opts: InviteStoreOptions = {}) {
    super(opts.ttlMs ?? INVITE_TTL_MS, opts);
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
    this.set(token, invite);
    return invite;
  }

  peek(token: string): Invite | null {
    const invite = this.getEntry(token);
    return invite ? { ...invite } : null;
  }

  /** Non-destructive claim: returns the invite if still valid. Callers invalidate
   * explicitly via `revokeMatch` (on start/fill). */
  claim(token: string): Invite | null {
    return this.peek(token);
  }

  revoke(token: string): void {
    this.deleteEntry(token);
  }

  revokeMatch(matchId: string): void {
    for (const [token, entry] of this.store) {
      if (entry.value.matchId === matchId) this.store.delete(token);
    }
  }
}
