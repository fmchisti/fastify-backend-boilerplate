import { memoryAdapter } from "better-auth/adapters/memory";
import Fastify from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { App } from "../../src/app.ts";
import {
  CLIENT_IP_HEADER,
  createBetterAuthProvider,
  toWebRequest,
} from "../../src/auth/providers/better-auth/index.ts";
import { bearer } from "../fakes/auth.ts";
import { buildTestApp } from "../helpers.ts";

/** Full flow against the real Better Auth handler with an in-memory database. */
describe("Better Auth provider", () => {
  let app: App;

  beforeAll(async () => {
    const auth = createBetterAuthProvider({
      database: memoryAdapter({ user: [], session: [], account: [], verification: [] }),
      baseURL: "http://localhost:3000",
      secret: "test-secret-that-is-at-least-32-characters-long",
    });
    app = await buildTestApp({ auth });
  });

  afterAll(() => app.close());

  const credentials = { email: "ada@example.com", password: "correct-horse-battery", name: "Ada" };

  it("signs up, returns a bearer token, and resolves /api/me", async () => {
    const signUp = await app.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      payload: credentials,
    });
    expect(signUp.statusCode).toBe(200);

    const token = signUp.headers["set-auth-token"];
    expect(typeof token).toBe("string");

    const me = await app.inject({ method: "GET", url: "/api/me", headers: bearer(String(token)) });
    expect(me.statusCode).toBe(200);
    expect(me.json()).toMatchObject({ email: credentials.email, name: "Ada" });
  });

  it("signs in with a session cookie", async () => {
    const signIn = await app.inject({
      method: "POST",
      url: "/api/auth/sign-in/email",
      payload: { email: credentials.email, password: credentials.password },
    });
    expect(signIn.statusCode).toBe(200);

    const setCookie = signIn.headers["set-cookie"];
    const cookies = (Array.isArray(setCookie) ? setCookie : [setCookie ?? ""]).map((c) => c.split(";")[0]).join("; ");
    const me = await app.inject({ method: "GET", url: "/api/me", headers: { cookie: cookies } });
    expect(me.statusCode).toBe(200);
  });

  it("rejects a wrong password and unknown tokens", async () => {
    const signIn = await app.inject({
      method: "POST",
      url: "/api/auth/sign-in/email",
      payload: { email: credentials.email, password: "wrong-password-123" },
    });
    expect(signIn.statusCode).toBe(401);

    const me = await app.inject({ method: "GET", url: "/api/me", headers: bearer("forged") });
    expect(me.statusCode).toBe(401);
  });
});

describe("toWebRequest", () => {
  it("forwards the Fastify-resolved client IP and ignores a spoofed header", async () => {
    const app = Fastify({ trustProxy: true });
    let forwarded: Request | undefined;
    app.post("/api/auth/sign-in/email", async (request) => {
      forwarded = toWebRequest(request);
      return {};
    });

    await app.inject({
      method: "POST",
      url: "/api/auth/sign-in/email",
      headers: { "x-forwarded-for": "203.0.113.7", [CLIENT_IP_HEADER]: "1.2.3.4" },
      payload: { email: "a@example.com" },
    });

    expect(forwarded?.headers.get(CLIENT_IP_HEADER)).toBe("203.0.113.7");
    expect(await forwarded?.json()).toEqual({ email: "a@example.com" });
    expect(forwarded?.url).toBe("http://localhost/api/auth/sign-in/email");
    await app.close();
  });
});
