import { env } from "../env";
import { createLogger } from "@b-m4th/shared";

const clientLog = createLogger("colyseus.client");
import type {
  ClaimResponse,
  CreateMatchResponse,
  InvitePeekResponse,
} from "../types";

const SERVER_URL = env.VITE_API_URL;
// (import.meta.env.VITE_SERVER_URL as string | undefined) ?? "http://localhost:2567";

export const SERVER_ORIGIN = SERVER_URL.replace(/\/$/, "");

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body?.error ?? body?.message ?? "";
    } catch (err) {
      clientLog("http.error.parse_failed", {
        status: res.status,
        error: err instanceof Error ? err.message : String(err),
      });
      detail = await res.text().catch((textErr) => {
        clientLog("http.error.read_text_failed", {
          status: res.status,
          error: textErr instanceof Error ? textErr.message : String(textErr),
        });
        return `Request failed (${res.status})`;
      });
    }
    throw new Error(detail || `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export async function createMatch(
  hostName: string,
  opts: { maxPlayers?: number } = {},
): Promise<CreateMatchResponse> {
  clientLog("match.create.request");
  const body: Record<string, unknown> = { hostName };
  if (opts.maxPlayers !== undefined) body.maxPlayers = opts.maxPlayers;
  const res = await fetch(`${SERVER_ORIGIN}/api/matches`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return json<CreateMatchResponse>(res);
}

export async function peekInvite(token: string): Promise<InvitePeekResponse> {
  const res = await fetch(
    `${SERVER_ORIGIN}/api/invites/${encodeURIComponent(token)}`,
  );
  return json<InvitePeekResponse>(res);
}

export async function claimInvite(
  token: string,
  name: string,
): Promise<ClaimResponse> {
  clientLog("invite.claim.request");
  const res = await fetch(
    `${SERVER_ORIGIN}/api/invites/${encodeURIComponent(token)}/claim`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    },
  );
  return json<ClaimResponse>(res);
}
