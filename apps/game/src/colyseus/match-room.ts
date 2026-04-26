import { ArraySchema } from "@colyseus/schema";
import { Room } from "colyseus";
import type { Client } from "colyseus";
import { z } from "zod";
import { GameEngine, type GameActionResult } from "@engine/game-engine";
import { type BoardCell, type Tile, type Position, type BlankAssignment, type TimeControl } from "@entities";
import {
  DEFAULT_TIME_CONTROL,
  GAME_CONFIG,
  MAX_PLAYERS,
  MIN_PLAYERS,
  VALID_BLANK_ASSIGNMENTS,
} from "@entities";
import { InviteStore } from "./invite-store";
import { posKey } from "@engine/pos-key";
import { minutesToMs } from "@b-m4th/shared";
import { MatchRegistry } from "./match-registry";
import { timeControlSchema } from "./schemas/time-control-schema";
import {
  CellView,
  LastMoveView,
  MatchStateSchema,
  PlayerView,
  TileView,
} from "./schema";

export const MATCH_ROOM_NAME = "match";

export interface MatchRoomDefineOptions {
  invites: InviteStore;
  matches: MatchRegistry;
  /** Optional: override clock timer interval (ms). Useful in tests. */
  clockIntervalMs?: number;
}

interface CreateOptions {
  matchId: string;
  seed: string;
}

interface JoinOptions {
  matchId?: string;
  role?: "host" | "player";
  name?: string;
}

interface SeatRecord {
  sessionId: string;
  role: "host" | "player";
  seatIndex: number;
  name: string;
  connected: boolean;
  bankRemainingMs: number;
  overtimePenalty: number;
  penaltyScoreTotal: number;
}

const RECONNECTION_GRACE_SECONDS = 300; // 5 minutes
const RATE_LIMIT_WINDOW_MS = 500;
const RACK_RECOVERY_WINDOW_MS = 1000;

function roomLog(event: string, details: Record<string, unknown>): void {
  console.info("colyseus.MatchRoom", { event, ...details });
}

const positionSchema = z.object({
  row: z.number().int().min(0).max(GAME_CONFIG.BOARD_SIZE - 1),
  col: z.number().int().min(0).max(GAME_CONFIG.BOARD_SIZE - 1),
});

const blankAssignmentSchema = z.enum(VALID_BLANK_ASSIGNMENTS);

const playMoveSchema = z.object({
  tileId: z.string().min(1).max(64),
  position: positionSchema,
  assignedFace: blankAssignmentSchema.optional(),
});

const playMessageSchema = z.object({
  moves: z.array(playMoveSchema).min(1).max(GAME_CONFIG.RACK_SIZE),
});

const swapMessageSchema = z.object({
  tileIds: z.array(z.string().min(1).max(64)).min(1).max(GAME_CONFIG.RACK_SIZE),
});

const passMessageSchema = z.object({}).strict();

const startMessageSchema = z.object({}).strict();

const setTimeControlSchema = timeControlSchema;

export const PLAYER_COLOR_KEYS = ["orange", "cyan", "pink", "green", "violet", "yellow"] as const;
export type PlayerColorKey = (typeof PLAYER_COLOR_KEYS)[number];

