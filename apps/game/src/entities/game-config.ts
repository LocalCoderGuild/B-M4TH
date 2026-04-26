import type { Position } from "./board.types";

export interface TimeControl {
  /** Fischer base time, minutes. */
  baseMinutes: number;
  /** Fischer increment, seconds added to the mover after each move. */
  incrementSeconds: number;
  /** Per-turn timer, minutes before overtime penalties start. */
  turnMinutes: number;
}

export const GAME_CONFIG = {
  BOARD_SIZE: 15,
  RACK_SIZE: 8,
  SWAP_BAG_MINIMUM: 5,
  BINGO_BONUS: 40,
  TOTAL_BANK_TIME_SECONDS: 22 * 60,
  OVERTIME_PENALTY_PER_MINUTE: 10,
  DEFAULT_START_POSITION: { row: 7, col: 7 } as Position,
} as const;

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;

export const TIME_CONTROL_LIMITS = {
  baseMinutes: { min: 1, max: 90 },
  incrementSeconds: { min: 0, max: 60 },
  turnMinutes: { min: 1, max: 90 },
} as const;

export const DEFAULT_TIME_CONTROL: TimeControl = {
  baseMinutes: 10,
  incrementSeconds: 5,
  turnMinutes: 3,
};

export const SCHEMA_DEFAULT_TIME_CONTROL: TimeControl = {
  baseMinutes: 22,
  incrementSeconds: 0,
  turnMinutes: 3,
};

export const MATCH_TTL_MS = 2 * 60 * 60 * 1000;
export const INVITE_TTL_MS = 60 * 60 * 1000;
export const TTL_SWEEP_INTERVAL_MS = 5 * 60 * 1000;
