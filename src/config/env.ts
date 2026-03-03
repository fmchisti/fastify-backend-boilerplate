import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid URL"),
  BACKEND_URL: z.string().url("BACKEND_URL must be a valid URL"),
  FRONTEND_URL: z
    .string()
    .url("FRONTEND_URL must be a valid URL")
    .optional(),

  // Supabase
  SUPABASE_URL: z.string().url("SUPABASE_URL must be a valid URL"),
  SUPABASE_ANON_KEY: z.string().min(1, "SUPABASE_ANON_KEY is required"),
  SUPABASE_SERVICE_KEY: z.string().min(1, "SUPABASE_SERVICE_KEY is required"),

  // Server
  PORT: z
    .string()
    .regex(/^\d+$/, "PORT must be a number")
    .transform((val) => Number(val))
    .pipe(z.number().int().positive())
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
    .enum(["trace", "debug", "info", "warn", "error", "fatal"], {
      message:
        "LOG_LEVEL must be one of: trace, debug, info, warn, error, fatal",
    })
    .optional(),

  // Auth: intended session duration in days (configure JWT/Session expiry in Supabase Dashboard to match)
  SESSION_DURATION_DAYS: z
    .string()
    .regex(/^\d+$/, "SESSION_DURATION_DAYS must be a positive integer")
    .optional()
    .default("7")
    .transform((val) => Number(val))
    .pipe(z.number().int().positive()),

  // API Docs (optional – if both set, /api/docs is protected with HTTP Basic Auth)
  DOCS_USERNAME: z.string().min(1).optional(),
  DOCS_PASSWORD: z.string().min(1).optional(),
});

// Parse and validate environment variables
const parseEnv = () => {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.issues
        .map((err: z.ZodIssue) => `${err.path.join(".")}: ${err.message}`)
        .join("\n");
      throw new Error(`Invalid environment variables:\n${errorMessages}`);
    }
    throw error;
  }
};

export const env = parseEnv();

// Type export for use in other files
export type Env = z.infer<typeof envSchema>;
