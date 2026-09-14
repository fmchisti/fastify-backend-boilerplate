import { describe, expect, it, vi } from "vitest";
import { createRedisMock } from "./fakes/redis.ts";
import { buildTestApp, testEnv, withLimitedRoute } from "./helpers.ts";

const hit = (app: Awaited<ReturnType<typeof buildTestApp>>) =>
  app.inject({ method: "GET", url: "/api/limited" });

describe("Redis", () => {
  it("shares rate limits across app instances", async () => {
    // One Redis, two instances behind a load balancer
    const redis = createRedisMock();
    const env = testEnv({ RATE_LIMIT_MAX: "2" });
    const first = await buildTestApp({ redis }, env, withLimitedRoute);
    const second = await buildTestApp({ redis }, env, withLimitedRoute);

    expect((await hit(first)).statusCode).toBe(200);
    expect((await hit(second)).statusCode).toBe(200);
    expect((await hit(first)).statusCode).toBe(429);
    expect((await hit(second)).statusCode).toBe(429);

    await first.close();
    await second.close();
  });

  it("allows requests when Redis fails instead of returning errors", async () => {
    const redis = createRedisMock();
    // The rate-limit store reuses an existing `rateLimit` command; make every call fail
    redis.defineCommand("rateLimit", { numberOfKeys: 1, lua: "return redis.error_reply('connection lost')" });
    const app = await buildTestApp({ redis }, testEnv({ RATE_LIMIT_MAX: "1" }), withLimitedRoute);

    expect((await hit(app)).statusCode).toBe(200);
    expect((await hit(app)).statusCode).toBe(200);
    await app.close();
  });

  it("reports Redis in the readiness check", async () => {
    const redis = createRedisMock();
    const app = await buildTestApp({ redis });

    const ready = await app.inject({ method: "GET", url: "/api/health/ready" });
    expect(ready.json()).toMatchObject({ status: "ready", checks: { redis: "up" } });

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
