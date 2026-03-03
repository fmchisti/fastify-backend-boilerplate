import { FastifyReply } from "fastify";
import { AuthenticatedRequest } from "./auth";

/**
 * Require an authenticated user (any valid JWT).
 * Use after optionalAuth when you need to ensure the user is logged in.
 */
export const requireAuth = async (
  request: AuthenticatedRequest,
  reply: FastifyReply,
): Promise<void> => {
  if (reply.sent) return;
  if (!request.user) {
    reply.code(401).send({
      error: "Unauthorized",
      message: "Authentication required",
    });
  }
};
