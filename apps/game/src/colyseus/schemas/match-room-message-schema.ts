import { z } from "zod";
import { GAME_CONFIG, VALID_BLANK_ASSIGNMENTS } from "@entities";
import { PLAYER_COLOR_KEYS } from "@b-m4th/shared";
import { timeControlSchema } from "./time-control-schema";

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

export const playMessageSchema = z.object({
  moves: z.array(playMoveSchema).min(1).max(GAME_CONFIG.RACK_SIZE),
});

export const swapMessageSchema = z.object({
  tileIds: z.array(z.string().min(1).max(64)).min(1).max(GAME_CONFIG.RACK_SIZE),
});

export const passMessageSchema = z.object({}).strict();

export const startMessageSchema = z.object({}).strict();

export const setTimeControlSchema = timeControlSchema;

export const pickColorSchema = z.object({
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

export const pendingUpdateSchema = z.object({
  moves: z.array(pendingUpdateMoveSchema).max(GAME_CONFIG.RACK_SIZE),
});
