# Authentication & Authorization

How auth works in this boilerplate and how to protect routes or extend it (e.g. with roles).

---

## Overview

- **Provider:** Supabase. JWTs are issued by Supabase Auth; the backend only verifies them.
- **Flow:** Client sends `Authorization: Bearer <access_token>`. Backend uses the Supabase Admin client to validate the token and attaches the user to `request.user`.
- **No session store:** This app does not store sessions server-side. Session lifetime is controlled by Supabase (JWT expiry, refresh tokens). Env `SESSION_DURATION_DAYS` is for documentation only; configure expiry in the Supabase Dashboard.

---

## Config

- **`src/config/supabase.ts`**
  - **`supabaseClient`** – anon key; use for public Supabase calls.
  - **`supabaseAdmin`** – service role key; used in middleware to call `getUser(token)` and validate JWTs. Never expose this key to the client.

- **Env (see `.env.example`):**
  - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY` – required for auth.
  - `SESSION_DURATION_DAYS` – optional; document intended session length (actual expiry is set in Supabase).

---

## The `request.user` type

`src/middleware/auth.ts` augments Fastify's request type, so every handler sees:

```ts
request.user: AuthUser | null

interface AuthUser {
  id: string;
  email: string | null;
  metadata: Record<string, unknown>; // Supabase user_metadata
}
```

`request.user` is `null` until `authenticate` or `optionalAuth` sets it. No casts or custom request types are needed.

> **Security:** `metadata` is Supabase `user_metadata`, which **users can edit themselves** from the client (`supabase.auth.updateUser({ data })`). Never use it for identity, roles, ownership, or any authorization decision. Use `id`, Supabase `app_metadata`, or your own DB tables instead.

---

## Middleware

### `src/middleware/auth.ts`

- **`authenticate`** (preHandler)
  - Reads `Authorization: Bearer <token>` and calls `supabaseAdmin.auth.getUser(token)`.
  - On success: sets `request.user`.
  - On missing/invalid token: throws `HttpError(401)`; the handler never runs.
  - If Supabase is unreachable, the error goes to the global handler (500, details hidden).

- **`optionalAuth`** (preHandler)
  - Same lookup, but never fails the request. Invalid/missing token or a Supabase error leaves `request.user` as `null`.

### `src/middleware/authorize.ts`

- **`getAuthUser(request)`** – returns `AuthUser` (non-null) or throws 401. Use in handlers to get a typed user.
- **`requireAuth`** (preHandler) – responds 401 when `request.user` is `null`. Use after `optionalAuth`.

---

## Protecting routes

### Route requires a logged-in user

```ts
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { authenticate } from "../../middleware/auth";
import { getAuthUser } from "../../middleware/authorize";

const routes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.route({
    method: "GET",
    url: "/me",
    preHandler: [authenticate],
    schema: MeSchema,
    handler: async (request) => {
      const user = getAuthUser(request); // AuthUser, never null
      return { id: user.id, email: user.email };
    },
  });
};
```

See `src/modules/auth/` for the full module version (`GET /api/auth/me`).

### Route works for both guest and logged-in users

```ts
fastify.route({
  method: "GET",
  url: "/posts",
  preHandler: [optionalAuth],
  schema: ListPostsSchema,
  handler: async (request) => {
    // request.user is AuthUser | null
    return postService.list({ viewerId: request.user?.id ?? null });
  },
});
```

To require a user on such a route, add `requireAuth` after `optionalAuth`, or call `getAuthUser(request)` only in the branch that needs it.

---

## Response shape on auth errors

Middleware throws `HttpError`; the global error handler (`src/lib/errors.ts`) sends:

```json
{ "error": "Unauthorized", "message": "Invalid or expired token" }
```

Messages: `"Missing or invalid authorization header"`, `"Invalid or expired token"`, `"Authentication required"`. Use `ErrorResponseSchema` in route `response` schemas (e.g. `401: ErrorResponseSchema`) so Swagger documents it.

---

## Extending with roles or permissions

This boilerplate does **not** include roles or permissions. To add them:

1. **Store roles** – a `user_roles` table, a `role` column on `users`, or Supabase `app_metadata` (not user-editable). **Never** `user_metadata`.
2. **Load roles in auth** – after validating the JWT in `authenticate`, fetch roles and add them to `AuthUser` (e.g. `roles: string[]`).
3. **Authorization helpers** – in `src/middleware/authorize.ts`, add e.g. `requireRole("admin")` that throws `new HttpError(403, "Forbidden")`.

Keep JWT validation in one place (middleware) and role/permission checks in authorize helpers.

---

## Summary

| Need | Middleware / helper |
|------|----------------------|
| Only logged-in users | `preHandler: [authenticate]`, then `getAuthUser(request)` |
| Optional user | `preHandler: [optionalAuth]`, read `request.user` (nullable) |
| Optional auth, but this route requires it | `preHandler: [optionalAuth, requireAuth]` |
| Roles/permissions | Add tables + helpers that throw `HttpError(403)` |

Tests covering all of the above: `test/auth.test.ts`, `test/middleware.test.ts`.
