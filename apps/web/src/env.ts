import z from "zod";

export const env = z
  .object({
    // "ws://127.0.0.1:2567"
    VITE_ENGINE_URL: z.string().optional(),
    VITE_API_URL: z.string().default("http://127.0.0.1:2566"),
    VITE_PUBLIC_URL: z.string().default("http://127.0.0.1:5173"),
  })
  .parse(import.meta.env);
