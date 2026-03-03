import { FastifyReply, FastifyRequest } from "fastify";
import { logger } from "../config/logger";
import { supabaseAdmin } from "../config/supabase";

export interface AuthenticatedRequest extends FastifyRequest {
  user?: {
    id: string;
    email?: string;
    [key: string]: unknown;
  };
}

/**
 * Authentication middleware – verifies JWT with Supabase and attaches user to request.
 * Use on routes that require a logged-in user.
 */
export const authenticate = async (
  request: AuthenticatedRequest,
  reply: FastifyReply,
): Promise<void> => {
  try {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      reply.code(401).send({
        error: "Unauthorized",
        message: "Missing or invalid authorization header",
      });
      return;
    }

    const token = authHeader.substring(7);
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      logger.warn("Invalid token", { error: error?.message });
      reply.code(401).send({
        error: "Unauthorized",
        message: "Invalid or expired token",
      });
      return;
    }

    request.user = {
      id: user.id,
      email: user.email,
      ...user.user_metadata,
    };
  } catch (error) {
    logger.error(error, "Authentication error");
    reply.code(500).send({
      error: "Internal server error",
      message: "Failed to authenticate request",
    });
  }
};

/**
 * Optional auth – does not fail when no token is provided.
 * When a valid token is present, attaches user to request.
 */
export const optionalAuth = async (
  request: AuthenticatedRequest,
  reply: FastifyReply,
): Promise<void> => {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) return;

    const token = authHeader.substring(7);
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);

    if (!error && user) {
      request.user = {
        id: user.id,
        email: user.email,
        ...user.user_metadata,
      };
    }
  } catch (error) {
    logger.error(error, "Optional authentication error");
  }
};
