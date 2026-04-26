import { useMemo } from "react";
import { useMatchStore } from "../store/match-store";
import { useIsMyTurn } from "../store/selectors";
import type { TileDto } from "../types";

export function RackStrip() {
  const rack = useMatchStore((s) => s.rack);
  const rackOrder = useMatchStore((s) => s.rackOrder);
  const pending = useMatchStore((s) => s.pending);
  const startDrag = useMatchStore((s) => s.startDrag);
  const endDrag = useMatchStore((s) => s.endDrag);
  const swapMode = useMatchStore((s) => s.swapMode);
  const swapSelected = useMatchStore((s) => s.swapSelected);
  const toggleSwapPick = useMatchStore((s) => s.toggleSwapPick);
  const rackPicked = useMatchStore((s) => s.rackPicked);
  const pickRackTile = useMatchStore((s) => s.pickRackTile);

  const isMyTurn = useIsMyTurn();
  const pendingIds = useMemo(() => new Set(pending.map((p) => p.tileId)), [pending]);

  const ordered = useMemo<TileDto[]>(() => {
    const map = new Map(rack.map((t) => [t.id, t]));
    const out: TileDto[] = [];
    for (const id of rackOrder) {
      const tile = map.get(id);
      if (tile) out.push(tile);
    }
    for (const tile of rack) {
      if (!rackOrder.includes(tile.id)) out.push(tile);
    }
    return out;
  }, [rack, rackOrder]);

  return (
    <div className="rack-strip" aria-label="Your tile rack">
      {ordered.map((tile) => {
        const isPending = pendingIds.has(tile.id);
        const isSwapPicked = swapSelected.includes(tile.id);
        const isRackPicked = rackPicked === tile.id;
        const display = tile.assignedFace || (tile.face === "BLANK" ? "" : tile.face);
        const classes = [
          "rack-tile",
          isPending ? "is-pending" : "",
          isSwapPicked ? "is-swap-pick" : "",
          swapMode ? "in-swap-mode" : "",
          isRackPicked ? "is-rack-pick" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <button
            key={tile.id}
            type="button"
            disabled={isPending && !swapMode}
            className={classes}
            aria-pressed={isSwapPicked || isRackPicked}
            aria-label={`Tile ${display || "blank"}, value ${tile.value}`}
            onPointerDown={() => {
              if (swapMode) return;
              if (isPending) return;
              if (!isMyTurn) return;
              startDrag(tile.id);
            }}
            onPointerUp={() => {
              endDrag();
            }}
            onClick={() => {
              if (swapMode) {
                toggleSwapPick(tile.id);
                return;
              }
              if (isPending) return;
              pickRackTile(tile.id);
            }}
          >
            <span className="rack-tile-face">{display}</span>
            {tile.value > 0 && <span className="rack-tile-value">{tile.value}</span>}
          </button>
        );
      })}
      {ordered.length === 0 && <span className="rack-empty">Rack empty</span>}
    </div>
  );
}
