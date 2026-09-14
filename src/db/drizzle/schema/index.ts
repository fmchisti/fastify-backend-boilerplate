// Every table the app uses. drizzle.config.ts and the Drizzle client read this file.
// @setup-if auth=better-auth
export * from "./auth.ts";
// @setup-endif
export * from "./todos.ts";
