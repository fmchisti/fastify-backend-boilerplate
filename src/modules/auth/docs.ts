/**
 * OpenAPI / Swagger documentation for Auth endpoints.
 * Spread these into route schemas for consistent API docs.
 */

const TAG = "Auth";

export const meDocs = {
  tags: [TAG],
  summary: "Get current user",
  description: "Returns the user identified by the bearer token.",
  security: [{ bearerAuth: [] }],
};