const pickColorSchema = z.object({
  color: z.union([
    z.enum(PLAYER_COLOR_KEYS),
    z.string().regex(/^#[0-9a-f]{6}$/i, "Must be a preset key or 6-digit hex color"),
  ]),
});

const pendingUpdateMoveSchema = z.object({
  tileId: z.string().min(1).max(64),
  row: z.number().int().min(0).max(GAME_CONFIG.BOARD_SIZE - 1),
  col: z.number().int().min(0).max(GAME_CONFIG.BOARD_SIZE - 1),
  face: z.string().min(1).max(10),
  assignedFace: blankAssignmentSchema.optional(),
  value: z.number().int().min(0).max(100),
});

const pendingUpdateSchema = z.object({
  moves: z.array(pendingUpdateMoveSchema).max(GAME_CONFIG.RACK_SIZE),
});

function defaultColorForSeat(seatIndex: number): PlayerColorKey {
  const i = ((seatIndex % PLAYER_COLOR_KEYS.length) + PLAYER_COLOR_KEYS.length) % PLAYER_COLOR_KEYS.length;
  return PLAYER_COLOR_KEYS[i]!;
}

function cellToView(cell: BoardCell): CellView {
  const view = new CellView();
  view.premium = cell.premium;
  if (cell.tile) {
    const tv = new TileView();
    tv.id = cell.tile.id;
    tv.face = cell.tile.face;
    tv.tileType = cell.tile.type;
    tv.value = cell.tile.value;
    tv.assignedFace = cell.tile.assignedFace ?? "";
    view.tile = tv;
  }
  return view;
}

function previewPenalty(overageMs: number): number {
  if (overageMs <= 0) return 0;
  const minutesOver = Math.ceil(overageMs / 60_000);
  return minutesOver * GAME_CONFIG.OVERTIME_PENALTY_PER_MINUTE;
}

function tilesToClient(rack: Tile[]): Array<{
  id: string;
  face: string;
  type: string;
  value: number;
  assignedFace: string | null;
}> {
  return rack.map((t) => ({
    id: t.id,
    face: t.face,
    type: t.type,
    value: t.value,
    assignedFace: t.assignedFace ?? null,
  }));
}

export class MatchRoom extends Room<{ state: MatchStateSchema }> {
  public static onBeforeJoin?: (room: MatchRoom, client: Client, options: JoinOptions) => void;

  private matchId: string = "";
  private seed: string = "";
  private invites!: InviteStore;
  private matches!: MatchRegistry;
  private engine: GameEngine | null = null;
  private seats = new Map<string, SeatRecord>();
  private lastActionAt = new Map<string, number>();
  private lastRackRecoveryAt = new Map<string, number>();
  private lastPendingUpdateAt = new Map<string, number>();
  private autoDisposeTimeoutMs = 30_000;
  private turnStartedAt: number | null = null;
  private clockTickHandle: { clear: () => void } | null = null;

  override onCreate(options: CreateOptions & MatchRoomDefineOptions): void {
    if (!options?.matchId || !options?.seed) {
      throw new Error("matchId and seed are required for MatchRoom");
    }
    this.matchId = options.matchId;
    this.seed = options.seed;
    this.invites = options.invites;
    this.matches = options.matches;

    this.autoDispose = true;

    const record = this.matches?.get(this.matchId);
    const tc = record?.timeControl ?? DEFAULT_TIME_CONTROL;
    const maxPlayers = Math.max(
      MIN_PLAYERS,
      Math.min(MAX_PLAYERS, record?.maxPlayers ?? MIN_PLAYERS),
    );
    const minPlayers = Math.max(MIN_PLAYERS, record?.minPlayers ?? MIN_PLAYERS);
    this.maxClients = maxPlayers;

    roomLog("onCreate", {
      roomId: this.roomId,
      matchId: this.matchId,
      maxPlayers,
      minPlayers,
    });

    const state = new MatchStateSchema();
    state.matchId = this.matchId;
    state.phase = "waiting";
    state.ready = false;
    state.boardSize = GAME_CONFIG.BOARD_SIZE;
    state.board = new ArraySchema<CellView>();
    state.players = new ArraySchema<PlayerView>();
    state.serverTime = Date.now();
    state.baseMinutes = tc.baseMinutes;
    state.incrementSeconds = tc.incrementSeconds;
    state.turnMinutes = tc.turnMinutes;
    state.started = false;
    state.maxPlayers = maxPlayers;
    state.minPlayers = minPlayers;
    this.setState(state);

    this.onMessage("play", (client, payload) => this.handlePlay(client, payload));
    this.onMessage("swap", (client, payload) => this.handleSwap(client, payload));
    this.onMessage("pass", (client, payload) => this.handlePass(client, payload));
    this.onMessage("ready", (client) => this.handleRackRecovery(client, "ready"));
    this.onMessage("requestRack", (client) => this.handleRackRecovery(client, "requestRack"));
    this.onMessage("startMatch", (client, payload) => this.handleStartMatch(client, payload));
    this.onMessage("setTimeControl", (client, payload) => this.handleSetTimeControl(client, payload));
    this.onMessage("pickColor", (client, payload) => this.handlePickColor(client, payload));
    this.onMessage("pendingUpdate", (client, payload) => this.handlePendingUpdate(client, payload));
  }

  override async onAuth(_client: Client, options: JoinOptions): Promise<boolean> {
    roomLog("onAuth", {
      roomId: this.roomId,
      matchId: this.matchId,
      role: options?.role,
      name: options?.name,
    });
    if (options?.matchId !== this.matchId) {
      throw new Error("Invite does not belong to this match");
    }
    if (options?.role !== "host" && options?.role !== "player") {
      throw new Error("Invalid role");
    }
    if (typeof options.name !== "string" || options.name.trim().length === 0) {
      throw new Error("Missing player name");
    }
    if (this.state.started) {
      throw new Error("Match already started");
    }
    if (options.role === "host" && this.state.hostSessionId !== "") {
      throw new Error("Host seat already taken");
    }
    if (this.state.players.length >= this.state.maxPlayers) {
      throw new Error("Match is full");
    }
    return true;
  }

  override onJoin(client: Client, options: JoinOptions): void {
    const role = options.role as "host" | "player";
    const name = (options.name ?? "Player").trim().slice(0, 40);

    const seatIndex =
      role === "host" ? 0 : this.nextAvailableSeatIndex();

    roomLog("onJoin", {
      roomId: this.roomId,
      sessionId: client.sessionId,
      matchId: this.matchId,
      role,
      seatIndex,
      phase: this.state.phase,
      ready: this.state.ready,
    });

    const bankMs = minutesToMs(this.state.baseMinutes);
    const seat: SeatRecord = {
      sessionId: client.sessionId,
      role,
      seatIndex,
      name,
      connected: true,
      bankRemainingMs: bankMs,
      overtimePenalty: 0,
      penaltyScoreTotal: 0,
    };
    this.seats.set(client.sessionId, seat);

    const view = this.playerViewForSession(client.sessionId) ?? new PlayerView();
    view.sessionId = client.sessionId;
    view.name = name;
    view.slot = role;
    view.seatIndex = seatIndex;
    view.connected = true;
    view.bankRemainingMs = seat.bankRemainingMs;
    view.overtimePenalty = 0;
    if (!view.color) {
      view.color = this.firstAvailableColor(seatIndex, client.sessionId);
    }

    if (!this.playerViewForSession(client.sessionId)) {
      this.state.players.push(view);
    }

    if (role === "host" && this.state.hostSessionId === "") {
      this.state.hostSessionId = client.sessionId;
    }

    // Close the invite once the room fills so a late claimer fails fast.
    if (this.state.players.length >= this.state.maxPlayers) {
      this.invites?.revokeMatch(this.matchId);
    }

    this.broadcastRack(client.sessionId);
  }

  private firstAvailableColor(seatIndex: number, ownSessionId: string): PlayerColorKey {
    const taken = new Set<string>();
    for (const p of this.state.players) {
      if (p.sessionId !== ownSessionId && p.color) taken.add(p.color);
    }
    const preferred = defaultColorForSeat(seatIndex);
    if (!taken.has(preferred)) return preferred;
    for (const key of PLAYER_COLOR_KEYS) {
      if (!taken.has(key)) return key;
    }
    return preferred;
  }

  private handlePickColor(client: Client, rawPayload: unknown): void {
    const parsed = pickColorSchema.safeParse(rawPayload);
    if (!parsed.success) {
      this.sendError(client, "invalid_color", parsed.error.issues[0]?.message ?? "Invalid color");
      return;
    }
    if (this.state.started || this.state.phase !== "waiting") {
      this.sendError(client, "already_started", "Cannot change color after start");
      return;
    }
    const view = this.playerViewForSession(client.sessionId);
    if (!view) {
      this.sendError(client, "no_seat", "No seat for this client");
      return;
    }
    const next = parsed.data.color;
    if (view.color === next) return;
    for (const p of this.state.players) {
      if (p.sessionId !== client.sessionId && p.color === next) {
        this.sendError(client, "color_taken", "That color is already taken");
        return;
      }
    }
    view.color = next;
  }

  private handlePendingUpdate(client: Client, rawPayload: unknown): void {
    const now = Date.now();
    const last = this.lastPendingUpdateAt.get(client.sessionId) ?? 0;
    if (now - last < 100) return; // silently throttle; client debounces at 100ms
    this.lastPendingUpdateAt.set(client.sessionId, now);

    const parsed = pendingUpdateSchema.safeParse(rawPayload);
    if (!parsed.success) return;

    // Only the current player's pending moves are meaningful.
    if (!this.engine || this.state.phase !== "playing") return;
    if (this.engine.getState().currentPlayerId !== client.sessionId) return;

    const moves = parsed.data.moves;

    // Broadcast ghost placements to all other clients for live preview.
    const placements = moves.map((m) => ({
      row: m.row,
      col: m.col,
      face: m.face,
      assignedFace: m.assignedFace,
      value: m.value,
    }));
    this.broadcast("opponentPending", { sessionId: client.sessionId, placements }, { except: client });

    // Compute and return preview score to the active player.
    if (moves.length === 0) {
      client.send("previewScore", { valid: false });
      return;
    }
    const previewResult = this.engine.previewPlay(
      moves.map((m) => ({
        tileId: m.tileId,
        position: { row: m.row, col: m.col },
        assignedFace: m.assignedFace,
      })),
    );
    if (previewResult.ok) {
      client.send("previewScore", { valid: true, score: previewResult.score });
    } else {
      client.send("previewScore", { valid: false });
    }
  }

  private nextAvailableSeatIndex(): number {
    const taken = new Set<number>();
    for (const p of this.state.players) taken.add(p.seatIndex);
    for (let i = 0; i < this.state.maxPlayers; i++) {
      if (!taken.has(i)) return i;
    }
    // Should never happen — onAuth guards against full.
    return this.state.players.length;
  }

  private handleStartMatch(client: Client, rawPayload: unknown): void {
    const parsed = startMessageSchema.safeParse(rawPayload ?? {});
    if (!parsed.success) {
      this.sendError(client, "invalid_start", "Invalid start payload");
      return;
    }
    if (this.state.started || this.state.phase !== "waiting") {
      this.sendError(client, "already_started", "Match already started");
      return;
    }
    if (client.sessionId !== this.state.hostSessionId) {
      this.sendError(client, "not_host", "Only the host can start the match");
      return;
    }
    if (this.state.players.length < this.state.minPlayers) {
      this.sendError(
        client,
        "not_enough_players",
        `Need at least ${this.state.minPlayers} players`,
      );
      return;
    }
    this.invites?.revokeMatch(this.matchId);
    this.startGame();
  }

  private handleSetTimeControl(client: Client, rawPayload: unknown): void {
    const parsed = setTimeControlSchema.safeParse(rawPayload);
    if (!parsed.success) {
      this.sendError(client, "invalid_time_control", parsed.error.issues[0]?.message ?? "Invalid time control");
      return;
    }
    if (this.state.started || this.state.phase !== "waiting") {
      this.sendError(client, "already_started", "Cannot change time control after start");
      return;
    }
    if (client.sessionId !== this.state.hostSessionId) {
      this.sendError(client, "not_host", "Only the host can change time control");
      return;
    }
    const tc: TimeControl = {
      baseMinutes: parsed.data.baseMinutes,
      incrementSeconds: parsed.data.incrementSeconds,
      turnMinutes: parsed.data.turnMinutes,
    };
    this.state.baseMinutes = tc.baseMinutes;
    this.state.incrementSeconds = tc.incrementSeconds;
    this.state.turnMinutes = tc.turnMinutes;
    this.matches?.updateTimeControl(this.matchId, tc);

    // Reset pre-start bank previews on all joined seats.
    const bankMs = minutesToMs(tc.baseMinutes);
    for (const seat of this.seats.values()) {
      seat.bankRemainingMs = bankMs;
      const view = this.playerViewForSession(seat.sessionId);
      if (view) view.bankRemainingMs = bankMs;
    }
  }

  override async onLeave(client: Client, code?: number): Promise<void> {
    roomLog("onLeave", {
      roomId: this.roomId,
      sessionId: client.sessionId,
      matchId: this.matchId,
      code,
      consented: code === 1000,
    });
    const seat = this.seats.get(client.sessionId);
    if (seat) {
      seat.connected = false;
      const view = this.playerViewForSession(client.sessionId);
      if (view) view.connected = false;
    }

    // code 1000 = normal closure (consented). Anything else = try reconnect.
    const consented = code === 1000;
    if (consented) return;

    try {
      await this.allowReconnection(client, RECONNECTION_GRACE_SECONDS);
      const resumedSeat = this.seats.get(client.sessionId);
      if (resumedSeat) {
        resumedSeat.connected = true;
        const view = this.playerViewForSession(client.sessionId);
        if (view) view.connected = true;
        this.broadcastRack(client.sessionId);
      }
    } catch (err) {
      roomLog("reconnectionExpired", {
        roomId: this.roomId,
        matchId: this.matchId,
        sessionId: client.sessionId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  override onDispose(): void {
    roomLog("onDispose", { roomId: this.roomId, matchId: this.matchId });
    this.stopClockTicker();
    this.invites?.revokeMatch(this.matchId);
    this.matches?.remove(this.matchId);
    this.seats.clear();
    this.lastActionAt.clear();
    this.lastRackRecoveryAt.clear();
    this.lastPendingUpdateAt.clear();
  }

  /* ------------------------------------------------------------------ */
  /* Game lifecycle                                                      */
  /* ------------------------------------------------------------------ */

  private startGame(): void {
    this.state.ready = false;
    this.state.started = true;
    const bankMs = minutesToMs(this.state.baseMinutes);
    for (const seat of this.seats.values()) {
      seat.bankRemainingMs = bankMs;
      seat.penaltyScoreTotal = 0;
      seat.overtimePenalty = 0;
      const view = this.playerViewForSession(seat.sessionId);
      if (view) {
        view.bankRemainingMs = bankMs;
        view.turnElapsedMs = 0;
        view.overtimePenalty = 0;
      }
    }
    const ordered = [...this.state.players].sort((a, b) => a.seatIndex - b.seatIndex);
    const playerIds = ordered.map((p) => p.sessionId);
    this.engine = GameEngine.create(playerIds, {
      seed: this.seed,
      consecutivePassesLimit: playerIds.length,
    });
    this.turnStartedAt = Date.now();
    this.syncFromEngine({ action: "start", scoreDelta: 0, placedPositions: [] });
    this.state.ready = this.state.board.length === this.state.boardSize * this.state.boardSize;
    roomLog("startGame", {
      roomId: this.roomId,
      matchId: this.matchId,
      players: playerIds,
      phase: this.state.phase,
      ready: this.state.ready,
      boardLength: this.state.board.length,
      turnNumber: this.state.turnNumber,
      currentSessionId: this.state.currentSessionId,
    });
    for (const sessionId of playerIds) this.broadcastRack(sessionId);
    this.startClockTicker();
  }

  /** Runs every 500ms while the game is active. Advances turnElapsedMs on the
   * current player's view so clients can render a live countdown. The bank
   * deduction is applied atomically at turn transition (see settleTurn). The
   * clock intentionally keeps ticking while a player is disconnected — bank
   * time is the natural ceiling on stall attacks. */
  private startClockTicker(): void {
    this.stopClockTicker();
    const handle = this.clock.setInterval(() => this.onClockTick(), 500);
    this.clockTickHandle = { clear: () => handle.clear() };
  }

  private stopClockTicker(): void {
    this.clockTickHandle?.clear();
    this.clockTickHandle = null;
  }

  private onClockTick(): void {
    if (!this.engine || this.state.phase !== "playing" || this.turnStartedAt === null) return;
    const currentId = this.state.currentSessionId;
    const view = this.playerViewForSession(currentId);
    if (!view) return;
    const elapsed = Date.now() - this.turnStartedAt;
    view.turnElapsedMs = elapsed;
    // Overage-only penalty preview (not yet applied — applied on settle).
    const allowed = Math.min(minutesToMs(this.state.turnMinutes), view.bankRemainingMs);
    const overage = Math.max(0, elapsed - allowed);
    view.overtimePenalty = previewPenalty(overage);
  }

  /** Settle the outgoing player's clock at turn transition:
   *  - Deduct elapsed from bank (floor at 0).
   *  - Apply overtime penalty (score -= penalty) if elapsed > allowed.
   *  - Return to a clean state for the next player. */
  private settleTurn(outgoingSessionId: string): void {
    if (this.turnStartedAt === null) return;
    const view = this.playerViewForSession(outgoingSessionId);
    const seat = this.seats.get(outgoingSessionId);
    if (!view || !seat) return;

    const elapsed = Date.now() - this.turnStartedAt;
    const bankBefore = view.bankRemainingMs;
    const turnLimit = minutesToMs(this.state.turnMinutes);
    const allowed = Math.min(turnLimit, bankBefore);

    view.bankRemainingMs = Math.max(0, bankBefore - elapsed);
    view.turnElapsedMs = 0;

    const overage = Math.max(0, elapsed - allowed);
    const penalty = previewPenalty(overage);
    if (penalty > 0) {
      seat.penaltyScoreTotal += penalty;
      seat.overtimePenalty = penalty;
      view.overtimePenalty = penalty;
    } else {
      seat.overtimePenalty = 0;
      view.overtimePenalty = 0;
    }

    // Fischer increment: credit the outgoing player after they complete a move.
    const incrementMs = this.state.incrementSeconds * 1000;
    if (incrementMs > 0 && view.bankRemainingMs > 0) {
      view.bankRemainingMs += incrementMs;
    }
  }

  private withActionGuard<T>(
    client: Client,
    schema: z.ZodType<T>,
    rawPayload: unknown,
    invalidCode: string,
    invalidMsg: string,
    fn: (data: T, engine: GameEngine) => void,
  ): void {
    if (!this.ensureActionAllowed(client)) return;
    const result = schema.safeParse(rawPayload);
    if (!result.success) {
      this.sendError(client, invalidCode, result.error.issues[0]?.message ?? invalidMsg);
      return;
    }
    if (!this.engine) {
      this.sendError(client, "not_ready", "Game has not started yet");
      return;
    }
    if (this.engine.getState().currentPlayerId !== client.sessionId) {
      this.sendError(client, "not_your_turn", "It is not your turn");
      return;
    }
    fn(result.data, this.engine);
  }

  private handlePlay(client: Client, rawPayload: unknown): void {
    this.withActionGuard(client, playMessageSchema, rawPayload, "invalid_play", "Invalid play", (data, engine) => {
      const moves: Array<{ tileId: string; position: Position; assignedFace?: BlankAssignment }> =
        data.moves.map((m) => ({
          tileId: m.tileId,
          position: m.position,
          assignedFace: m.assignedFace,
        }));

      // Guard against duplicate positions up-front (engine also guards, but surface cleaner error).
      const seenPositions = new Set<string>();
      for (const m of moves) {
        const key = posKey(m.position.row, m.position.col);
        if (seenPositions.has(key)) {
          this.sendError(client, "duplicate_position", `Duplicate position: ${key}`);
          return;
        }
        seenPositions.add(key);
      }

      const result = engine.play(moves);
      this.afterAction(result, client, {
        action: "play",
        placedPositions: result.ok ? moves.map((m) => m.position) : [],
      });
    });
  }

  private handleSwap(client: Client, rawPayload: unknown): void {
    this.withActionGuard(client, swapMessageSchema, rawPayload, "invalid_swap", "Invalid swap", (data, engine) => {
      const result = engine.swap(data.tileIds);
      this.afterAction(result, client, { action: "swap", placedPositions: [] });
    });
  }

  private handlePass(client: Client, rawPayload: unknown): void {
    this.withActionGuard(client, passMessageSchema, rawPayload ?? {}, "invalid_pass", "Invalid pass", (_data, engine) => {
      const result = engine.pass();
      this.afterAction(result, client, { action: "pass", placedPositions: [] });
    });
  }

  /** Replay private rack state for reconnect/reload recovery without allowing hot-loop spam. */
  private handleRackRecovery(client: Client, reason: "ready" | "requestRack"): void {
    if (!this.ensureRackRecoveryAllowed(client, reason)) return;
    this.broadcastRack(client.sessionId);
  }

  private afterAction(
    result: GameActionResult,
    client: Client,
    ctx: { action: string; placedPositions: Position[] },
  ): void {
    if (!result.ok) {
      this.sendError(client, "action_rejected", result.error);
      return;
    }
    // Clock settlement for the player who just acted (client.sessionId).
    this.settleTurn(client.sessionId);
    this.syncFromEngine({
      action: ctx.action,
      scoreDelta: result.scoreDelta,
      placedPositions: ctx.placedPositions,
      actorSessionId: client.sessionId,
    });

    if (this.state.phase === "finished") {
      this.applyTriggerBAdjustmentIfNeeded();
      this.finalizeWinner();
      this.stopClockTicker();
      this.turnStartedAt = null;
    } else {
      // Start the incoming player's clock.
      this.turnStartedAt = Date.now();
    }
    for (const sessionId of this.seats.keys()) this.broadcastRack(sessionId);
  }

  /** Trigger B: engine emits phase=finished after "everyone passes once in a
   * row" (consecutivePasses ≥ players.length). Each player gains 2× the sum of
   * all OTHER players' remaining rack values — generalization of the 2-player
   * rule to N players. */
  private applyTriggerBAdjustmentIfNeeded(): void {
    if (!this.engine) return;
    const snap = this.engine.getState();
    if (snap.consecutivePasses < this.engine.getConsecutivePassesLimit()) return;

    const rackValueById = new Map<string, number>();
    for (const p of snap.players) {
      rackValueById.set(p.id, p.rack.reduce((sum, t) => sum + t.value, 0));
    }
    let totalRackValue = 0;
    for (const v of rackValueById.values()) totalRackValue += v;

    for (const p of snap.players) {
      const othersRackValue = totalRackValue - (rackValueById.get(p.id) ?? 0);
      const view = this.playerViewForSession(p.id);
      if (view) view.score += othersRackValue * 2;
    }
  }

  private finalizeWinner(): void {
    let best: PlayerView | null = null;
    for (const p of this.state.players) {
      if (!best || p.score > best.score) best = p;
    }
    this.state.winnerSessionId = best?.sessionId ?? "";
  }

  /* ------------------------------------------------------------------ */
  /* State projection                                                    */
  /* ------------------------------------------------------------------ */

  private syncFromEngine(ctx: {
    action: string;
    scoreDelta: number;
    placedPositions: Position[];
    actorSessionId?: string;
  }): void {
    if (!this.engine) return;
    const snap = this.engine.getState();
    roomLog("syncFromEngine", {
      roomId: this.roomId,
      matchId: this.matchId,
      action: ctx.action,
      phase: snap.phase,
      boardRows: snap.board.length,
      boardCells: snap.board.reduce((sum, row) => sum + row.length, 0),
      turnNumber: snap.turnNumber,
      currentSessionId: snap.currentPlayerId,
    });

    this.state.turnNumber = snap.turnNumber;
    this.state.currentSessionId = snap.currentPlayerId;
    this.state.phase = snap.phase;
    this.state.isFirstMove = snap.isFirstMove;
    this.state.consecutivePasses = snap.consecutivePasses;
    this.state.bagRemaining = snap.tileBag.length;
    this.state.serverTime = Date.now();

    this.state.board.clear();
    for (const row of snap.board) {
      for (const cell of row) this.state.board.push(cellToView(cell));
    }

    for (const enginePlayer of snap.players) {
      const view = this.playerViewForSession(enginePlayer.id);
      const seat = this.seats.get(enginePlayer.id);
      if (!view) continue;
      view.score = enginePlayer.score - (seat?.penaltyScoreTotal ?? 0);
      view.rackCount = enginePlayer.rack.length;
    }

    const lastMove = new LastMoveView();
    lastMove.sessionId = ctx.actorSessionId ?? this.state.currentSessionId;
    lastMove.action = ctx.action;
    lastMove.scoreDelta = ctx.scoreDelta;
    lastMove.turnNumber = snap.turnNumber;
    lastMove.placedIndices = new ArraySchema<number>(
      ...ctx.placedPositions.map((p) => p.row * this.state.boardSize + p.col),
    );
    this.state.lastMove = lastMove;
  }

  private broadcastRack(sessionId: string): void {
    if (!this.engine) {
      roomLog("broadcastRack", {
        roomId: this.roomId,
        matchId: this.matchId,
        sessionId,
        tiles: 0,
        reason: "engine_not_started",
      });
      this.sendToSession(sessionId, "rack", { tiles: [] });
      return;
    }
    const snap = this.engine.getState();
    const player = snap.players.find((p) => p.id === sessionId);
    if (!player) {
      roomLog("broadcastRack", {
        roomId: this.roomId,
        matchId: this.matchId,
        sessionId,
        tiles: 0,
        reason: "player_not_found",
      });
      return;
    }
    roomLog("broadcastRack", {
      roomId: this.roomId,
      matchId: this.matchId,
      sessionId,
      tiles: player.rack.length,
      reason: "ok",
    });
    this.sendToSession(sessionId, "rack", { tiles: tilesToClient(player.rack) });
  }

  private sendToSession(sessionId: string, type: string, payload: unknown): void {
    const client = this.clients.getById(sessionId);
    if (!client) return;
    client.send(type, payload);
  }

  private sendError(client: Client, code: string, message: string): void {
    client.send("error", { code, message });
  }

  /* ------------------------------------------------------------------ */
  /* Helpers                                                             */
  /* ------------------------------------------------------------------ */

  private playerViewForSession(sessionId: string): PlayerView | undefined {
    for (const p of this.state.players) if (p.sessionId === sessionId) return p;
    return undefined;
  }

  private ensureActionAllowed(client: Client): boolean {
    const now = Date.now();
    const last = this.lastActionAt.get(client.sessionId) ?? 0;
    if (now - last < RATE_LIMIT_WINDOW_MS) {
      this.sendError(client, "rate_limited", "Slow down");
      return false;
    }
    this.lastActionAt.set(client.sessionId, now);
    return true;
  }

  private ensureRackRecoveryAllowed(client: Client, reason: string): boolean {
    const now = Date.now();
    const last = this.lastRackRecoveryAt.get(client.sessionId) ?? 0;
    if (now - last < RACK_RECOVERY_WINDOW_MS) {
      roomLog("rackRecovery.throttled", {
        roomId: this.roomId,
        matchId: this.matchId,
        sessionId: client.sessionId,
        reason,
      });
      return false;
    }
    this.lastRackRecoveryAt.set(client.sessionId, now);
    return true;
  }
}
