import type { DecodedIdToken } from "firebase-admin/auth";
import { describe, expect, it } from "vitest";
import { createFirebaseAuthProvider } from "../../src/auth/providers/firebase/index.ts";
import { bearer } from "../fakes/auth.ts";
import { buildTestApp } from "../helpers.ts";

const decoded = (overrides: Partial<DecodedIdToken> = {}): DecodedIdToken => ({
  uid: "firebase_uid_1",
  sub: "firebase_uid_1",
  aud: "project",
  iss: "https://securetoken.google.com/project",
  iat: 0,
  exp: 0,
  auth_time: 0,
  firebase: { identities: {}, sign_in_provider: "password" },
  email: "fire@example.com",
  name: "Fire Base",
  ...overrides,
});

const firebaseError = (code: string) => Object.assign(new Error(code), { code });

const buildWith = (verifyIdToken: (token: string) => Promise<DecodedIdToken>) =>
  buildTestApp({ auth: createFirebaseAuthProvider({ auth: { verifyIdToken } }) });

describe("Firebase auth provider", () => {
  it("maps a verified ID token to the user", async () => {
    const app = await buildWith(async (token) => {
      expect(token).toBe("id-token");
      return decoded();
    });

    const response = await app.inject({ method: "GET", url: "/api/me", headers: bearer("id-token") });

    expect(response.json()).toEqual({ id: "firebase_uid_1", email: "fire@example.com", name: "Fire Base" });
    await app.close();
  });

  it("returns 401 for invalid or expired tokens", async () => {
    const app = await buildWith(async () => {
      throw firebaseError("auth/id-token-expired");
    });

    const response = await app.inject({ method: "GET", url: "/api/me", headers: bearer("old") });

    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("returns 500 for infrastructure errors", async () => {
    const app = await buildWith(async () => {
      throw firebaseError("app/network-error");
    });

    const response = await app.inject({ method: "GET", url: "/api/me", headers: bearer("x") });

    expect(response.statusCode).toBe(500);
    await app.close();
  });
});
