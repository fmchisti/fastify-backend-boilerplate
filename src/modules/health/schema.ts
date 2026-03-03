import { z } from "zod";

// Health check
export const HealthCheckSchemaResponse = z.object({
  status: z.string(),
  timestamp: z.string(),
  uptime: z.number(),
  environment: z.string(),
});

export type HealthCheckResponse = z.infer<typeof HealthCheckSchemaResponse>;

// Health check schema
export const HealthCheckSchema = {
  response: {
    200: HealthCheckSchemaResponse,
  },
};
