import { z } from "zod";
import { TILE_CONFIGS, VALID_BLANK_ASSIGNMENTS } from "@entities";
import { PLAYER_COLOR_KEYS } from "@b-m4th/shared";
import { timeControlSchema } from "./time-control-schema";

const positionSchema = z.object({
  row: z.number().int().min(0).max(100),
  col: z.number().int().min(0).max(100),
});

const blankAssignmentSchema = z.enum(VALID_BLANK_ASSIGNMENTS);
const pendingUpdateFaceSet = new Set<string>([
  ...TILE_CONFIGS.map((tile) => tile.face),
  ...VALID_BLANK_ASSIGNMENTS,
]);

const playMoveSchema = z.object({
  tileId: z.string().min(1).max(64),
  position: positionSchema,
  assignedFace: blankAssignmentSchema.optional(),
});

export const playMessageSchema = z.object({
  moves: z.array(playMoveSchema).min(1).max(32),
});

export const swapMessageSchema = z.object({
  tileIds: z.array(z.string().min(1).max(64)).min(1).max(32),
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
  row: z.number().int().min(0).max(100),
  col: z.number().int().min(0).max(100),
  face: z
    .string()
    .min(1)
    .max(10)
    .refine((face) => pendingUpdateFaceSet.has(face), "Invalid tile face"),
  assignedFace: blankAssignmentSchema.optional(),
  value: z.number().int().min(0).max(100),
});

export const pendingUpdateSchema = z.object({
  moves: z.array(pendingUpdateMoveSchema).max(32),
});
