import { Redis } from "ioredis";
import { z } from "zod";
import { loadEnv } from "../config/env.ts";

const redisEnvSchema = z.object({
  // redis://user:password@host:6379/0 or rediss:// for TLS (Railway, Upstash, ElastiCache)
  REDIS_URL: z
    .url()
    .refine((url) => /^rediss?:\/\//.test(url), "REDIS_URL must start with redis:// or rediss://"),
});

export type { Redis };

/**
 * Shared Redis client. Used for the rate-limit store so limits apply across instances.
 * Reuse it for caching, queues, or Better Auth `secondaryStorage`.
 */
export const createRedis = (
  url: string = loadEnv(redisEnvSchema, process.env, "Redis env").REDIS_URL,
): Redis =>
  new Redis(url, {
    // Fail fast instead of queueing commands while disconnected; callers decide how to degrade
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectionName: "api",
  });
