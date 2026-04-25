import { useEffect, useState } from "react";
import { SoundManager } from "../../audio/SoundManager";
import { dispatchPuzzleEffect } from "../PixiStage";

export function showBingoCallout(): void {
  window.dispatchEvent(new CustomEvent("b-m4th:bingo-callout"));
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
    window.addEventListener("b-m4th:bingo-callout", handler);
    return () => window.removeEventListener("b-m4th:bingo-callout", handler);
  }, []);

  if (!visible) return null;
  return (
    <div className="bingo-callout" role="status" aria-live="assertive">
      BINGO!
    </div>
  );
}
