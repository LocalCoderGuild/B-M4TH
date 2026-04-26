import { ArraySchema } from "@colyseus/schema";
import { Room } from "colyseus";
import type { Client } from "colyseus";
import type { ZodType } from "zod";
import { GameEngine, type GameActionResult } from "@engine/game-engine";
import { type BoardCell, type Tile, type Position, type BlankAssignment, type TimeControl } from "@entities";
import {
  DEFAULT_TIME_CONTROL,
  GAME_CONFIG,
  MAX_PLAYERS,
  MIN_PLAYERS,
} from "@entities";
import { InviteStore } from "./invite-store";
import { posKey } from "@engine/pos-key";
import {
  minutesToMs,
  createLogger,
} from "@b-m4th/shared";
import { MatchRegistry } from "./match-registry";
import {
  createSeatRecord,
  getJoinAuthError,
  nextAvailableSeatIndex,
  pickFirstAvailableColor,
  resolveJoinName,
} from "./match-room.join";
import type {
  CreateOptions,
  JoinOptions,
  SeatRecord,
} from "./match-room.types";
import {
  passMessageSchema,
  pendingUpdateSchema,
  pickColorSchema,
  playMessageSchema,
  setTimeControlSchema,
  startMessageSchema,
  swapMessageSchema,
} from "./schemas/match-room-message-schema";
import {
  MATCH_ROOM_DEFAULTS,
  type MatchRoomDefineOptions,
} from "./match-room.config";
import { previewPenalty, tilesToClient } from "./match-room.helpers";
import {
  calculateTriggerBBonuses,
  pickWinnerSessionId,
  settleTurnState,
  syncSeatBanks,
} from "./match-room.lifecycle";
import { syncFromEngineSnapshot } from "./match-room.projection";
import {
  MatchStateSchema,
  PlayerView,
  CellView,
} from "./schema";

const roomLog = createLogger("colyseus.MatchRoom");

