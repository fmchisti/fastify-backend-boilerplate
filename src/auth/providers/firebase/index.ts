import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { type Auth, getAuth } from "firebase-admin/auth";
import { z } from "zod";
import { loadEnv } from "../../../config/env.ts";
import type { AppDatabase } from "../../../db/index.ts";
import { getBearerToken } from "../../bearer.ts";
import type { AuthProvider } from "../../types.ts";

const firebaseEnvSchema = z.object({
  FIREBASE_PROJECT_ID: z.string().min(1),
  // Service account credentials are optional for token verification,
  // but required if you call other Admin APIs (e.g. managing users).
  FIREBASE_CLIENT_EMAIL: z.email().optional(),
  FIREBASE_PRIVATE_KEY: z.string().min(1).optional(),
});

const FIREBASE_APP_NAME = "fastify-auth";

const createFirebaseApp = (): App => {
  const existing = getApps().find((app) => app.name === FIREBASE_APP_NAME);
  if (existing) return existing;

  const env = loadEnv(firebaseEnvSchema, process.env, "Firebase auth env");
  const { FIREBASE_CLIENT_EMAIL: clientEmail, FIREBASE_PRIVATE_KEY: privateKey } = env;
  return initializeApp(
    {
      projectId: env.FIREBASE_PROJECT_ID,
      ...(clientEmail &&
        privateKey && {
          credential: cert({
            projectId: env.FIREBASE_PROJECT_ID,
            clientEmail,
            // Env files usually store the key with escaped newlines
            privateKey: privateKey.replace(/\\n/g, "\n"),
          }),
        }),
    },
    FIREBASE_APP_NAME,
  );
};

export interface FirebaseAuthOptions {
  /** Inject an Auth instance (tests). Only `verifyIdToken` is used. */
  auth?: Pick<Auth, "verifyIdToken">;
}

const isFirebaseTokenError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  typeof error.code === "string" &&
  error.code.startsWith("auth/");

/** Verifies Firebase ID tokens sent as `Authorization: Bearer <idToken>`. */
export const createFirebaseAuthProvider = (
  options: FirebaseAuthOptions = {},
): AuthProvider => {
  const auth = options.auth ?? getAuth(createFirebaseApp());

  return {
    name: "firebase",
    getUser: async (request) => {
      const token = getBearerToken(request);
      if (!token) return null;

      try {
        const decoded = await auth.verifyIdToken(token);
        const name: unknown = decoded["name"];
        return {
          id: decoded.uid,
          email: decoded.email ?? null,
          name: typeof name === "string" ? name : null,
        };
      } catch (error) {
        // Invalid/expired/revoked tokens are auth failures; anything else is infrastructure
        if (isFirebaseTokenError(error)) return null;
        throw error;
      }
    },
  };
};

export const createAuthProvider = (_context: {
  database: () => AppDatabase;
}): AuthProvider => createFirebaseAuthProvider();
