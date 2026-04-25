import { useMatchStore } from "../store/match-store";
import { getPlayerColorVars } from "./player-colors";

function formatMs(ms: number): string {
  const clamped = Math.max(0, ms);
  const totalSec = Math.floor(clamped / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function ScorePanel() {
  const snapshot = useMatchStore((s) => s.snapshot);
  const mySessionId = useMatchStore((s) => s.mySessionId);

  if (!snapshot) {
    return (
      <div className="score-list">
        <div className="score-empty">Waiting for match state…</div>
      </div>
    );
  }

  const bankTotalMs = Math.max(1, snapshot.baseMinutes) * 60 * 1000;
  const turnLimitMs = Math.max(1, snapshot.turnMinutes) * 60 * 1000;
  const ordered = [...snapshot.players].sort((a, b) => a.seatIndex - b.seatIndex);

  return (
    <div className="score-list">
      {ordered.map((p) => {
        const isYou = p.sessionId === mySessionId;
        const isTurn = p.sessionId === snapshot.currentSessionId && snapshot.phase === "playing";
        const liveBank = isTurn ? Math.max(0, p.bankRemainingMs - p.turnElapsedMs) : p.bankRemainingMs;
        const bankPct = Math.max(0, Math.min(100, (liveBank / bankTotalMs) * 100));
        const low = bankPct < 15;
        const turnBudgetMs = Math.min(turnLimitMs, p.bankRemainingMs);
        const turnRemainingMs = isTurn ? Math.max(0, turnBudgetMs - p.turnElapsedMs) : turnBudgetMs;
        const turnOverageMs = isTurn ? Math.max(0, p.turnElapsedMs - turnBudgetMs) : 0;
        const colorVars = getPlayerColorVars(p.seatIndex, p.color);
        return (
          <div
            key={p.sessionId}
            className="score-row"
            data-active={isTurn}
            style={colorVars}
          >
            <div className="score-avatar" aria-hidden="true" />
            <div className="score-player">
              <div className="score-name">
                <span className="score-player-label">P{p.seatIndex + 1}</span>
                <strong title={p.name}>
                  {p.name}
                  {isYou ? " (you)" : ""}
                </strong>
              </div>
              <div className="score-clock">
                <div className="score-clock-bar" aria-hidden="true">
                  <div
                    className="score-clock-fill"
                    data-low={low}
                    style={{ width: `${bankPct}%` }}
                  />
                </div>
                <span className="score-clock-text">{formatMs(liveBank)}</span>
              </div>
              <div className="score-turn-clock" data-over={turnOverageMs > 0}>
                <span className="score-turn-label">Turn</span>
                <strong>{turnOverageMs > 0 ? `+${formatMs(turnOverageMs)}` : formatMs(turnRemainingMs)}</strong>
              </div>
            </div>
            <div className="score-meta">
              <strong>{p.score}</strong>
              <div className="score-badges">
                {isTurn && <span className="pixel-chip chip-turn">TURN</span>}
                {!p.connected && <span className="pixel-chip chip-off">OFF</span>}
              </div>
            </div>
            {p.overtimePenalty > 0 && (
              <div className="score-penalty">-{p.overtimePenalty}</div>
            )}
          </div>
        );
      })}
      {snapshot.phase === "finished" && (
        <div className="score-row score-row-finished">
          <strong>Game over</strong>
          <span>
            Winner:{" "}
            {snapshot.players.find((p) => p.sessionId === snapshot.winnerSessionId)?.name ?? "—"}
          </span>
        </div>
      )}
    </div>
  );
}