export class MatchRoom extends Room<{ state: MatchStateSchema }> {
  private matchId: string = "";
  private seed: string = "";
  private invites!: InviteStore;
  private matches!: MatchRegistry;
  private engine: GameEngine | null = null;
  private seats = new Map<string, SeatRecord>();
  private lastActionAt = new Map<string, number>();
  private lastRackRecoveryAt = new Map<string, number>();
  private lastPendingUpdateAt = new Map<string, number>();
  private autoDisposeTimeoutMs = MATCH_ROOM_DEFAULTS.autoDisposeTimeoutMs;
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
    this.setSeatReservationTime(this.autoDisposeTimeoutMs);

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
    const error = getJoinAuthError({
      expectedMatchId: this.matchId,
      options,
      started: this.state.started,
      hostSessionId: this.state.hostSessionId,
      playerCount: this.state.players.length,
      maxPlayers: this.state.maxPlayers,
    });
    if (error) throw new Error(error);
    return true;
  }

  override onJoin(client: Client, options: JoinOptions): void {
    if (options.role !== "host" && options.role !== "player") {
      throw new Error("Invalid role");
    }
    const role = options.role;
    const name = resolveJoinName(options.name);

    const seatIndex =
      role === "host"
        ? 0
        : nextAvailableSeatIndex(this.state.players, this.state.maxPlayers, this.state.players.length);

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
    const seat: SeatRecord = createSeatRecord({
      sessionId: client.sessionId,
      role,
      seatIndex,
      name,
      bankRemainingMs: bankMs,
    });
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
      view.color = pickFirstAvailableColor(this.state.players, client.sessionId, seatIndex);
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

  private handlePickColor(client: Client, rawPayload: unknown): void {
    const parsed = pickColorSchema.safeParse(rawPayload);
    if (!parsed.success) {
      this.sendError(client, "invalid_color", parsed.error.issues[0]?.message ?? "Invalid color");
      return;
    }
    if (!this.ensureLobbyOpen(client, "Cannot change color after start")) return;
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
    if (now - last < MATCH_ROOM_DEFAULTS.pendingUpdateThrottleMs) return;
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

  private handleStartMatch(client: Client, rawPayload: unknown): void {
    const parsed = startMessageSchema.safeParse(rawPayload ?? {});
    if (!parsed.success) {
      this.sendError(client, "invalid_start", "Invalid start payload");
      return;
    }
    if (!this.ensureLobbyOpen(client, "Match already started")) return;
    if (!this.ensureHost(client, "Only the host can start the match")) return;
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
    if (!this.ensureLobbyOpen(client, "Cannot change time control after start")) return;
    if (!this.ensureHost(client, "Only the host can change time control")) return;
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
    syncSeatBanks(this.seats.values(), (id) => this.playerViewForSession(id), bankMs, false);
  }

  override async onLeave(client: Client, code?: number): Promise<void> {
    roomLog("onLeave", {
      roomId: this.roomId,
      sessionId: client.sessionId,
      matchId: this.matchId,
      code,
      consented: code === MATCH_ROOM_DEFAULTS.consentedCloseCode,
    });
    const seat = this.seats.get(client.sessionId);
    if (seat) {
      seat.connected = false;
      const view = this.playerViewForSession(client.sessionId);
      if (view) view.connected = false;
    }

    // code 1000 = normal closure (consented). Anything else = try reconnect.
    const consented = code === MATCH_ROOM_DEFAULTS.consentedCloseCode;
    if (consented) return;

    try {
      await this.allowReconnection(client, MATCH_ROOM_DEFAULTS.reconnectionGraceSeconds);
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
    syncSeatBanks(this.seats.values(), (id) => this.playerViewForSession(id), bankMs, true);
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
    const handle = this.clock.setInterval(
      () => this.onClockTick(),
      MATCH_ROOM_DEFAULTS.clockTickIntervalMs,
    );
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
    const settled = settleTurnState({
      bankBeforeMs: view.bankRemainingMs,
      elapsedMs: elapsed,
      turnMinutes: this.state.turnMinutes,
      incrementSeconds: this.state.incrementSeconds,
      previewPenalty,
    });

    view.bankRemainingMs = settled.bankRemainingMs;
    view.turnElapsedMs = 0;
    if (settled.penaltyDelta > 0) {
      seat.penaltyScoreTotal += settled.penaltyDelta;
      seat.overtimePenalty = settled.overtimePenalty;
      view.overtimePenalty = settled.overtimePenalty;
    } else {
      seat.overtimePenalty = 0;
      view.overtimePenalty = 0;
    }
  }

  private withActionGuard<T>(
    client: Client,
    schema: ZodType<T>,
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

    const bonuses = calculateTriggerBBonuses(snap.players);
    for (const p of snap.players) {
      const view = this.playerViewForSession(p.id);
      if (view) view.score += bonuses.get(p.id) ?? 0;
    }
  }

  private finalizeWinner(): void {
    this.state.winnerSessionId = pickWinnerSessionId(Array.from(this.state.players));
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

    syncFromEngineSnapshot({
      state: this.state,
      snapshot: snap,
      seats: this.seats,
      playerViewForSession: (sessionId) => this.playerViewForSession(sessionId),
      ctx,
    });
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
    if (now - last < MATCH_ROOM_DEFAULTS.actionRateLimitWindowMs) {
      this.sendError(client, "rate_limited", "Slow down");
      return false;
    }
    this.lastActionAt.set(client.sessionId, now);
    return true;
  }

  private ensureLobbyOpen(client: Client, alreadyStartedMsg: string): boolean {
    if (this.state.started || this.state.phase !== "waiting") {
      this.sendError(client, "already_started", alreadyStartedMsg);
      return false;
    }
    return true;
  }

  private ensureHost(client: Client, notHostMsg: string): boolean {
    if (client.sessionId !== this.state.hostSessionId) {
      this.sendError(client, "not_host", notHostMsg);
      return false;
    }
    return true;
  }

  private ensureRackRecoveryAllowed(client: Client, reason: string): boolean {
    const now = Date.now();
    const last = this.lastRackRecoveryAt.get(client.sessionId) ?? 0;
    if (now - last < MATCH_ROOM_DEFAULTS.rackRecoveryWindowMs) {
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
