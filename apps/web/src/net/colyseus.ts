import { Client, type Room } from "@colyseus/sdk";
import { SERVER_ORIGIN } from "../api/client";
import { useMatchStore, type MatchSnapshot, type BoardCellView, type PlayerSnapshot } from "../store/match-store";
import type { ClaimResponse, ErrorMessage, PendingPlacement, RackMessage, TileDto } from "../types";

const RECONNECT_KEY = "b-m4th:reconnection"; // localStorage — survives tab close, cleared on leave
const RACK_RECOVERY_COOLDOWN_MS = 1000;

export interface PlayMovePayload {
  tileId: string;
  position: { row: number; col: number };
  assignedFace?: string;
}

let client: Client | null = null;
let activeRoom: Room | null = null;
let rackRecoveryRoomKey: string | null = null;
let rackRecoveryNextAllowedAt = 0;

/** Reuse a single Colyseus client for the current browser tab. */
function getClient(): Client {
  if (!client) {
    const wsUrl = SERVER_ORIGIN.replace(/^http/, "ws");
    client = new Client(wsUrl);
  }
  return client;
}

/** Convert Colyseus schema state into the plain snapshot shape consumed by the UI store. */
function snapshotFromState(state: any): MatchSnapshot {
  const boardView: BoardCellView[] = [];
  const boardArr: any[] = state.board ? Array.from(state.board) : [];
  for (let i = 0; i < boardArr.length; i++) {
    const cell = boardArr[i];
    boardView.push({
      index: i,
      row: Math.floor(i / (state.boardSize ?? 15)),
      col: i % (state.boardSize ?? 15),
      premium: cell.premium,
      tile: cell.tile
        ? {
            id: cell.tile.id,
            face: cell.tile.face,
            assignedFace: cell.tile.assignedFace ?? "",
            value: cell.tile.value,
            tileType: cell.tile.tileType,
          }
        : null,
    });
  }
  const players: PlayerSnapshot[] = (state.players ? Array.from(state.players) : []).map(
    (p: any) => ({
      sessionId: p.sessionId,
      name: p.name,
      slot: p.slot,
      seatIndex: p.seatIndex ?? 0,
      score: p.score,
      rackCount: p.rackCount,
      connected: p.connected,
      bankRemainingMs: p.bankRemainingMs,
      turnElapsedMs: p.turnElapsedMs ?? 0,
      overtimePenalty: p.overtimePenalty,
      color: p.color ?? "",
    }),
  );
  return {
    matchId: state.matchId,
    phase: state.phase,
    ready: Boolean(state.ready),
    turnNumber: state.turnNumber,
    currentSessionId: state.currentSessionId,
    isFirstMove: state.isFirstMove,
    consecutivePasses: state.consecutivePasses,
    bagRemaining: state.bagRemaining,
    boardSize: state.boardSize,
    board: boardView,
    players,
    lastMove: state.lastMove
      ? {
          sessionId: state.lastMove.sessionId,
          action: state.lastMove.action,
          scoreDelta: state.lastMove.scoreDelta,
          turnNumber: state.lastMove.turnNumber,
          placedIndices: Array.from(state.lastMove.placedIndices ?? []),
        }
      : undefined,
    winnerSessionId: state.winnerSessionId,
    baseMinutes: state.baseMinutes ?? 10,
    incrementSeconds: state.incrementSeconds ?? 0,
    turnMinutes: state.turnMinutes ?? 3,
    started: Boolean(state.started),
    hostSessionId: state.hostSessionId ?? "",
    maxPlayers: state.maxPlayers ?? 2,
    minPlayers: state.minPlayers ?? 2,
  };
}

function clientLog(event: string, details: Record<string, unknown>): void {
  console.info(JSON.stringify({ scope: "colyseus.client", event, ...details }));
}

/** Reset rack-recovery throttling when the active room lifecycle changes. */
function resetRackRecovery(room: Room | null): void {
  rackRecoveryRoomKey = room ? `${room.roomId}:${room.sessionId}` : null;
  rackRecoveryNextAllowedAt = 0;
}

