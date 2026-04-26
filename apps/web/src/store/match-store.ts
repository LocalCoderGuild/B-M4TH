import { create } from "zustand";
import type { ErrorMessage, PendingPlacement, Phase, TileDto } from "../types";
import type {
  BoardCellDto as BoardCellView,
  PlayerDto as PlayerSnapshot,
  LastMoveDto as LastMoveSnapshot,
  MatchStateDto as MatchSnapshot,
} from "@b-m4th/shared";

export interface TurnLogEntry {
  id: number;
  turnNumber: number;
  playerName: string;
  seatIndex: number;
  playerColor: string;
  action: string;
  scoreDelta: number;
}

export type { BoardCellView, PlayerSnapshot, LastMoveSnapshot, MatchSnapshot };

export interface DragState {
  tileId: string | null;
  /** Board cell coordinates under the pointer, if any. */
  hoverRow: number | null;
  hoverCol: number | null;
}

export interface MatchState {
  sessionId: string | null;
  slot: "host" | "player" | null;
  mySessionId: string | null;
  connected: boolean;
  snapshot: MatchSnapshot | null;
  rack: TileDto[];
  /** Local display order for rack tile IDs. Persists across server rack updates. */
  rackOrder: string[];
  guestInviteLink: string | null;
  pending: PendingPlacement[];
  lastError: ErrorMessage | null;
  drag: DragState;
  swapMode: boolean;
  swapSelected: string[];
  /** Click-select picked tile for click-another-to-swap reorder UX. */
  rackPicked: string | null;
  /** Ghost placements broadcast by the currently active opponent. */
  opponentPending: PendingPlacement[];
  /** Potential score for the current pending placements (null if invalid or empty). */
  previewScore: number | null;
  /** Accumulated history of completed turns this session. */
  turnLog: TurnLogEntry[];

  setSessionId: (sessionId: string | null) => void;
  setSlot: (slot: "host" | "player" | null) => void;
  setConnected: (connected: boolean) => void;
  setSnapshot: (snapshot: MatchSnapshot | null) => void;
  setRack: (tiles: TileDto[]) => void;
  reorderRackSwap: (fromTileId: string, toTileId: string) => void;
  setGuestInviteLink: (link: string | null) => void;
  addPending: (p: PendingPlacement) => void;
  removePendingAt: (row: number, col: number) => void;
  removePendingByTile: (tileId: string) => void;
  clearPending: () => void;
  setError: (err: ErrorMessage | null) => void;

  startDrag: (tileId: string) => void;
  updateDragHover: (row: number | null, col: number | null) => void;
  endDrag: () => void;

  setSwapMode: (mode: boolean) => void;
  toggleSwapPick: (tileId: string) => void;
  clearSwapSelection: () => void;

  pickRackTile: (tileId: string) => void;
  clearRackPick: () => void;

  setOpponentPending: (placements: PendingPlacement[]) => void;
  setPreviewScore: (score: number | null) => void;
  appendTurnLog: (entry: Omit<TurnLogEntry, "id">) => void;

  reset: () => void;
}

const emptyDrag: DragState = { tileId: null, hoverRow: null, hoverCol: null };

function reconcileOrder(prevOrder: string[], tiles: TileDto[]): string[] {
  const present = new Set(tiles.map((t) => t.id));
  const kept = prevOrder.filter((id) => present.has(id));
  const known = new Set(kept);
  for (const t of tiles) {
    if (!known.has(t.id)) kept.push(t.id);
  }
  return kept;
}

export const useMatchStore = create<MatchState>((set) => ({
  sessionId: null,
  slot: null,
  mySessionId: null,
  connected: false,
  snapshot: null,
  rack: [],
  rackOrder: [],
  guestInviteLink: null,
  pending: [],
  lastError: null,
  drag: emptyDrag,
  swapMode: false,
  swapSelected: [],
  rackPicked: null,
  opponentPending: [],
  previewScore: null,
  turnLog: [],

  setSessionId: (sessionId) => set({ sessionId, mySessionId: sessionId }),
  setSlot: (slot) => set({ slot }),
  setConnected: (connected) => set({ connected }),
  setSnapshot: (snapshot) => set({ snapshot }),
  setRack: (tiles) =>
    set((s) => ({ rack: tiles, rackOrder: reconcileOrder(s.rackOrder, tiles) })),
  reorderRackSwap: (fromId, toId) =>
    set((s) => {
      if (fromId === toId) return s;
      const order = s.rackOrder.slice();
      const a = order.indexOf(fromId);
      const b = order.indexOf(toId);
      if (a === -1 || b === -1) return s;
      const fromTile = order[a] as string;
      const toTile = order[b] as string;
      order[a] = toTile;
      order[b] = fromTile;
      return { rackOrder: order };
    }),
  setGuestInviteLink: (link) => set({ guestInviteLink: link }),
  addPending: (p) =>
    set((s) => {
      const next = s.pending.filter((x) => x.tileId !== p.tileId);
      next.push(p);
      return { pending: next };
    }),
  removePendingAt: (row, col) =>
    set((s) => ({ pending: s.pending.filter((p) => !(p.row === row && p.col === col)) })),
  removePendingByTile: (tileId) =>
    set((s) => ({ pending: s.pending.filter((p) => p.tileId !== tileId) })),
  clearPending: () => set({ pending: [] }),
  setError: (err) => set({ lastError: err }),

  startDrag: (tileId) => set({ drag: { tileId, hoverRow: null, hoverCol: null } }),
  updateDragHover: (row, col) =>
    set((s) => ({ drag: { ...s.drag, hoverRow: row, hoverCol: col } })),
  endDrag: () => set({ drag: emptyDrag }),

  setSwapMode: (mode) =>
    set(() => ({ swapMode: mode, swapSelected: [] })),
  toggleSwapPick: (tileId) =>
    set((s) => {
      const has = s.swapSelected.includes(tileId);
      return {
        swapSelected: has
          ? s.swapSelected.filter((id) => id !== tileId)
          : [...s.swapSelected, tileId],
      };
    }),
  clearSwapSelection: () => set({ swapSelected: [] }),

  pickRackTile: (tileId) =>
    set((s) => {
      if (s.rackPicked === null) return { rackPicked: tileId };
      if (s.rackPicked === tileId) return { rackPicked: null };
      const order = s.rackOrder.slice();
      const a = order.indexOf(s.rackPicked);
      const b = order.indexOf(tileId);
      if (a === -1 || b === -1) return { rackPicked: null };
      const av = order[a] as string;
      const bv = order[b] as string;
      order[a] = bv;
      order[b] = av;
      return { rackOrder: order, rackPicked: null };
    }),
  clearRackPick: () => set({ rackPicked: null }),

  setOpponentPending: (placements) => set({ opponentPending: placements }),
  setPreviewScore: (score) => set({ previewScore: score }),
  appendTurnLog: (entry) =>
    set((s) => ({ turnLog: [...s.turnLog, { ...entry, id: Date.now() + s.turnLog.length }] })),

  reset: () =>
    set({
      sessionId: null,
      slot: null,
      mySessionId: null,
      connected: false,
      snapshot: null,
      rack: [],
      rackOrder: [],
      guestInviteLink: null,
      pending: [],
      lastError: null,
      drag: emptyDrag,
      swapMode: false,
      swapSelected: [],
      rackPicked: null,
      opponentPending: [],
      previewScore: null,
      turnLog: [],
    }),
}));
