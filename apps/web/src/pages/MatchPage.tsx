import { notifications } from "@mantine/notifications";
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { BingoCallout } from "../components/Callouts/BingoCallout";
import { ComboCallout } from "../components/Callouts/ComboCallout";
import { PuzzleLeagueSkin } from "../components/Grid/PuzzleLeagueSkin";
import { PixiStage, dispatchPuzzleEffect } from "../components/PixiStage";
import { SoundManager } from "../audio/SoundManager";
import { BoardCanvas } from "../scene/BoardCanvas";
import { BoardErrorBoundary } from "../scene/BoardErrorBoundary";
import { useMatchStore } from "../store/match-store";
import { currentRoom, leaveRoom, tryReconnect } from "../net/colyseus";
import { BlankAssignModal } from "../ui/BlankAssignModal";
import { InviteShare } from "../ui/InviteShare";
import { LobbyView } from "../ui/LobbyView";
import { RackStrip } from "../ui/RackStrip";
import { ScorePanel } from "../ui/ScorePanel";
import { TurnControls } from "../ui/TurnControls";
import { TurnLog } from "../ui/TurnLog";

export function MatchPage() {
  const navigate = useNavigate();
  const snapshot = useMatchStore((s) => s.snapshot);
  const connected = useMatchStore((s) => s.connected);
  const lastError = useMatchStore((s) => s.lastError);
  const setError = useMatchStore((s) => s.setError);
  const guestInviteLink = useMatchStore((s) => s.guestInviteLink);
  const previousPhaseRef = useRef(snapshot?.phase);

  useEffect(() => {
    if (lastError) {
      SoundManager.trigger("entry-wrong");
      notifications.show({
        color: "red",
        title: lastError.code,
        message: lastError.message,
        autoClose: 2500,
      });
      setError(null);
    }
  }, [lastError, setError]);

  useEffect(() => {
    if (!currentRoom()) {
      void tryReconnect().then((room) => {
        if (!room) navigate("/", { replace: true });
      });
    }
  }, [navigate]);

  useEffect(() => {
    if (previousPhaseRef.current !== "finished" && snapshot?.phase === "finished") {
      SoundManager.trigger("puzzle-complete");
      dispatchPuzzleEffect({ type: "puzzle-complete" });
    }
    previousPhaseRef.current = snapshot?.phase;
  }, [snapshot?.phase]);

  if (!snapshot) {
    return (
      <div className="pixel-loading">
        <span>[ Connecting… ]</span>
      </div>
    );
  }

  const inLobby = snapshot.phase === "waiting" && !snapshot.started;
  const waitingForOpponent = snapshot.phase === "waiting" || snapshot.players.length < 2;

  if (inLobby) {
    return (
      <div className="puzzle-theme-root pixel-page">
        <PixiStage options={{ intensity: 0.25, dither: true, vignette: true }} />
        <div className="lobby-stage">
          <LobbyView />
        </div>
      </div>
    );
  }

  return (
    <div className="puzzle-theme-root">
      <PixiStage options={{ intensity: 0.35, dither: true, vignette: true }} />
      <ComboCallout />
      <BingoCallout />

      <div className="game-shell">
        <aside className="game-sidebar">
          <header className="game-brand">
            <span className="pixel-badge" aria-hidden="true" />
            <span className="game-brand-name">B-M4TH</span>
            <button
              type="button"
              className="pixel-btn-ghost game-leave"
              onClick={() => {
                leaveRoom();
                navigate("/");
              }}
            >
              [Leave]
            </button>
          </header>

          <div className="hud-stat-grid">
            <div className="hud-stat">
              <strong>{snapshot.turnNumber}</strong>
              <span>Turn</span>
            </div>
            <div className="hud-stat">
              <strong>{snapshot.bagRemaining}</strong>
              <span>Bag</span>
            </div>
          </div>

          <ScorePanel />

          {!connected && <div className="pixel-alert pixel-alert-warn">Reconnecting…</div>}
          {waitingForOpponent && (
            <div className="pixel-alert pixel-alert-info">
              Waiting for the other player to join.
            </div>
          )}
          {waitingForOpponent && guestInviteLink && (
            <InviteShare label="Opponent link" link={guestInviteLink} />
          )}
        </aside>

        <main className="game-board">
          <PuzzleLeagueSkin>
            <BoardErrorBoundary>
              <BoardCanvas />
            </BoardErrorBoundary>
          </PuzzleLeagueSkin>
          <TurnLog />
        </main>

        <footer className="game-actionbar">
          <div className="actionbar-rack">
            <RackStrip />
          </div>
          <div className="actionbar-controls">
            <TurnControls />
          </div>
        </footer>

        <BlankAssignModal />
      </div>
    </div>
  );
}
