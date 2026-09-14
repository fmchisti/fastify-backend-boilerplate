import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import type { AppDatabase } from "../db/index.ts"; // @setup-if orm!=none

/** Provider-independent user identity attached to `request.user`. */
export interface AuthUser {
  /** Stable user id from the auth provider (Better Auth id, Supabase/Logto `sub`, Firebase `uid`). */
  id: string;
  email: string | null;
  name: string | null;
}

/**
 * Contract every auth adapter implements (Better Auth, Supabase, Firebase, Logto, ...).
 * Routes and middleware depend only on this interface.
 */
export interface AuthProvider {
  readonly name: string;
  /**
   * Resolve the user from the request (bearer token, session cookie, ...).
   * Return `null` when credentials are missing, invalid, or expired.
   * Throw only for infrastructure failures (provider unreachable), which become 500s.
   */
  getUser(request: FastifyRequest): Promise<AuthUser | null>;
  /** Routes the provider serves itself, registered under `/api/auth` (e.g. Better Auth sign-in). */
  readonly routes?: FastifyPluginAsync;
  close?(): Promise<void>;
}

/** Passed to every provider's `createAuthProvider`. Providers use only what they need. */
export interface AuthProviderContext {
  // @setup-if orm!=none
  /** Lazily creates the database connection (only self-hosted auth needs it). */
  database: () => AppDatabase;
  // @setup-endif
  /** Browser origins allowed to call the API (CORS_ORIGINS plus localhost in development). */
  trustedOrigins: string[];
}
