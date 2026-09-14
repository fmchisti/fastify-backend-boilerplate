import { describe, expect, it } from "vitest";
import type { AuthProvider } from "../src/auth/types.ts";
import { ALICE, bearer } from "./fakes/auth.ts";
import { buildTestApp, useTestApp } from "./helpers.ts";

describe("GET /api/me", () => {
  const app = useTestApp();

  it("returns 401 without credentials", async () => {
    const response = await app().inject({ method: "GET", url: "/api/me" });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "Unauthorized", message: "Authentication required" });
  });

  it("returns 401 for an unknown token", async () => {
    const response = await app().inject({ method: "GET", url: "/api/me", headers: bearer("nope") });

    expect(response.statusCode).toBe(401);
  });

  it("returns the user resolved by the auth provider", async () => {
    const response = await app().inject({
      method: "GET",
      url: "/api/me",
      headers: bearer("alice-token"),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(ALICE);
  });
});

describe("auth provider failures", () => {
  it("returns 500 without leaking details when the provider is unreachable", async () => {
    const brokenAuth: AuthProvider = {
      name: "broken",
      getUser: async () => {
        throw new Error("connect ECONNREFUSED 10.0.0.1:443");
      },
    };
    const app = await buildTestApp({ auth: brokenAuth });

    const response = await app.inject({ method: "GET", url: "/api/me", headers: bearer("x") });

    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain("ECONNREFUSED");
    await app.close();
  });

  it("registers provider routes under /api/auth", async () => {
    const withRoutes: AuthProvider = {
      name: "with-routes",
      getUser: async () => null,
      routes: async (fastify) => {
        fastify.get("/ping", async () => ({ pong: true }));
      },
    };
    const app = await buildTestApp({ auth: withRoutes });

    const response = await app.inject({ method: "GET", url: "/api/auth/ping" });

    expect(response.json()).toEqual({ pong: true });
    await app.close();
  });
});
