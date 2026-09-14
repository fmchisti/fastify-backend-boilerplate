import { describe, expect, it, vi } from "vitest";
import { bearer } from "./fakes/auth.ts";
import { createRedisMock } from "./fakes/redis.ts";
import { buildTestApp, testEnv } from "./helpers.ts";

const me = (app: Awaited<ReturnType<typeof buildTestApp>>) =>
  app.inject({ method: "GET", url: "/api/me", headers: bearer("alice-token") });

describe("Redis", () => {
  it("shares rate limits across app instances", async () => {
    // One Redis, two instances behind a load balancer
    const redis = createRedisMock();
    const env = testEnv({ RATE_LIMIT_MAX: "2" });
    const first = await buildTestApp({ redis }, env);
    const second = await buildTestApp({ redis }, env);

    expect((await me(first)).statusCode).toBe(200);
    expect((await me(second)).statusCode).toBe(200);
    expect((await me(first)).statusCode).toBe(429);
    expect((await me(second)).statusCode).toBe(429);

    await first.close();
    await second.close();
  });

  it("allows requests when Redis fails instead of returning errors", async () => {
    const redis = createRedisMock();
    // The rate-limit store reuses an existing `rateLimit` command; make every call fail
    redis.defineCommand("rateLimit", { numberOfKeys: 1, lua: "return redis.error_reply('connection lost')" });
    const app = await buildTestApp({ redis }, testEnv({ RATE_LIMIT_MAX: "1" }));

    expect((await me(app)).statusCode).toBe(200);
    expect((await me(app)).statusCode).toBe(200);
    await app.close();
  });

  it("reports Redis in the readiness check", async () => {
    const redis = createRedisMock();
    const app = await buildTestApp({ redis });

    const ready = await app.inject({ method: "GET", url: "/api/health/ready" });
    expect(ready.json()).toEqual({ status: "ready", checks: { database: "up", redis: "up" } });

    vi.spyOn(redis, "ping").mockRejectedValue(new Error("ECONNREFUSED"));
    const down = await app.inject({ method: "GET", url: "/api/health/ready" });
    expect(down.statusCode).toBe(503);
    expect(down.json()).toEqual({ error: "Service Unavailable", message: "Unavailable: redis" });
    await app.close();
  });

  it("closes the connection on shutdown", async () => {
    const redis = createRedisMock();
    const quit = vi.spyOn(redis, "quit");
    const app = await buildTestApp({ redis });

    await app.close();

    expect(quit).toHaveBeenCalledOnce();
  });
});
