import { describe, expect, it } from "vitest";
import { HealthCheckResponseSchema } from "../src/modules/health/schema.ts";
import { createFakeDatabase } from "./fakes/database.ts";
import { useTestApp } from "./helpers.ts";

describe("GET /api/health", () => {
  const app = useTestApp();

  it("returns a healthy status matching the response schema", async () => {
    const response = await app().inject({ method: "GET", url: "/api/health" });

    expect(response.statusCode).toBe(200);
    const body = HealthCheckResponseSchema.parse(response.json());
    expect(body.status).toBe("healthy");
    expect(body.environment).toBe("test");
  });
});

describe("GET /api/health/ready", () => {
  const database = createFakeDatabase();
  const app = useTestApp(() => ({ database }));

  it("returns 200 when the database responds", async () => {
    database.healthy = true;

    const response = await app().inject({ method: "GET", url: "/api/health/ready" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "ready", checks: { database: "up" } });
  });

  it("returns 503 when the database is unreachable", async () => {
    database.healthy = false;

    const response = await app().inject({ method: "GET", url: "/api/health/ready" });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      error: "Service Unavailable",
      message: "Unavailable: database",
    });
  });
});

describe("GET /", () => {
  const app = useTestApp();

  it("returns API info", async () => {
    const response = await app().inject({ method: "GET", url: "/" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ name: "fastify-backend-boilerplate", version: "1.0.0" });
  });
});
