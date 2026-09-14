import { describe, expect, it } from "vitest";
import { isValidBasicAuth } from "../src/lib/basic-auth.ts";
import { basicAuthHeader, useTestApp } from "./helpers.ts";

describe("isValidBasicAuth", () => {
  it("accepts correct credentials", () => {
    expect(isValidBasicAuth(basicAuthHeader("docs", "secret"), "docs", "secret")).toBe(true);
  });

  it("accepts passwords that contain colons", () => {
    expect(isValidBasicAuth(basicAuthHeader("docs", "a:b:c"), "docs", "a:b:c")).toBe(true);
  });

  it("rejects a password prefix followed by extra segments", () => {
    expect(isValidBasicAuth(basicAuthHeader("docs", "a:extra"), "docs", "a")).toBe(false);
  });

  it.each([
    ["missing header", undefined],
    ["bearer header", "Bearer token"],
    ["no colon", `Basic ${Buffer.from("docs").toString("base64")}`],
    ["wrong user", basicAuthHeader("other", "secret")],
    ["wrong password", basicAuthHeader("docs", "nope")],
  ])("rejects %s", (_label, header) => {
    expect(isValidBasicAuth(header, "docs", "secret")).toBe(false);
  });
});

describe("/api/docs protection", () => {
  const app = useTestApp();

  it("requires credentials for the UI and the OpenAPI JSON", async () => {
    for (const url of ["/api/docs", "/api/docs/json"]) {
      const response = await app().inject({ method: "GET", url });
      expect(response.statusCode).toBe(401);
      expect(response.headers["www-authenticate"]).toBe('Basic realm="API Docs"');
    }
  });

  it("serves the OpenAPI spec with valid credentials", async () => {
    const response = await app().inject({
      method: "GET",
      url: "/api/docs/json",
      headers: { authorization: basicAuthHeader("docs", "pa:ss:word") },
    });

    expect(response.statusCode).toBe(200);
    const spec = response.json<{ paths: Record<string, unknown> }>();
    const expectedPaths = [
      "/api/health",
      // @setup-if auth!=none
      "/api/me",
      // @setup-endif
      // @setup-if auth!=none&orm!=none
      "/api/todos",
      // @setup-endif
      // @setup-if storage=s3,local
      "/api/files",
      // @setup-endif
    ];
    expect(Object.keys(spec.paths)).toEqual(expect.arrayContaining(expectedPaths));
  });
});
