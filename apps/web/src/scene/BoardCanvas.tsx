import { useEffect, useRef, useState } from "react";
import { SoundManager } from "../audio/SoundManager";
import { useMatchStore, type MatchSnapshot } from "../store/match-store";
import { getPlayerPaletteByKey, isHexColor } from "../ui/player-colors";
import { BoardScene } from "./board-scene";
import { needsAssignment } from "../ui/tile-assignment";
import { BOARD_SIZE, EVENTS } from "../constants";

export function BoardCanvas() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<BoardScene | null>(null);
  const [tooltip, setTooltip] = useState<{
    title: string;
    body: string;
    x: number;
    y: number;
  } | null>(null);

  // Window-level pointerup safety net: if the user releases the pointer
  // outside the Pixi canvas (e.g. between rack and board), reset drag state.
  useEffect(() => {
    const handler = () => {
      const drag = useMatchStore.getState().drag;
      if (drag.tileId) useMatchStore.getState().endDrag();
    };
    window.addEventListener("pointerup", handler);
    window.addEventListener("pointercancel", handler);
    return () => {
      window.removeEventListener("pointerup", handler);
      window.removeEventListener("pointercancel", handler);
    };
  }, []);

  useEffect(() => {
    const show = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          title: string;
          body: string;
          x: number;
          y: number;
        }>
      ).detail;
      if (detail) setTooltip(detail);
    };
    const hide = () => setTooltip(null);
    window.addEventListener(EVENTS.BOARD_TOOLTIP, show);
    window.addEventListener(EVENTS.BOARD_TOOLTIP_HIDE, hide);
    return () => {
      window.removeEventListener(EVENTS.BOARD_TOOLTIP, show);
      window.removeEventListener(EVENTS.BOARD_TOOLTIP_HIDE, hide);
    };
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;
    const gridSize = useMatchStore.getState().snapshot?.boardSize ?? BOARD_SIZE;
    const scene = new BoardScene(host, {
      onCellPointerUp: (row, col) => handleCellPointerUp(row, col),
      onCellPointerEnter: (row, col) =>
        useMatchStore.getState().updateDragHover(row, col),
      onCellPointerLeave: () =>
        useMatchStore.getState().updateDragHover(null, null),
      onPlacedTileClick: () => {
        /* placed tiles aren't interactive during a turn */
      },
      onPendingTileClick: (row, col) => {
        useMatchStore.getState().removePendingAt(row, col);
      },
    }, gridSize);
    sceneRef.current = scene;

    void scene.init().then(() => {
      if (cancelled) scene.destroy();
      const snapshot = useMatchStore.getState().snapshot;
      if (!cancelled && snapshot && isBoardReady(snapshot)) {
        console.info("pixi.BoardCanvas", {
          event: "initialRender",
          phase: snapshot.phase,
          ready: snapshot.ready,
          boardLength: snapshot.board.length,
          turnNumber: snapshot.turnNumber,
        });
        scene.renderBoard(snapshot.board);
        scene.renderPending(useMatchStore.getState().pending);
      }
    });

    const unsubBoard = useMatchStore.subscribe((state, prev) => {
      // Only re-render the board when turnNumber changes: the board only mutates
      // on a successful play, which always advances turnNumber. This avoids
      // redrawing 225 cells on every clock-tick state patch. It's also the
      // correct moment to clear the user's pending placements — the server
      // accepted the play, so any pending tiles are now committed.
      const prevTurn = prev.snapshot?.turnNumber ?? -1;
      const nextTurn = state.snapshot?.turnNumber ?? -1;
      const prevReady = prev.snapshot ? isBoardReady(prev.snapshot) : false;
      const nextReady = state.snapshot ? isBoardReady(state.snapshot) : false;
      if (
        state.snapshot &&
        nextReady &&
        (prevTurn !== nextTurn || !prev.snapshot || !prevReady)
      ) {
        console.info("pixi.BoardCanvas", {
          event: "renderBoard",
          phase: state.snapshot.phase,
          ready: state.snapshot.ready,
          boardLength: state.snapshot.board.length,
          turnNumber: state.snapshot.turnNumber,
        });
        sceneRef.current?.renderBoard(state.snapshot.board);
        // Clear opponent ghosts immediately when the board commits (tiles are now permanent).
        sceneRef.current?.renderOpponentPending([], "");

        const placed = state.snapshot.lastMove?.placedIndices;
        if (placed && placed.length > 0) {
          const actorId = state.snapshot.lastMove?.sessionId;
          const actor = state.snapshot.players.find(
            (p) => p.sessionId === actorId,
          );

          const colorHex = actor
            ? isHexColor(actor.color)
              ? actor.color
              : getPlayerPaletteByKey(actor.color).color
            : "#ffd45c";

          // const colorHex = actor
          //   ? getPlayerPaletteByKey(actor.color).color
          //   : "#ffd45c";

          sceneRef.current?.renderLastMove(placed, colorHex);
          if (prevTurn !== nextTurn) {
            sceneRef.current?.highlightLastPlaced(placed);
            SoundManager.trigger("entry-correct");
          }
        } else {
          sceneRef.current?.renderLastMove([], "");
        }

        if (prev.snapshot && prevTurn !== nextTurn) {
          useMatchStore.getState().clearPending();
        }
      }
      if (state.pending !== prev.pending) {
        sceneRef.current?.renderPending(state.pending);
      }
      if (state.opponentPending !== prev.opponentPending) {
        const activeId = state.snapshot?.currentSessionId;
        const activePalette = state.snapshot?.players.find(
          (p) => p.sessionId === activeId,
        );
        const colorHex = activePalette
          ? getPlayerPaletteByKey(activePalette.color).color
          : "#35f0d0";
        sceneRef.current?.renderOpponentPending(
          state.opponentPending,
          colorHex,
        );
      }
      if (
        state.drag.hoverRow !== prev.drag.hoverRow ||
        state.drag.hoverCol !== prev.drag.hoverCol
      ) {
        if (
          state.drag.tileId &&
          state.drag.hoverRow !== null &&
          state.drag.hoverCol !== null
        ) {
          sceneRef.current?.renderHover({
            row: state.drag.hoverRow,
            col: state.drag.hoverCol,
          });
        } else {
          sceneRef.current?.renderHover(null);
        }
      }
    });

    return () => {
      cancelled = true;
      unsubBoard();
      scene.destroy();
      sceneRef.current = null;
    };
  }, []);

  return (
    <>
      <div
        ref={hostRef}
        className="board-canvas"
        aria-label="Game board canvas"
      />
      {tooltip && (
        <div
          className="board-tooltip"
          style={{ left: tooltip.x + 14, top: tooltip.y + 14 }}
          role="tooltip"
        >
          <strong>{tooltip.title}</strong>
          {tooltip.body}
        </div>
      )}
    </>
  );
}

