import type { AuthError } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { supabaseAdmin } from "../src/config/supabase";
import { fakeSupabaseUser, useTestApp } from "./helpers";

const mockGetUser = () => vi.spyOn(supabaseAdmin.auth, "getUser");

describe("GET /api/auth/me", () => {
  const app = useTestApp();

  it("returns 401 without an authorization header", async () => {
    const getUser = mockGetUser();

    const response = await app().inject({ method: "GET", url: "/api/auth/me" });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: "Unauthorized",
      message: "Missing or invalid authorization header",
    });
    expect(getUser).not.toHaveBeenCalled();
  });

  it("returns 401 for a non-bearer or empty token", async () => {
    for (const authorization of ["Basic abc", "Bearer ", "Bearer    "]) {
      const response = await app().inject({
        method: "GET",
        url: "/api/auth/me",
        headers: { authorization },
      });
      expect(response.statusCode).toBe(401);
    }
  });

  it("returns 401 when Supabase rejects the token", async () => {
    mockGetUser().mockResolvedValue({
      data: { user: null },
      error: { message: "invalid JWT" } as AuthError,
    });

    const response = await app().inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { authorization: "Bearer bad-token" },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ message: "Invalid or expired token" });
  });

  it("returns 500 without leaking details when Supabase is unreachable", async () => {
    mockGetUser().mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.1"));

    const response = await app().inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { authorization: "Bearer token" },
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      error: "Internal Server Error",
      message: "An unexpected error occurred",
    });
  });

  it("returns the user for a valid token", async () => {
    const getUser = mockGetUser().mockResolvedValue({
      data: { user: fakeSupabaseUser({ user_metadata: { name: "Ada" } }) },
      error: null,
    });

    const response = await app().inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { authorization: "Bearer good-token" },
    });

    expect(getUser).toHaveBeenCalledWith("good-token");
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      id: "11111111-1111-1111-1111-111111111111",
      email: "user@example.com",
      metadata: { name: "Ada" },
    });
  });

  it("does not let user_metadata override id or email (impersonation)", async () => {
    mockGetUser().mockResolvedValue({
      data: {
        user: fakeSupabaseUser({
          user_metadata: {
            id: "22222222-2222-2222-2222-222222222222",
            email: "victim@example.com",
          },
        }),
      },
      error: null,
    });

    const response = await app().inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { authorization: "Bearer attacker-token" },
    });

    const body = response.json<{ id: string; email: string }>();
    expect(body.id).toBe("11111111-1111-1111-1111-111111111111");
    expect(body.email).toBe("user@example.com");
  });
});
