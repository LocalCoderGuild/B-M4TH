import { notifications } from "@mantine/notifications";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  DISPLAY_NAME_MAX_LENGTH,
  displayNameErrorMessage,
  validateDisplayName,
} from "@b-m4th/shared";
import { claimInvite, peekInvite } from "../api/client";
import { joinFromClaim } from "../net/colyseus";
import type { InvitePeekResponse } from "../types";

export function InvitePage() {
  const params = useParams<{ token: string }>();
  const token = params.token ?? "";
  const navigate = useNavigate();
  const [peek, setPeek] = useState<InvitePeekResponse | null>(null);
  const [peekErr, setPeekErr] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [nameErr, setNameErr] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!token) return;
    peekInvite(token)
      .then(setPeek)
      .catch((e) => setPeekErr((e as Error).message));
  }, [token]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedName = validateDisplayName(name);
    if (!parsedName.ok) {
      setNameErr(displayNameErrorMessage(parsedName.error));
      return;
    }
    setNameErr(null);
    setJoining(true);
    try {
      const claim = await claimInvite(token, parsedName.value);
      await joinFromClaim(claim);
      navigate(`/room/${claim.matchId}`, { replace: true });
    } catch (err) {
      notifications.show({
        color: "red",
        title: "Could not join match",
        message: (err as Error).message,
      });
      setJoining(false);
    }
  };

  if (peekErr) {
    return (
      <div className="puzzle-theme-root pixel-page">
        <main className="pixel-shell">
          <div className="pixel-alert pixel-alert-error">Invite not available: {peekErr}</div>
          <button
            type="button"
            className="pixel-btn pixel-btn-swap pixel-btn-block"
            onClick={() => navigate("/")}
          >
            [Back home]
          </button>
        </main>
      </div>
    );
  }

  if (!peek) {
    return (
      <div className="puzzle-theme-root pixel-page">
        <main className="pixel-shell">
          <div className="pixel-loading">
            <span>[ Checking invite… ]</span>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="puzzle-theme-root pixel-page">
      <main className="pixel-shell">
        <header className="pixel-hero">
          <h1 className="pixel-title pixel-title-sm">Join match</h1>
        </header>

        <div className="pixel-card pixel-card-info">
          <div className="pixel-card-label">Match</div>
          <div className="pixel-card-value">
            Hosted by {peek.hostName} · up to {peek.maxPlayers} players
          </div>
        </div>

        <form className="pixel-card" onSubmit={onSubmit}>
          <label className="pixel-field">
            <span>Your display name</span>
            <input
              className="pixel-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Bob"
              maxLength={DISPLAY_NAME_MAX_LENGTH}
              autoFocus
            />
          </label>
          {nameErr && <div className="pixel-alert pixel-alert-warn">{nameErr}</div>}
          <button
            type="submit"
            className="pixel-btn pixel-btn-submit pixel-btn-block"
            disabled={joining}
          >
            {joining ? "[Joining…]" : "[Enter match]"}
          </button>
        </form>
      </main>
    </div>
  );
}
