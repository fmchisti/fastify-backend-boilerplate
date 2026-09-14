/**
 * OpenAPI / Swagger documentation for Health endpoints.
 * Spread these into route schemas for consistent API docs.
 */

const TAG = "Health" as const;

export const healthCheckDocs = {
  tags: [TAG],
  summary: "Get API health status",
  description: "Health check endpoint to verify API status and uptime.",
} as const;

export const readinessDocs = {
  tags: [TAG],
  summary: "Get API readiness",
  description: "Returns 503 when the database is unreachable.",
} as const;
