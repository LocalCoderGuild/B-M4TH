import { useEffect, useRef } from "react";
import { useMatchStore } from "../store/match-store";
import { getPlayerColorVars } from "./player-colors";

function formatAction(action: string, scoreDelta: number): string {
  if (action === "pass") return "pass";
  if (action === "swap") return "swap";
  if (action === "play") return `+${scoreDelta} pts`;
  return action;
}

export function TurnLog() {
  const turnLog = useMatchStore((s) => s.turnLog);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [turnLog.length]);

  if (turnLog.length === 0) return null;

  return (
    <div className="turn-log" aria-label="Turn history">
      <div className="turn-log-header">[ Log ]</div>
      <div className="turn-log-entries" ref={scrollRef}>
        {turnLog.map((entry) => (
          <div
            key={entry.id}
            className="turn-log-entry"
            style={getPlayerColorVars(entry.seatIndex, entry.playerColor)}
          >
            <span className="turn-log-name">{entry.playerName}</span>
            <span className="turn-log-value">{formatAction(entry.action, entry.scoreDelta)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
