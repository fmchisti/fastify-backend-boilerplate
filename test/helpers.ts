import type { User } from "@supabase/supabase-js";
import { afterAll, beforeAll } from "vitest";
import { type App, buildApp } from "../src/app";

/** Builds one app per test file and closes it afterwards. */
export const useTestApp = (): (() => App) => {
  let app: App | undefined;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app?.close();
  });

  return () => {
    if (!app) throw new Error("Test app not initialized");
    return app;
  };
};

export const basicAuthHeader = (username: string, password: string): string =>
  `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;

export const fakeSupabaseUser = (overrides: Partial<User> = {}): User => ({
  id: "11111111-1111-1111-1111-111111111111",
  email: "user@example.com",
  aud: "authenticated",
  app_metadata: {},
  user_metadata: {},
  created_at: new Date(0).toISOString(),
  ...overrides,
});
