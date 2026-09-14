import {
  createRemoteJWKSet,
  errors as joseErrors,
  type JWTVerifyGetKey,
  jwtVerify,
} from "jose";
import { z } from "zod";
import { loadEnv } from "../../../config/env.ts";
import { getBearerToken } from "../../bearer.ts";
import type { AuthProvider, AuthProviderContext } from "../../types.ts";

const logtoEnvSchema = z.object({
  // e.g. https://your-tenant.logto.app (no trailing slash)
  LOGTO_ENDPOINT: z.url().transform((url) => url.replace(/\/+$/, "")),
  // API resource indicator registered in Logto, e.g. https://api.example.com
  LOGTO_API_RESOURCE: z.string().min(1),
});

export interface LogtoAuthOptions {
  endpoint: string;
  audience: string;
  /** Inject a key set (tests). Defaults to the tenant's remote JWKS. */
  jwks?: JWTVerifyGetKey;
}

/**
 * Verifies Logto access tokens issued for an API resource.
 * Works the same for any OIDC provider that issues JWT access tokens
 * (Auth0, Keycloak, Clerk, Cognito) – only the issuer and JWKS URL differ.
 */
export const createLogtoAuthProvider = (options: LogtoAuthOptions): AuthProvider => {
  const issuer = `${options.endpoint}/oidc`;
  const jwks = options.jwks ?? createRemoteJWKSet(new URL(`${issuer}/jwks`));

  return {
    name: "logto",
    getUser: async (request) => {
      const token = getBearerToken(request);
      if (!token) return null;

      try {
        const { payload } = await jwtVerify(token, jwks, {
          issuer,
          audience: options.audience,
        });
        if (!payload.sub) return null;

        // Access tokens only carry `sub` unless you add custom claims in Logto
        const { email, name } = payload;
        return {
          id: payload.sub,
          email: typeof email === "string" ? email : null,
          name: typeof name === "string" ? name : null,
        };
      } catch (error) {
        // Bad signature/claims/expiry are auth failures; JWKS fetch errors are infrastructure
        if (error instanceof joseErrors.JOSEError && !(error instanceof joseErrors.JWKSTimeout)) {
          return null;
        }
        throw error;
      }
    },
  };
};

export const createAuthProvider = (_context: AuthProviderContext): AuthProvider => {
  const env = loadEnv(logtoEnvSchema, process.env, "Logto auth env");
  return createLogtoAuthProvider({
    endpoint: env.LOGTO_ENDPOINT,
    audience: env.LOGTO_API_RESOURCE,
  });
};
