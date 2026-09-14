import type { FastifyPluginAsync, FastifyRequest } from "fastify";

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
