import { describe, expect, it } from "vitest";
import { HealthCheckResponseSchema } from "../src/modules/health/schema";
import { useTestApp } from "./helpers";

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

describe("GET /", () => {
  const app = useTestApp();

  it("returns API info", async () => {
    const response = await app().inject({ method: "GET", url: "/" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ message: "Fastify API", version: "1.0.0" });
  });
});
