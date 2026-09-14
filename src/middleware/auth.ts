import type { User } from "@supabase/supabase-js";
import type { FastifyRequest } from "fastify";
import { supabaseAdmin } from "../config/supabase";
import { HttpError } from "../lib/errors";

export interface AuthUser {
  id: string;
  email: string | null;
  /**
   * Supabase `user_metadata`. The user can edit this from the client, so
   * NEVER use it for identity or authorization decisions (roles, ownership).
   * Use `app_metadata` or your own DB tables for that.
   */
  metadata: Record<string, unknown>;
}

declare module "fastify" {
  interface FastifyRequest {
    /** Set by `authenticate` / `optionalAuth`. `null` for anonymous requests. */
    user: AuthUser | null;
  }
}

const BEARER_PREFIX = "Bearer ";

const extractBearerToken = (header: string | undefined): string | null => {
  if (!header?.startsWith(BEARER_PREFIX)) return null;
  const token = header.slice(BEARER_PREFIX.length).trim();
  return token.length > 0 ? token : null;
};

// Build from trusted fields only – metadata is nested, so it can never override `id` or `email`
const toAuthUser = (user: User): AuthUser => ({
  id: user.id,
  email: user.email ?? null,
  metadata: user.user_metadata,
});

const verifyToken = async (token: string): Promise<AuthUser | null> => {
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  return toAuthUser(data.user);
};

/**
 * preHandler: requires a valid JWT. Sets `request.user` or responds 401.
 * In the handler, read the user with `getAuthUser(request)`.
 */
export const authenticate = async (request: FastifyRequest): Promise<void> => {
  const token = extractBearerToken(request.headers.authorization);
  if (!token) {
    throw new HttpError(401, "Missing or invalid authorization header");
  }

  const user = await verifyToken(token);
  if (!user) {
    request.log.warn("Invalid or expired token");
    throw new HttpError(401, "Invalid or expired token");
  }

  request.user = user;
};

/**
 * preHandler: sets `request.user` when a valid JWT is sent, otherwise leaves it `null`.
 * Never fails the request.
 */
export const optionalAuth = async (request: FastifyRequest): Promise<void> => {
  const token = extractBearerToken(request.headers.authorization);
  if (!token) return;

  try {
    request.user = await verifyToken(token);
  } catch (err) {
    request.log.error({ err }, "Optional authentication error");
  }
};
