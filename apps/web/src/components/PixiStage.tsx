import { useEffect, useRef } from "react";
import { createPixiApp } from "../pixi/createPixiApp";
import { PuzzleStageBackground, type PuzzleStageOptions } from "../pixi/scenes/PuzzleStageBackground";
import { EVENTS } from "../constants";

export type PuzzleEffectEvent =
  | { type: "cell-select"; x: number; y: number }
  | { type: "entry-correct"; x: number; y: number }
  | { type: "entry-wrong"; x: number; y: number }
  | { type: "combo"; level: number; x?: number; y?: number }
  | { type: "bingo" }
  | { type: "puzzle-complete" };

export function dispatchPuzzleEffect(detail: PuzzleEffectEvent): void {
  window.dispatchEvent(new CustomEvent<PuzzleEffectEvent>(EVENTS.PUZZLE_EFFECT, { detail }));
}

interface PixiStageProps {
  options: PuzzleStageOptions;
}

export function PixiStage({ options }: PixiStageProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<PuzzleStageBackground | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let appRef: Awaited<ReturnType<typeof createPixiApp>> | null = null;
    let removeVisibility = () => {};
    let resizeObserver: ResizeObserver | null = null;

    void createPixiApp({ host }).then((app) => {
      if (disposed) {
        app.destroy(true);
        return;
      }

      appRef = app;
      host.replaceChildren(app.canvas);
      const scene = new PuzzleStageBackground(app, options);
      sceneRef.current = scene;
      app.ticker.add((ticker) => scene.update(ticker));

      resizeObserver = new ResizeObserver(() => scene.resize());
      resizeObserver.observe(host);

      const onVisibility = () => {
        if (document.hidden) app.ticker.stop();
        else app.ticker.start();
      };
      document.addEventListener("visibilitychange", onVisibility);
      removeVisibility = () => document.removeEventListener("visibilitychange", onVisibility);
    });

    return () => {
      disposed = true;
      removeVisibility();
      resizeObserver?.disconnect();
      sceneRef.current?.destroy();
      sceneRef.current = null;
      appRef?.destroy(true);
      appRef = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.setOptions(options);
  }, [options]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<PuzzleEffectEvent>).detail;
      const scene = sceneRef.current;
      if (!scene || !detail) return;
      if (detail.type === "cell-select") scene.onCellSelect(detail.x, detail.y);
      else if (detail.type === "entry-correct") scene.onEntryCorrect(detail.x, detail.y);
      else if (detail.type === "entry-wrong") scene.onEntryWrong(detail.x, detail.y);
      else if (detail.type === "combo") scene.onCombo(detail.level, detail.x, detail.y);
      else if (detail.type === "bingo") scene.onBingo();
      else if (detail.type === "puzzle-complete") scene.onPuzzleComplete();
    };
    window.addEventListener(EVENTS.PUZZLE_EFFECT, handler);
    return () => window.removeEventListener(EVENTS.PUZZLE_EFFECT, handler);
  }, []);

  return <div ref={hostRef} className="puzzle-pixi-stage" aria-hidden="true" />;
}
