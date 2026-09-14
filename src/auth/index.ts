// The auth provider is chosen by `pnpm setup:project`.
// @setup-select auth
export { createAuthProvider } from "./providers/better-auth/index.ts";
export { authenticate, getAuthUser, optionalAuth, requireAuth } from "./middleware.ts";
export type { AuthProvider, AuthUser } from "./types.ts";
