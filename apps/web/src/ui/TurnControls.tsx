import { useEffect, useRef } from "react";
import { useMatchStore } from "../store/match-store";
import { useIsMyTurn } from "../store/selectors";
import { sendPass, sendPendingUpdate, sendPlay, sendSwap } from "../net/colyseus";

export function TurnControls() {
  const pending = useMatchStore((s) => s.pending);
  const clearPending = useMatchStore((s) => s.clearPending);
  const swapMode = useMatchStore((s) => s.swapMode);
  const swapSelected = useMatchStore((s) => s.swapSelected);
  const setSwapMode = useMatchStore((s) => s.setSwapMode);
  const previewScore = useMatchStore((s) => s.previewScore);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => sendPendingUpdate(pending), 100);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [pending]);

  const isMyTurn = useIsMyTurn();

  const onSubmit = () => {
    if (pending.length === 0) return;
    sendPlay(
      pending.map((p) => ({
        tileId: p.tileId,
        position: { row: p.row, col: p.col },
        assignedFace: p.assignedFace,
      })),
    );
  };

  const onSwap = () => {
    if (swapMode) {
      if (swapSelected.length === 0) {
        setSwapMode(false);
        return;
      }
      sendSwap(swapSelected);
      setSwapMode(false);
      return;
    }
    setSwapMode(true);
  };

  const onPass = () => {
    if (!isMyTurn || pending.length > 0) return;
    sendPass();
  };

  const onRecall = () => {
    if (pending.length === 0) return;
    clearPending();
  };

  const submitDisabled = !isMyTurn || pending.length === 0 || swapMode;
  const recallDisabled = pending.length === 0 || swapMode;
  const passDisabled = !isMyTurn || pending.length > 0 || swapMode;
  const swapDisabled = !isMyTurn || pending.length > 0;

  const swapLabel = swapMode
    ? swapSelected.length > 0
      ? `[Swap ${swapSelected.length}]`
      : "[Cancel]"
    : "[Swap]";

  return (
    <div className="turn-controls" aria-label="Turn actions">
      {isMyTurn && pending.length > 0 && (
        <div className="score-preview" aria-live="polite">
          {previewScore !== null ? `+${previewScore} pts` : "…"}
        </div>
      )}
      <button
        type="button"
        className="pixel-btn pixel-btn-swap"
        onClick={onSwap}
        disabled={swapDisabled}
      >
        {swapLabel}
      </button>
      <button
        type="button"
        className="pixel-btn pixel-btn-pass"
        onClick={onPass}
        disabled={passDisabled}
      >
        [Pass]
      </button>
      <button
        type="button"
        className="pixel-btn pixel-btn-recall"
        onClick={onRecall}
        disabled={recallDisabled}
      >
        [Recall]
      </button>
      <button
        type="button"
        className="pixel-btn pixel-btn-submit"
        onClick={onSubmit}
        disabled={submitDisabled}
      >
        [Submit{pending.length > 0 ? ` ${pending.length}` : ""}]
      </button>
    </div>
  );
}
