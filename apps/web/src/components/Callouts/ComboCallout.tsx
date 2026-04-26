import { useEffect, useState } from "react";
import { SoundManager } from "../../audio/SoundManager";
import { dispatchPuzzleEffect } from "../PixiStage";
import { EVENTS } from "../../constants";

const DEFAULT_MESSAGES = ["Nice!", "Great!", "Awesome!", "Perfect!"];

export interface ComboCalloutEvent {
  level: number;
  message?: string;
  x?: number;
  y?: number;
}

export function showComboCallout(detail: ComboCalloutEvent): void {
  window.dispatchEvent(new CustomEvent<ComboCalloutEvent>(EVENTS.COMBO_CALLOUT, { detail }));
}

export function ComboCallout({ messages = DEFAULT_MESSAGES }: { messages?: string[] }) {
  const [callout, setCallout] = useState<ComboCalloutEvent | null>(null);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<ComboCalloutEvent>).detail;
      if (!detail) return;
      setCallout(detail);
      SoundManager.trigger("combo");
      dispatchPuzzleEffect({ type: "combo", level: detail.level, x: detail.x, y: detail.y });
      window.setTimeout(() => setCallout((current) => (current === detail ? null : current)), 900);
    };
    window.addEventListener(EVENTS.COMBO_CALLOUT, handler);
    return () => window.removeEventListener(EVENTS.COMBO_CALLOUT, handler);
  }, []);

  if (!callout) return null;

  const fallback = messages[Math.min(messages.length - 1, Math.max(0, callout.level - 1))] ?? "Nice!";

  return (
    <div className="combo-callout" role="status" aria-live="polite">
      <span>{callout.message ?? fallback}</span>
      <small>Combo x{callout.level}</small>
    </div>
  );
}
