import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  // Database
  DATABASE_URL: z.url("DATABASE_URL must be a valid URL"),
  BACKEND_URL: z.url("BACKEND_URL must be a valid URL"),
  FRONTEND_URL: z.url("FRONTEND_URL must be a valid URL").optional(),

  // Supabase
  SUPABASE_URL: z.url("SUPABASE_URL must be a valid URL"),
  SUPABASE_ANON_KEY: z.string().min(1, "SUPABASE_ANON_KEY is required"),
  SUPABASE_SERVICE_KEY: z.string().min(1, "SUPABASE_SERVICE_KEY is required"),

  // Server
  PORT: z.coerce
    .number<string>("PORT must be a number")
    .int()
    .positive()
    .default(3000),
  HOST: z.string().min(1, "HOST is required").default("0.0.0.0"),

  // Environment
  NODE_ENV: z
    .enum(["development", "production", "test"], {
      message: "NODE_ENV must be 'development', 'production', or 'test'",
    })
    .default("development"),

  // Logging
  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal", "silent"], {
      message:
        "LOG_LEVEL must be one of: trace, debug, info, warn, error, fatal, silent",
    })
    .optional(),

  // Auth: intended session duration in days (configure JWT/Session expiry in Supabase Dashboard to match)
  SESSION_DURATION_DAYS: z.coerce
    .number<string>("SESSION_DURATION_DAYS must be a positive integer")
    .int()
    .positive()
    .default(7),

  // API Docs (optional – if both set, /api/docs is protected with HTTP Basic Auth)
  DOCS_USERNAME: z.string().min(1).optional(),
  DOCS_PASSWORD: z.string().min(1).optional(),
});

export type Env = z.infer<typeof envSchema>;

/** Validate an env source. Exported so tests can check parsing without touching process.env. */
export const parseEnv = (source: NodeJS.ProcessEnv): Env => {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new Error(
      `Invalid environment variables:\n${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
};

export const env: Env = parseEnv(process.env);
