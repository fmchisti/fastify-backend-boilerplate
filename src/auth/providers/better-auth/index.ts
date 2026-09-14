import { betterAuth } from "better-auth";
import { fromNodeHeaders } from "better-auth/node";
import { bearer } from "better-auth/plugins";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { env as coreEnv, loadEnv } from "../../../config/env.ts";
import type { AppDatabase } from "../../../db/index.ts";
import type { AuthProvider } from "../../types.ts";
// @setup-select orm
import { createAuthDatabase } from "./database/drizzle.ts";

const betterAuthEnvSchema = z.object({
  // Public URL where this API is reachable, e.g. http://localhost:3000
  BETTER_AUTH_URL: z.url(),
  // At least 32 random characters: `openssl rand -base64 32`
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
});

export const BETTER_AUTH_BASE_PATH = "/api/auth";

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
    // Allows `Authorization: Bearer <session token>` for mobile/API clients, in addition to cookies.
    // The token is returned in the `set-auth-token` response header on sign-in.
    plugins: [bearer()],
    // Add social providers here, e.g. socialProviders: { google: { clientId, clientSecret } }
  });

export type BetterAuthInstance = ReturnType<typeof buildAuth>;

/** Forward a Fastify request to Better Auth's fetch-style handler. */
const createRoutes = (auth: BetterAuthInstance): FastifyPluginAsync =>
  async (fastify) => {
    fastify.route({
      method: ["GET", "POST"],
      url: "/*",
      schema: { hide: true },
      handler: async (request: FastifyRequest, reply: FastifyReply) => {
        const url = new URL(request.url, `${request.protocol}://${request.host}`);
        const body =
          request.body === undefined || request.method === "GET"
            ? undefined
            : JSON.stringify(request.body);

        const response = await auth.handler(
          new Request(url, {
            method: request.method,
            headers: fromNodeHeaders(request.headers),
            ...(body !== undefined && { body }),
          }),
        );

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

export const createAuthProvider = (context: {
  database: () => AppDatabase;
}): AuthProvider => {
  const env = loadEnv(betterAuthEnvSchema, process.env, "Better Auth env");
  return createBetterAuthProvider({
    database: createAuthDatabase(context.database()),
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: coreEnv.FRONTEND_URL ? [coreEnv.FRONTEND_URL] : [],
  });
};