/** Attach room listeners and bootstrap reconnect-safe private rack recovery. */
function wireRoom(room: Room): void {
  const store = useMatchStore.getState();
  store.setSessionId(room.sessionId);
  store.setConnected(true);
  resetRackRecovery(room);

  clientLog("room.wire", { roomId: room.roomId, sessionId: room.sessionId });

  let lastSeenMoveTurnNumber = -1;

  room.onStateChange((state: any) => {
    const snapshot = snapshotFromState(state);
    clientLog("room.state", {
      roomId: room.roomId,
      sessionId: room.sessionId,
      phase: snapshot.phase,
      ready: snapshot.ready,
      boardLength: snapshot.board.length,
      turnNumber: snapshot.turnNumber,
      players: snapshot.players.length,
    });

    // Detect new completed turn → append to log and clear transient state.
    if (snapshot.lastMove && lastSeenMoveTurnNumber !== snapshot.lastMove.turnNumber) {
      lastSeenMoveTurnNumber = snapshot.lastMove.turnNumber;
      if (snapshot.lastMove.action !== "start") {
        const actor = snapshot.players.find((p) => p.sessionId === snapshot.lastMove?.sessionId);
        if (actor) {
          useMatchStore.getState().appendTurnLog({
            turnNumber: snapshot.lastMove.turnNumber,
            playerName: actor.name,
            seatIndex: actor.seatIndex,
            playerColor: actor.color,
            action: snapshot.lastMove.action,
            scoreDelta: snapshot.lastMove.scoreDelta,
          });
        }
      }
      useMatchStore.getState().setOpponentPending([]);
      useMatchStore.getState().setPreviewScore(null);
    }

    useMatchStore.getState().setSnapshot(snapshot);
    requestRackIfMissing(room, "state");
  });

  room.onMessage("rack", (payload: RackMessage) => {
    clientLog("room.message.rack", {
      roomId: room.roomId,
      sessionId: room.sessionId,
      tiles: payload.tiles.length,
    });
    rackRecoveryNextAllowedAt = 0;
    useMatchStore.getState().setRack(payload.tiles as TileDto[]);
  });

  room.onMessage("error", (payload: ErrorMessage) => {
    clientLog("room.message.error", {
      roomId: room.roomId,
      sessionId: room.sessionId,
      code: payload.code,
    });
    useMatchStore.getState().setError(payload);
  });

  room.onMessage("opponentPending", (payload: { sessionId: string; placements: PendingPlacement[] }) => {
    clientLog("room.message.opponentPending", {
      roomId: room.roomId,
      sessionId: room.sessionId,
      count: payload.placements.length,
    });
    useMatchStore.getState().setOpponentPending(payload.placements);
  });

  room.onMessage("previewScore", (payload: { valid: boolean; score?: number }) => {
    useMatchStore.getState().setPreviewScore(payload.valid && payload.score !== undefined ? payload.score : null);
  });

  room.onLeave(() => {
    clientLog("room.leave", { roomId: room.roomId, sessionId: room.sessionId });
    useMatchStore.getState().setConnected(false);
  });

  room.onError((code, message) => {
    clientLog("room.error", { roomId: room.roomId, sessionId: room.sessionId, code, message });
    useMatchStore.getState().setError({ code: String(code), message: message ?? "Unknown error" });
  });

  // Persist reconnection token for tab-scoped reconnect on refresh.
  const token = (room as any).reconnectionToken as string | undefined;
  if (token) {
    localStorage.setItem(RECONNECT_KEY, token);
  }

  // Announce readiness so server re-broadcasts private rack.
  room.send("ready", {});
  scheduleRackRecovery(room);
}

/** Ask the server to resend the private rack, with lightweight trace metadata. */
function requestRack(room: Room, reason: string): void {
  clientLog("room.requestRack", { roomId: room.roomId, sessionId: room.sessionId, reason });
  room.send("requestRack", {});
}

