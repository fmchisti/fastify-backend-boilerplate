import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { createSupabaseAuthProvider } from "../../src/auth/providers/supabase/index.ts";
import { bearer } from "../fakes/auth.ts";
import { buildTestApp } from "../helpers.ts";

type GetClaims = SupabaseClient["auth"]["getClaims"];
type ClaimsResult = Awaited<ReturnType<GetClaims>>;

const USER_ID = "11111111-1111-1111-1111-111111111111";

const claimsResult = (claims: Record<string, unknown>): ClaimsResult => ({
  data: {
    claims: {
      sub: USER_ID,
      aud: "authenticated",
      iss: "https://x.supabase.co/auth/v1",
      exp: 0,
      iat: 0,
      role: "authenticated",
      aal: "aal1",
      session_id: "s",
      email: "supa@example.com",
      phone: "",
      is_anonymous: false,
      ...claims,
    },
    header: { alg: "ES256", typ: "JWT", kid: "k" },
    signature: new Uint8Array(),
  },
  error: null,
});

const buildWith = (getClaims: (token: string) => Promise<ClaimsResult>) =>
  buildTestApp({
    auth: createSupabaseAuthProvider({
      auth: { getClaims: (token?: string) => getClaims(token ?? "") },
    }),
  });

describe("Supabase auth provider", () => {
  it("maps verified claims to the user", async () => {
    const app = await buildWith(async () => claimsResult({ user_metadata: { full_name: "Supa Base" } }));

    const response = await app.inject({ method: "GET", url: "/api/me", headers: bearer("token") });

    expect(response.json()).toEqual({ id: USER_ID, email: "supa@example.com", name: "Supa Base" });
    await app.close();
  });

  it("never lets user_metadata override id or email (impersonation)", async () => {
    const app = await buildWith(async () =>
      claimsResult({
        user_metadata: { sub: "victim", id: "victim", email: "victim@example.com" },
      }),
    );

    const response = await app.inject({ method: "GET", url: "/api/me", headers: bearer("token") });

    expect(response.json()).toMatchObject({ id: USER_ID, email: "supa@example.com" });
    await app.close();
  });

  it("returns 401 when Supabase rejects the token", async () => {
    const app = await buildWith(async () => ({ data: null, error: null }));

    const response = await app.inject({ method: "GET", url: "/api/me", headers: bearer("bad") });

    expect(response.statusCode).toBe(401);
    await app.close();
  });
});
