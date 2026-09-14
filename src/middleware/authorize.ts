import type { FastifyRequest } from "fastify";
import { HttpError } from "../lib/errors";
import type { AuthUser } from "./auth";

/**
 * Returns the authenticated user or throws 401.
 * Use in handlers to get a non-null, fully typed user.
 */
export const getAuthUser = (request: FastifyRequest): AuthUser => {
  if (!request.user) {
    throw new HttpError(401, "Authentication required");
  }
  return request.user;
};

/**
 * preHandler: responds 401 when no user is set.
 * Use after `optionalAuth` when a specific route must be authenticated.
 */
export const requireAuth = async (request: FastifyRequest): Promise<void> => {
  getAuthUser(request);
};
