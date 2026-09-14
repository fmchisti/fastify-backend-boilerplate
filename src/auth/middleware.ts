import type { FastifyRequest } from "fastify";
import { HttpError } from "../lib/errors.ts";
import type { AuthUser } from "./types.ts";

/**
 * Hook: requires an authenticated user, otherwise responds 401.
 * Register as `onRequest` so unauthenticated requests are rejected before body
 * parsing and validation. In the handler, read the user with `getAuthUser(request)`.
 */
export const authenticate = async (request: FastifyRequest): Promise<void> => {
  const user = await request.server.auth.getUser(request);
  if (!user) {
    throw new HttpError(401, "Authentication required");
  }
  request.user = user;
};

/**
 * Hook (`onRequest`): sets `request.user` when valid credentials are sent, otherwise leaves it `null`.
 * Never fails the request, even if the provider is unreachable.
 */
export const optionalAuth = async (request: FastifyRequest): Promise<void> => {
  try {
    request.user = await request.server.auth.getUser(request);
  } catch (err) {
    request.log.error({ err }, "Optional authentication failed");
  }
};

/** Returns the authenticated user or throws 401. Gives handlers a non-null, typed user. */
export const getAuthUser = (request: FastifyRequest): AuthUser => {
  if (!request.user) {
    throw new HttpError(401, "Authentication required");
  }
  return request.user;
};

/** Hook: responds 401 when no user is set. Use after `optionalAuth`. */
export const requireAuth = async (request: FastifyRequest): Promise<void> => {
  getAuthUser(request);
};
