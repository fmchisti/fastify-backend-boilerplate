import { afterAll, beforeAll } from "vitest";
import { type App, buildApp } from "../src/app.ts";
import { type Env, parseEnv } from "../src/config/env.ts";
import type { AppDependencies } from "../src/container.ts";
import { createFakeAuthProvider } from "./fakes/auth.ts";
import { createFakeDatabase } from "./fakes/database.ts";
import { createMemoryStorage } from "./fakes/storage.ts"; // @setup-if storage=s3,local
import { createMemoryTodoRepository } from "./fakes/todo-repository.ts";

/** Fake implementations of every dependency. No database, network, or provider credentials needed. */
export const createTestDependencies = (overrides: Partial<AppDependencies> = {}): AppDependencies => ({
  database: createFakeDatabase(),
  auth: createFakeAuthProvider(),
  todos: createMemoryTodoRepository(),
  // @setup-if storage=s3,local
  storage: createMemoryStorage(),
  // @setup-endif
  ...overrides,
});

/** Core env for tests, with optional overrides (e.g. `{ RATE_LIMIT_MAX: "2" }`). */
export const testEnv = (overrides: Record<string, string> = {}): Env =>
  parseEnv({ ...process.env, ...overrides });

export const buildTestApp = async (
  overrides: Partial<AppDependencies> = {},
  env: Env = testEnv(),
): Promise<App> => {
  const app = await buildApp(createTestDependencies(overrides), { env });
  await app.ready();
  return app;
};

/**
 * Builds one app per test file and closes it afterwards.
 * `overrides` is a function so each file gets fresh fakes.
 */
export const useTestApp = (overrides: () => Partial<AppDependencies> = () => ({})): (() => App) => {
  let app: App | undefined;

  beforeAll(async () => {
    app = await buildTestApp(overrides());
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

/** Builds a multipart/form-data body for `app.inject`. */
export const multipartBody = (
  field: string,
  file: { filename: string; contentType: string; data: Buffer | string },
) => {
  const boundary = `----test${Date.now()}`;
  const payload = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${field}"; filename="${file.filename}"\r\n` +
        `Content-Type: ${file.contentType}\r\n\r\n`,
    ),
    Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data),
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return { payload, headers: { "content-type": `multipart/form-data; boundary=${boundary}` } };
};
