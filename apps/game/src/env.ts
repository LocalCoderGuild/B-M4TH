import z from "zod";

export const env = z
  .object({
    ENGINE_HOST: z.string().default("0.0.0.0"),
    ENGINE_PORT: z.coerce.number().int().default(2566),
    API_HOST: z.string().default("0.0.0.0"),
    API_PORT: z.coerce.number().int().default(2567),

    PUBLIC_ENGINE_URL: z.string().optional(),
    PUBLIC_API_URL: z.string().optional(),
    PUBLIC_BASE_URL: z.string().optional(),

    CLIENT_ORIGIN: z.string().optional(),
    // enum(["production", "development"])
    NODE_ENV: z.string().default("production"),
  })
  .parse(Bun.env);
