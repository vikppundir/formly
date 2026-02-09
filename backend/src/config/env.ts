/**
 * Environment-based configuration. No secrets in source (SOC 2).
 * Validate on load so the app fails fast if required vars are missing.
 */

import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  BACKEND_PORT: z.string().transform(Number).default(process.env.PORT || "4000"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("7d"),
  COOKIE_DOMAIN: z.string().optional(),
  COOKIE_SECURE: z.string().transform((v) => v === "true").default("true"),
  COOKIE_SAMESITE: z.enum(["strict", "lax", "none"]).default("lax"),
  CORS_ORIGIN: z.string().optional().default(""),
  FIELD_ENCRYPTION_KEY: z.string().min(32, "FIELD_ENCRYPTION_KEY must be at least 32 characters for AES-256").optional(),
  RATE_LIMIT_AUTH_WINDOW_MS: z.string().transform(Number).default("900000"),
  RATE_LIMIT_AUTH_MAX: z.string().transform(Number).default("10"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid environment:", parsed.error.flatten());
    throw new Error("Invalid environment configuration");
  }
  cached = parsed.data;
  return cached;
}
