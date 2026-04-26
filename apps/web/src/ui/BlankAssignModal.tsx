import { useEffect, useState } from "react";
import { useMatchStore } from "../store/match-store";
import { getAssignmentDescription, getAssignmentGroups, getAssignmentTitle } from "./tile-assignment";
import { EVENTS } from "../constants";

interface AssignContext {
  tileId: string;
  row: number;
  col: number;
  face: string;
}

export function BlankAssignModal() {
  const [open, setOpen] = useState(false);
  const [context, setContext] = useState<AssignContext | null>(null);
  const addPending = useMatchStore((s) => s.addPending);
  const rack = useMatchStore((s) => s.rack);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<AssignContext>).detail;
      if (!getAssignmentGroups(detail.face)) return;
      setContext(detail);
      setOpen(true);
    };
    window.addEventListener(EVENTS.ASSIGN_TILE, handler);
    return () => window.removeEventListener(EVENTS.ASSIGN_TILE, handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const choose = (face: string) => {
    if (!context) return;
    const tile = rack.find((t) => t.id === context.tileId);
    if (!tile) {
      close();
      return;
    }
    addPending({
      tileId: tile.id,
      row: context.row,
      col: context.col,
      face: tile.face,
      assignedFace: face,
      value: tile.value,
    });
    close();
  };

  const close = () => {
    setOpen(false);
    setContext(null);
  };

  if (!open || !context) return null;

  const groups = getAssignmentGroups(context.face);
  const title = getAssignmentTitle(context.face);
  const description = getAssignmentDescription(context.face);

  return (
    <div className="pixel-modal-backdrop" onPointerDown={close}>
      <div
        className="pixel-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="pixel-modal-header">
          <strong>{title}</strong>
          <button type="button" className="pixel-btn-ghost" onClick={close} aria-label="Close">
            [X]
          </button>
        </div>
        <p className="pixel-modal-desc">{description}</p>
        {(groups ?? []).map((group) => (
          <div key={group.label} className="pixel-assign-group">
            <div className="pixel-assign-label">{group.label}</div>
            <div className={`pixel-assign-grid ${group.label === "Numbers" ? "is-numbers" : ""}`}>
              {group.options.map((option) => (
                <button
                  key={option}
                  type="button"
                  className="pixel-btn pixel-btn-assign"
                  onClick={() => choose(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
