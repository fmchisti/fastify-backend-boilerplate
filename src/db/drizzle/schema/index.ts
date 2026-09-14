// Every table the app uses. drizzle.config.ts and the Drizzle client read this file.
export * from "./auth.ts"; // @setup-if auth=better-auth
export * from "./todos.ts";
