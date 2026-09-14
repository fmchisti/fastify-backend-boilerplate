import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { loadEnv } from "../../../config/env.ts";
import type { AppDatabase } from "../../../db/index.ts";
import { getBearerToken } from "../../bearer.ts";
import type { AuthProvider } from "../../types.ts";

const supabaseEnvSchema = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_ANON_KEY: z.string().min(1),
});

export interface SupabaseAuthOptions {
  /** Inject the auth client (tests). Defaults to one built from SUPABASE_URL / SUPABASE_ANON_KEY. */
  auth?: Pick<SupabaseClient["auth"], "getClaims">;
}

/**
 * Verifies Supabase access tokens.
 * `getClaims` verifies locally against the project's JWKS when asymmetric JWT keys
 * are enabled, and falls back to calling Supabase Auth for legacy HS256 projects.
 */
export const createSupabaseAuthProvider = (
  options: SupabaseAuthOptions = {},
): AuthProvider => {
  const auth =
    options.auth ??
    (() => {
      const env = loadEnv(supabaseEnvSchema, process.env, "Supabase auth env");
      return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      }).auth;
    })();

  return {
    name: "supabase",
    getUser: async (request) => {
      const token = getBearerToken(request);
      if (!token) return null;

      const { data, error } = await auth.getClaims(token);
      if (error || !data) return null;

      const { claims } = data;
      // id/email come from verified claims. user_metadata is user-editable: display name only, never for authorization
      const name = claims.user_metadata?.["full_name"] ?? claims.user_metadata?.["name"];
      return {
        id: claims.sub,
        email: claims.email ?? null,
        name: typeof name === "string" ? name : null,
      };
    },
  };
};

export const createAuthProvider = (_context: {
  database: () => AppDatabase;
}): AuthProvider => createSupabaseAuthProvider();