/** Recover a missing private rack without re-requesting it on every state tick. */
function requestRackIfMissing(room: Room, reason: string): void {
  const store = useMatchStore.getState();
  const snapshot = store.snapshot;
  const roomKey = `${room.roomId}:${room.sessionId}`;
  if (rackRecoveryRoomKey !== roomKey) resetRackRecovery(room);
  if (!snapshot || snapshot.phase !== "playing" || store.rack.length > 0) return;
  const me = snapshot.players.find((p) => p.sessionId === room.sessionId);
  if (!me || me.rackCount <= 0) return;
  const now = Date.now();
  if (now < rackRecoveryNextAllowedAt) return;
  rackRecoveryNextAllowedAt = now + RACK_RECOVERY_COOLDOWN_MS;
  requestRack(room, reason);
}

/** Schedule a few bounded retries around join/reconnect to restore private rack state. */
function scheduleRackRecovery(room: Room): void {
  const delays = [50, 250, 1000];
  for (const delay of delays) {
    window.setTimeout(() => {
      if (activeRoom === room) requestRackIfMissing(room, `retry_${delay}`);
    }, delay);
  }
}

/** Join a room from an HTTP-issued seat reservation and install room listeners. */
export async function joinWithReservation(reservation: any): Promise<Room> {
  clientLog("join.consumeSeatReservation.request", {
    roomId: reservation?.room?.roomId,
    sessionId: reservation?.sessionId,
  });
  const room = (await getClient().consumeSeatReservation(reservation)) as Room;
  activeRoom = room;
  wireRoom(room);
  return room;
}

/** Consume the reserved host seat returned by match creation. */
export async function joinHostReservation(reservation: any): Promise<Room> {
  useMatchStore.getState().setSlot("host");
  return joinWithReservation(reservation);
}

/** Consume the guest reservation returned by invite claim. */
export async function joinFromClaim(claim: ClaimResponse): Promise<Room> {
  useMatchStore.getState().setSlot("player");
  return joinWithReservation(claim.reservation);
}

/** Restore a room after refresh using the stored reconnection token. */
export async function tryReconnect(): Promise<Room | null> {
  const token = localStorage.getItem(RECONNECT_KEY);
  if (!token) return null;
  try {
    clientLog("join.reconnect.request", { tokenPresent: true });
    const room = (await getClient().reconnect(token)) as Room;
    activeRoom = room;
    wireRoom(room);
    return room;
  } catch {
    localStorage.removeItem(RECONNECT_KEY);
    return null;
  }
}

/** Leave the active room and clear all client-side multiplayer session state. */
export function leaveRoom(): void {
  if (activeRoom) {
    try {
      activeRoom.leave(true);
    } catch {
      /* ignore */
    }
    activeRoom = null;
  }
  resetRackRecovery(null);
  localStorage.removeItem(RECONNECT_KEY);
  useMatchStore.getState().reset();
}

/** Submit the pending tile placements for the current turn. */
export function sendPlay(moves: PlayMovePayload[]): void {
  activeRoom?.send("play", { moves });
}

/** Ask the server to swap the selected tiles. */
export function sendSwap(tileIds: string[]): void {
  activeRoom?.send("swap", { tileIds });
}

/** End the current turn without placing tiles. */
export function sendPass(): void {
  activeRoom?.send("pass", {});
}

/** Broadcast the local player's current pending tile placements for live preview. */
export function sendPendingUpdate(pending: PendingPlacement[]): void {
  activeRoom?.send("pendingUpdate", {
    moves: pending.map((p) => ({
      tileId: p.tileId,
      row: p.row,
      col: p.col,
      face: p.face,
      assignedFace: p.assignedFace,
      value: p.value,
    })),
  });
}

/** Ask the host room to start the match from the lobby. */
export function sendStartMatch(): void {
  activeRoom?.send("startMatch", {});
}

/** Update lobby time controls before the match starts. */
export function sendSetTimeControl(tc: { baseMinutes: number; incrementSeconds: number; turnMinutes: number }): void {
  activeRoom?.send("setTimeControl", tc);
}

/** Pick a palette-keyed color for the local player. Server validates collisions. */
export function sendPickColor(color: string): void {
  activeRoom?.send("pickColor", { color });
}

/** Return the currently active Colyseus room, if one exists. */
export function currentRoom(): Room | null {
  return activeRoom;
}
