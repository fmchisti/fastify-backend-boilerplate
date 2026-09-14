import { z } from "zod";

export const HealthCheckResponseSchema = z.object({
  status: z.literal("healthy"),
  timestamp: z.iso.datetime(),
  uptime: z.number().int().nonnegative(),
  environment: z.enum(["development", "production", "test"]),
});

export type HealthCheckResponse = z.infer<typeof HealthCheckResponseSchema>;

export const HealthCheckSchema = {
  response: {
    200: HealthCheckResponseSchema,
  },
};

export const ReadinessResponseSchema = z.object({
  status: z.literal("ready"),
  database: z.literal("up"),
});
