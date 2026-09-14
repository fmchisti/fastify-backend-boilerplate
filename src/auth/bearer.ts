import type { FastifyRequest } from "fastify";

const BEARER_PREFIX = "Bearer ";

/** Returns the token from `Authorization: Bearer <token>`, or `null`. */
export const getBearerToken = (request: FastifyRequest): string | null => {
  const header = request.headers.authorization;
  if (!header?.startsWith(BEARER_PREFIX)) return null;
  const token = header.slice(BEARER_PREFIX.length).trim();
  return token.length > 0 ? token : null;
};
