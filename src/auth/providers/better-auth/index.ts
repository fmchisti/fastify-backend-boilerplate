import { betterAuth } from "better-auth";
import { fromNodeHeaders } from "better-auth/node";
import { bearer } from "better-auth/plugins";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { loadEnv } from "../../../config/env.ts";
import type { AuthProvider, AuthProviderContext } from "../../types.ts";
import { createAuthDatabase } from "./database/drizzle.ts"; // @setup-select orm

const betterAuthEnvSchema = z.object({
  // Public URL where this API is reachable, e.g. http://localhost:3000
  BETTER_AUTH_URL: z.url(),
  // At least 32 random characters: `openssl rand -base64 32`
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
});

export const BETTER_AUTH_BASE_PATH = "/api/auth";

/**
 * Header carrying the client IP that Fastify resolved (respecting TRUST_PROXY).
 * Better Auth reads it for rate limiting and session metadata. Any incoming value
 * is overwritten, so clients cannot spoof it.
 */
export const CLIENT_IP_HEADER = "x-fastify-client-ip";

export interface BetterAuthProviderOptions {
  /** Better Auth database adapter (Drizzle, Prisma, or memory in tests). */
  database: Parameters<typeof betterAuth>[0]["database"];
  baseURL: string;
  secret: string;
  trustedOrigins?: string[];
}

const buildAuth = (options: BetterAuthProviderOptions) =>
  betterAuth({
    database: options.database,
    baseURL: options.baseURL,
    basePath: BETTER_AUTH_BASE_PATH,
    secret: options.secret,
    trustedOrigins: options.trustedOrigins ?? [],
    emailAndPassword: { enabled: true },
    advanced: { ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER] } },
    // Allows `Authorization: Bearer <session token>` for mobile/API clients, in addition to cookies.
    // The token is returned in the `set-auth-token` response header on sign-in.
    plugins: [bearer()],
    // Add social providers here, e.g. socialProviders: { google: { clientId, clientSecret } }
  });

export type BetterAuthInstance = ReturnType<typeof buildAuth>;

/** Convert a Fastify request into the fetch `Request` Better Auth expects. */
export const toWebRequest = (request: FastifyRequest): Request => {
  const url = new URL(request.url, `${request.protocol}://${request.host}`);
  const body =
    request.body === undefined || request.method === "GET" ? undefined : JSON.stringify(request.body);

  const headers = fromNodeHeaders(request.headers);
  // Overwrites any client-sent value with the IP Fastify resolved
  headers.set(CLIENT_IP_HEADER, request.ip);

  return new Request(url, {
    method: request.method,
    headers,
    ...(body !== undefined && { body }),
  });
};

/** Forward requests under /api/auth to Better Auth's fetch-style handler. */
const createRoutes =
  (auth: BetterAuthInstance): FastifyPluginAsync =>
  async (fastify) => {
    fastify.route({
      method: ["GET", "POST"],
      url: "/*",
      schema: { hide: true },
      handler: async (request: FastifyRequest, reply: FastifyReply) => {
        const response = await auth.handler(toWebRequest(request));

        reply.status(response.status);
        response.headers.forEach((value, key) => {
          // Multiple cookies must be sent as separate headers
          if (key !== "set-cookie") reply.header(key, value);
        });
        const cookies = response.headers.getSetCookie();
        if (cookies.length > 0) reply.header("set-cookie", cookies);

        return reply.send(response.body ? await response.text() : null);
      },
    });
  };

/** Self-hosted auth: users, sessions and accounts live in your own Postgres. */
export const createBetterAuthProvider = (
  options: BetterAuthProviderOptions,
): AuthProvider & { auth: BetterAuthInstance } => {
  const auth = buildAuth(options);

  return {
    name: "better-auth",
    auth,
    routes: createRoutes(auth),
    getUser: async (request) => {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(request.headers),
      });
      if (!session) return null;
      return {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name || null,
      };
    },
  };
};

export const createAuthProvider = (context: AuthProviderContext): AuthProvider => {
  const env = loadEnv(betterAuthEnvSchema, process.env, "Better Auth env");
  return createBetterAuthProvider({
    database: createAuthDatabase(context.database()),
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: context.trustedOrigins,
  });
};
