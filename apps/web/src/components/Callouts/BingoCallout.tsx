import { useEffect, useState } from "react";
import { SoundManager } from "../../audio/SoundManager";
import { dispatchPuzzleEffect } from "../PixiStage";
import { EVENTS } from "../../constants";

export function showBingoCallout(): void {
  window.dispatchEvent(new CustomEvent(EVENTS.BINGO_CALLOUT));
}

export function BingoCallout() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = () => {
      setVisible(true);
      SoundManager.trigger("bingo");
      dispatchPuzzleEffect({ type: "bingo" });
      window.setTimeout(() => setVisible(false), 1200);
    };
    window.addEventListener(EVENTS.BINGO_CALLOUT, handler);
    return () => window.removeEventListener(EVENTS.BINGO_CALLOUT, handler);
  }, []);

  if (!visible) return null;
  return (
    <div className="bingo-callout" role="status" aria-live="assertive">
      BINGO!
    </div>
  );
}
