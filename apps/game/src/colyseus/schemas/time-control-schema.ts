import { z } from "zod";
import { TIME_CONTROL_LIMITS } from "@entities";

export const timeControlSchema = z.object({
  baseMinutes: z.number().int()
    .min(TIME_CONTROL_LIMITS.baseMinutes.min)
    .max(TIME_CONTROL_LIMITS.baseMinutes.max),
  incrementSeconds: z.number().int()
    .min(TIME_CONTROL_LIMITS.incrementSeconds.min)
    .max(TIME_CONTROL_LIMITS.incrementSeconds.max),
  turnMinutes: z.number().int()
    .min(TIME_CONTROL_LIMITS.turnMinutes.min)
    .max(TIME_CONTROL_LIMITS.turnMinutes.max),
});
