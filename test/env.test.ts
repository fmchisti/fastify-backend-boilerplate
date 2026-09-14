import { describe, expect, it } from "vitest";
import { parseEnv } from "../src/config/env.ts";

const validEnv = {
  DATABASE_URL: "postgresql://u:p@localhost:5432/db",
};

describe("parseEnv", () => {
  it("applies defaults and coerces numbers", () => {
    const env = parseEnv(validEnv);

    expect(env.PORT).toBe(3000);
    expect(env.HOST).toBe("0.0.0.0");
    expect(env.NODE_ENV).toBe("development");
  });

  it("coerces PORT from a string", () => {
    expect(parseEnv({ ...validEnv, PORT: "8080" }).PORT).toBe(8080);
  });

  it("does not require any auth or storage provider variables", () => {
    expect(() => parseEnv(validEnv)).not.toThrow();
  });

  it("lists every invalid variable in the error", () => {
    expect(() => parseEnv({ ...validEnv, DATABASE_URL: "nope", PORT: "abc" })).toThrow(
      /DATABASE_URL[\s\S]*PORT|PORT[\s\S]*DATABASE_URL/,
    );
  });

  it.each([
    [undefined, false],
    ["false", false],
    ["true", true],
    ["2", 2],
    ["10.0.0.0/8, 127.0.0.1", ["10.0.0.0/8", "127.0.0.1"]],
  ])("parses TRUST_PROXY=%s", (value, expected) => {
    expect(parseEnv({ ...validEnv, ...(value !== undefined && { TRUST_PROXY: value }) }).TRUST_PROXY).toEqual(
      expected,
    );
  });

  it("parses CORS_ORIGINS as a list of URLs", () => {
    expect(parseEnv({ ...validEnv, CORS_ORIGINS: "https://a.com, https://b.com" }).CORS_ORIGINS).toEqual([
      "https://a.com",
      "https://b.com",
    ]);
    expect(() => parseEnv({ ...validEnv, CORS_ORIGINS: "not-a-url" })).toThrow(/CORS_ORIGINS/);
  });

  it("disables docs by default only in production", () => {
    expect(parseEnv({ ...validEnv, NODE_ENV: "development" }).DOCS_ENABLED).toBe(true);
    expect(parseEnv({ ...validEnv, NODE_ENV: "production" }).DOCS_ENABLED).toBe(false);
    expect(parseEnv({ ...validEnv, NODE_ENV: "production", DOCS_ENABLED: "true" }).DOCS_ENABLED).toBe(true);
  });
});
