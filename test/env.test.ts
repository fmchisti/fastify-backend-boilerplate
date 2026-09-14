import { describe, expect, it } from "vitest";
import { parseEnv } from "../src/config/env";

const validEnv = {
  DATABASE_URL: "postgresql://u:p@localhost:5432/db",
  BACKEND_URL: "http://localhost:3000",
  SUPABASE_URL: "https://x.supabase.co",
  SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_KEY: "service",
};

describe("parseEnv", () => {
  it("applies defaults and coerces numbers", () => {
    const env = parseEnv(validEnv);

    expect(env.PORT).toBe(3000);
    expect(env.HOST).toBe("0.0.0.0");
    expect(env.NODE_ENV).toBe("development");
    expect(env.SESSION_DURATION_DAYS).toBe(7);
  });

  it("coerces PORT from a string", () => {
    expect(parseEnv({ ...validEnv, PORT: "8080" }).PORT).toBe(8080);
  });

  it("lists every invalid variable in the error", () => {
    expect(() =>
      parseEnv({ ...validEnv, DATABASE_URL: "nope", PORT: "abc" }),
    ).toThrow(/DATABASE_URL[\s\S]*PORT|PORT[\s\S]*DATABASE_URL/);
  });
});
