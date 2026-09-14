// The auth provider is chosen by `pnpm setup:project`.
export { authenticate, getAuthUser, optionalAuth, requireAuth } from "./middleware.ts";
export { createAuthProvider } from "./providers/better-auth/index.ts"; // @setup-select auth
export type { AuthProvider, AuthUser } from "./types.ts";
