/**
 * OpenAPI / Swagger documentation for Todo endpoints.
 * Spread these into route schemas for consistent API docs.
 */

const base = { tags: ["Todos"], security: [{ bearerAuth: [] }] };

export const listTodosDocs = {
  ...base,
  summary: "List todos",
  description: "Paginated todos of the current user.",
};
export const getTodoDocs = { ...base, summary: "Get a todo" };
export const createTodoDocs = { ...base, summary: "Create a todo" };
export const updateTodoDocs = { ...base, summary: "Update a todo", description: "Partial update." };
export const deleteTodoDocs = { ...base, summary: "Delete a todo" };
