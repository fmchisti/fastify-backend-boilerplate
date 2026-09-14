import { getBearerToken } from "../../src/auth/bearer.ts";
import type { AuthProvider, AuthUser } from "../../src/auth/types.ts";

export const ALICE: AuthUser = { id: "user_alice", email: "alice@example.com", name: "Alice" };
export const BOB: AuthUser = { id: "user_bob", email: "bob@example.com", name: "Bob" };

/** Bearer token → user map. Tokens: "alice-token", "bob-token". */
export const createFakeAuthProvider = (
  users: Record<string, AuthUser> = { "alice-token": ALICE, "bob-token": BOB },
): AuthProvider => ({
  name: "fake",
  getUser: async (request) => {
    const token = getBearerToken(request);
    return token ? (users[token] ?? null) : null;
  },
});

export const bearer = (token: string) => ({ authorization: `Bearer ${token}` });
