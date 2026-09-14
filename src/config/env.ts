import "dotenv/config";
import { z } from "zod";

/**
 * Validate environment variables against a Zod schema.
 * Core config uses it below; each provider (auth, storage, ...) calls it with
 * its own schema, so only the selected provider's variables are required.
 */
export const loadEnv = <TSchema extends z.ZodType>(
  schema: TSchema,
  source: NodeJS.ProcessEnv = process.env,
  label = "environment variables",
): z.output<TSchema> => {
  const result = schema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid ${label}:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
};

const coreEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"], {
      message: "NODE_ENV must be 'development', 'production', or 'test'",
    })
    .default("development"),
  PORT: z.coerce
    .number<string>("PORT must be a number")
    .int()
    .positive()
    .default(3000),
  HOST: z.string().min(1).default("0.0.0.0"),
  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal", "silent"])
    .optional(),

  // Public URL of this API (used in OpenAPI servers)
  BACKEND_URL: z.url("BACKEND_URL must be a valid URL").optional(),
  // Frontend origin allowed by CORS
  FRONTEND_URL: z.url("FRONTEND_URL must be a valid URL").optional(),

  // PostgreSQL connection string (local, Docker, Railway, Supabase, Neon, RDS, ...)
  DATABASE_URL: z.url("DATABASE_URL must be a valid postgres:// URL"),

  // API docs (optional – when both set, /api/docs is protected with HTTP Basic Auth)
  DOCS_USERNAME: z.string().min(1).optional(),
  DOCS_PASSWORD: z.string().min(1).optional(),
});

export type Env = z.infer<typeof coreEnvSchema>;

/** Validate core env. Exported so tests can check parsing without touching process.env. */
export const parseEnv = (source: NodeJS.ProcessEnv): Env =>
  loadEnv(coreEnvSchema, source);

export const env: Env = parseEnv(process.env);
