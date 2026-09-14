import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { supabaseAdmin } from "../src/config/supabase";
import { errorHandler } from "../src/lib/errors";
import { optionalAuth } from "../src/middleware/auth";
import { requireAuth } from "../src/middleware/authorize";
import { fakeSupabaseUser } from "./helpers";

// Minimal app so middleware can be tested without registering real routes
const buildMiddlewareApp = async (): Promise<FastifyInstance> => {
  const app = Fastify();
  app.setErrorHandler(errorHandler);
  app.decorateRequest("user", null);
  app.get("/optional", { preHandler: [optionalAuth] }, async (request) => ({
    userId: request.user?.id ?? null,
  }));
  app.get(
    "/required",
    { preHandler: [optionalAuth, requireAuth] },
    async (request) => ({ userId: request.user?.id ?? null }),
  );
  await app.ready();
  return app;
};

describe("optionalAuth + requireAuth", () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it("optionalAuth leaves user null for anonymous requests", async () => {
    app = await buildMiddlewareApp();

    const response = await app.inject({ method: "GET", url: "/optional" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ userId: null });
  });

  it("optionalAuth does not fail when Supabase throws", async () => {
    vi.spyOn(supabaseAdmin.auth, "getUser").mockRejectedValue(new Error("down"));
    app = await buildMiddlewareApp();

    const response = await app.inject({
      method: "GET",
      url: "/optional",
      headers: { authorization: "Bearer token" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ userId: null });
  });

  it("requireAuth responds 401 when no user is set", async () => {
    app = await buildMiddlewareApp();

    const response = await app.inject({ method: "GET", url: "/required" });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: "Unauthorized",
      message: "Authentication required",
    });
  });

  it("requireAuth passes when optionalAuth resolved a user", async () => {
    vi.spyOn(supabaseAdmin.auth, "getUser").mockResolvedValue({
      data: { user: fakeSupabaseUser() },
      error: null,
    });
    app = await buildMiddlewareApp();

    const response = await app.inject({
      method: "GET",
      url: "/required",
      headers: { authorization: "Bearer token" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      userId: "11111111-1111-1111-1111-111111111111",
    });
  });
});
