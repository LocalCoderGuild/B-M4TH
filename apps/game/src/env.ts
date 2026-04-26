import z from "zod";

export const env = z
  .object({
    ENGINE_HOST: z.string().default("0.0.0.0"),
    ENGINE_PORT: z.coerce.number().int(),
    API_HOST: z.string().default("0.0.0.0"),
    API_PORT: z.coerce.number().int(),

    PUBLIC_ENGINE_URL: z.string().optional(),
    PUBLIC_API_URL: z.string().optional(),

    CLIENT_ORIGIN: z.string(),
    NODE_ENV: z.enum(["production", "development"]).default("production"),
  })
  .parse(Bun.env);