function isBoardReady(snapshot: MatchSnapshot): boolean {
  return (
    snapshot.ready &&
    snapshot.board.length === snapshot.boardSize * snapshot.boardSize
  );
}

function handleCellPointerUp(row: number, col: number): void {
  const store = useMatchStore.getState();
  const drag = store.drag;
  if (!drag.tileId) return;

  // Reject placement on an occupied cell (including other pending tiles).
  const snapshot = store.snapshot;
  if (snapshot) {
    const idx = row * snapshot.boardSize + col;
    const occupied = snapshot.board[idx]?.tile;
    if (occupied) {
      store.endDrag();
      return;
    }
  }
  const conflicting = store.pending.find((p) => p.row === row && p.col === col);
  if (conflicting) {
    store.endDrag();
    return;
  }

  const tile = store.rack.find((t) => t.id === drag.tileId);
  if (!tile) {
    store.endDrag();
    return;
  }

  if (needsAssignment(tile)) {
    // Defer: drag end is captured but placement requires a face choice.
    store.endDrag();
    window.dispatchEvent(
      new CustomEvent(EVENTS.ASSIGN_TILE, {
        detail: { tileId: tile.id, row, col, face: tile.face },
      }),
    );
    return;
  }

  store.addPending({
    tileId: tile.id,
    row,
    col,
    face: tile.face,
    assignedFace: tile.assignedFace ?? undefined,
    value: tile.value,
  });
  SoundManager.trigger("cell-select");
  store.endDrag();
}
