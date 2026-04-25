import { useEffect, useMemo, useState } from "react";
import { useMatchStore } from "../store/match-store";
import { sendPickColor, sendSetTimeControl, sendStartMatch } from "../net/colyseus";
import { InviteShare } from "./InviteShare";
import {
  PLAYER_COLOR_KEYS,
  getPlayerColorVars,
  getSwatchHex,
  resolvePlayerColorKey,
  type PlayerColorKey,
} from "./player-colors";

interface Preset {
  label: string;
  baseMinutes: number;
  incrementSeconds: number;
}

const PRESETS: Preset[] = [
  { label: "3+0", baseMinutes: 3, incrementSeconds: 0 },
  { label: "5+0", baseMinutes: 5, incrementSeconds: 0 },
  { label: "5+3", baseMinutes: 5, incrementSeconds: 3 },
  { label: "10+5", baseMinutes: 10, incrementSeconds: 5 },
  { label: "15+10", baseMinutes: 15, incrementSeconds: 10 },
];
const TURN_PRESETS = [1, 2, 3, 5] as const;

export function LobbyView() {
  const snapshot = useMatchStore((s) => s.snapshot);
  const mySessionId = useMatchStore((s) => s.mySessionId);
  const guestInviteLink = useMatchStore((s) => s.guestInviteLink);

  const isHost = Boolean(snapshot && mySessionId && snapshot.hostSessionId === mySessionId);
  const maxPlayers = snapshot?.maxPlayers ?? 2;
  const minPlayers = snapshot?.minPlayers ?? 2;
  const canStart = Boolean(
    snapshot && snapshot.players.length >= minPlayers && isHost,
  );
  const orderedPlayers = snapshot
    ? [...snapshot.players].sort((a, b) => a.seatIndex - b.seatIndex)
    : [];
  const emptySeats = Math.max(0, maxPlayers - orderedPlayers.length);

  const base = snapshot?.baseMinutes ?? 10;
  const inc = snapshot?.incrementSeconds ?? 0;
  const turnMinutes = snapshot?.turnMinutes ?? 3;
  const activePresetLabel = useMemo(() => {
    const match = PRESETS.find((p) => p.baseMinutes === base && p.incrementSeconds === inc);
    return match?.label ?? "Custom";
  }, [base, inc]);

  const [customBase, setCustomBase] = useState<number>(base);
  const [customInc, setCustomInc] = useState<number>(inc);
  const [customTurnMinutes, setCustomTurnMinutes] = useState<number>(turnMinutes);
  const [showCustom, setShowCustom] = useState(false);

  useEffect(() => {
    setCustomBase(base);
    setCustomInc(inc);
    setCustomTurnMinutes(turnMinutes);
  }, [base, inc, turnMinutes]);

  const applyPreset = (preset: Preset): void => {
    if (!isHost) return;
    sendSetTimeControl({
      baseMinutes: preset.baseMinutes,
      incrementSeconds: preset.incrementSeconds,
      turnMinutes,
    });
    setShowCustom(false);
  };

  const applyCustom = (): void => {
    if (!isHost) return;
    const b = Math.max(1, Math.min(90, Math.round(customBase)));
    const i = Math.max(0, Math.min(60, Math.round(customInc)));
    const t = Math.max(1, Math.min(90, Math.round(customTurnMinutes)));
    sendSetTimeControl({ baseMinutes: b, incrementSeconds: i, turnMinutes: t });
  };

  const applyTurnPreset = (minutes: number): void => {
    if (!isHost) return;
    sendSetTimeControl({ baseMinutes: base, incrementSeconds: inc, turnMinutes: minutes });
  };

  const me = snapshot?.players.find((p) => p.sessionId === mySessionId);
  const myColorKey: PlayerColorKey | null = me
    ? resolvePlayerColorKey(me.color, me.seatIndex)
    : null;
  const takenByOthers = new Set<string>();
  for (const p of snapshot?.players ?? []) {
    if (p.sessionId !== mySessionId && p.color) takenByOthers.add(p.color);
  }

  if (!snapshot) return null;

  return (
    <div className="lobby-view">
      <header className="lobby-header">
        <h1 className="lobby-title">Lobby</h1>
        <p className="lobby-subtitle">
          {isHost ? "Share the link, pick a clock, then start." : "Waiting for host to start the match."}
        </p>
      </header>

      <section className="lobby-section">
        <h2 className="lobby-section-title">
          Players ({orderedPlayers.length}/{maxPlayers})
        </h2>
        <ul className="lobby-players">
          {orderedPlayers.map((p) => (
            <li
              key={p.sessionId}
              className="lobby-player"
              style={getPlayerColorVars(p.seatIndex, p.color)}
            >
              <span className="lobby-player-slot">[P{p.seatIndex + 1}]</span>
              <span className="lobby-player-name">{p.name || "—"}</span>
              {p.sessionId === snapshot.hostSessionId && <span className="lobby-player-tag">HOST</span>}
              {p.sessionId === mySessionId && <span className="lobby-player-tag">YOU</span>}
            </li>
          ))}
          {Array.from({ length: emptySeats }).map((_, i) => (
            <li key={`empty-${i}`} className="lobby-player lobby-player-empty">
              <span className="lobby-player-slot">
                [P{orderedPlayers.length + i + 1}]
              </span>
              <span className="lobby-player-name">Waiting…</span>
            </li>
          ))}
        </ul>
      </section>

      {me && (
        <section className="lobby-section">
          <h2 className="lobby-section-title">Your color</h2>
          <div className="lobby-color-grid" role="radiogroup" aria-label="Player color">
            {PLAYER_COLOR_KEYS.map((key) => {
              const taken = takenByOthers.has(key);
              const selected = myColorKey === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={key}
                  title={taken && !selected ? `${key} (taken)` : key}
                  className={`lobby-color-swatch${selected ? " is-selected" : ""}${taken && !selected ? " is-taken" : ""}`}
                  style={{ background: getSwatchHex(key) }}
                  disabled={taken && !selected}
                  onClick={() => {
                    if (!selected) sendPickColor(key);
                  }}
                />
              );
            })}
          </div>
        </section>
      )}

      {guestInviteLink && isHost && (
        <section className="lobby-section">
          <InviteShare label="Guest link" link={guestInviteLink} />
        </section>
      )}

      <section className="lobby-section">
        <h2 className="lobby-section-title">
          Time control <span className="lobby-tc-active">[{activePresetLabel}]</span>
        </h2>
        <div className="lobby-tc-grid">
          {PRESETS.map((preset) => {
            const active = preset.baseMinutes === base && preset.incrementSeconds === inc;
            return (
              <button
                key={preset.label}
                type="button"
                disabled={!isHost}
                className={`pixel-btn pixel-btn-tc${active ? " is-active" : ""}`}
                onClick={() => applyPreset(preset)}
              >
                {preset.label}
              </button>
            );
          })}
          <button
            type="button"
            disabled={!isHost}
            className={`pixel-btn pixel-btn-tc${showCustom || activePresetLabel === "Custom" ? " is-active" : ""}`}
            onClick={() => setShowCustom((v) => !v)}
          >
            Custom
          </button>
        </div>

        {(showCustom || activePresetLabel === "Custom") && (
          <div className="lobby-tc-custom">
            <label className="lobby-tc-field">
              <span>Base (min)</span>
              <input
                type="number"
                className="pixel-input"
                min={1}
                max={90}
                disabled={!isHost}
                value={customBase}
                onChange={(e) => setCustomBase(Number(e.target.value))}
              />
            </label>
            <label className="lobby-tc-field">
              <span>Inc (sec)</span>
              <input
                type="number"
                className="pixel-input"
                min={0}
                max={60}
                disabled={!isHost}
                value={customInc}
                onChange={(e) => setCustomInc(Number(e.target.value))}
              />
            </label>
            <label className="lobby-tc-field">
              <span>Turn (min)</span>
              <input
                type="number"
                className="pixel-input"
                min={1}
                max={90}
                disabled={!isHost}
                value={customTurnMinutes}
                onChange={(e) => setCustomTurnMinutes(Number(e.target.value))}
              />
            </label>
            <button
              type="button"
              disabled={!isHost}
              className="pixel-btn pixel-btn-submit"
              onClick={applyCustom}
            >
              Apply
            </button>
          </div>
        )}
      </section>

      <section className="lobby-section">
        <h2 className="lobby-section-title">
          Per-turn timer <span className="lobby-tc-active">[{turnMinutes}m]</span>
        </h2>
        <div className="lobby-tc-grid">
          {TURN_PRESETS.map((minutes) => (
            <button
              key={minutes}
              type="button"
              disabled={!isHost}
              className={`pixel-btn pixel-btn-tc${turnMinutes === minutes ? " is-active" : ""}`}
              onClick={() => applyTurnPreset(minutes)}
            >
              {minutes}m
            </button>
          ))}
        </div>
      </section>

      <section className="lobby-section lobby-actions">
        {isHost ? (
          <button
            type="button"
            className="pixel-btn pixel-btn-submit lobby-start"
            disabled={!canStart}
            onClick={() => sendStartMatch()}
          >
            {canStart
              ? "[ Start Match ]"
              : `[ Need ${Math.max(0, minPlayers - orderedPlayers.length)} more ]`}
          </button>
        ) : (
          <div className="pixel-alert pixel-alert-info">The host will start the match.</div>
        )}
      </section>
    </div>
  );
}
