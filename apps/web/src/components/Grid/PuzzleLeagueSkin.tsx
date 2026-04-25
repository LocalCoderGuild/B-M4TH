import type { ReactNode } from "react";

interface PuzzleLeagueSkinProps {
  children: ReactNode;
}

export function PuzzleLeagueSkin({ children }: PuzzleLeagueSkinProps) {
  return (
    <section className="board-stage pixel-panel" aria-label="Puzzle board">
      <div className="board-stage-inner">{children}</div>
    </section>
  );
}
