import { notifications } from "@mantine/notifications";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createMatch } from "../api/client";
import { joinHostReservation } from "../net/colyseus";
import { useMatchStore } from "../store/match-store";

const PLAYER_COUNT_OPTIONS = [2, 3, 4, 5, 6] as const;

export function HomePage() {
  const navigate = useNavigate();
  const [hostName, setHostName] = useState("");
  const [maxPlayers, setMaxPlayers] = useState<number>(2);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = hostName.trim();
    if (trimmed.length === 0) {
      setError("Enter a name");
      return;
    }
    if (trimmed.length > 40) {
      setError("Too long");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const match = await createMatch(trimmed, { maxPlayers });
      await joinHostReservation(match.hostReservation);
      useMatchStore.getState().setGuestInviteLink(match.inviteLink);
      navigate(`/room/${match.matchId}`, { replace: true });
    } catch (err) {
      notifications.show({
        color: "red",
        title: "Could not create match",
        message: (err as Error).message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="puzzle-theme-root pixel-page">
      <main className="pixel-shell">
        <header className="pixel-hero">
          <span className="pixel-badge pixel-badge-lg" aria-hidden="true" />
          <h1 className="pixel-title">B-M4TH</h1>
          <p className="pixel-subtitle">
            Math-equation board game for 2–6 players. Invite by magic link.
          </p>
        </header>

        <form className="pixel-card" onSubmit={onSubmit}>
          <label className="pixel-field">
            <span>Your display name</span>
            <input
              className="pixel-input"
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
              placeholder="e.g. Alice"
              maxLength={40}
              autoFocus
            />
          </label>
          <div className="pixel-field">
            <span>Players</span>
            <div
              className="pixel-chip-row"
              role="radiogroup"
              aria-label="Max players"
            >
              {PLAYER_COUNT_OPTIONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={maxPlayers === n}
                  className={`pixel-btn pixel-btn-tc${maxPlayers === n ? " is-active" : ""}`}
                  onClick={() => setMaxPlayers(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          {error && <div className="pixel-alert pixel-alert-warn">{error}</div>}
          <button
            type="submit"
            className="pixel-btn pixel-btn-submit pixel-btn-block"
            disabled={submitting}
          >
            {submitting ? "[Creating…]" : "[+ Create match]"}
          </button>
        </form>
      </main>
    </div>
  );
}
