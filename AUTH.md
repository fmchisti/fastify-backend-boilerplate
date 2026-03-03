# Authentication & Authorization

How auth works in this boilerplate and how to protect routes or extend it (e.g. with roles).

---

## Overview

- **Provider:** Supabase. JWTs are issued by Supabase Auth; the backend only verifies them.
- **Flow:** Client sends `Authorization: Bearer <access_token>`. Backend uses Supabase Admin client to validate the token and optionally attach user to the request.
- **No session store:** This app does not store sessions server-side. Session lifetime is controlled by Supabase (JWT expiry, refresh tokens). Env `SESSION_DURATION_DAYS` is for documentation only; configure expiry in the Supabase Dashboard.

---

## Config

- **`src/config/supabase.ts`**
  - **`supabaseClient`** – anon key; use for client-side or public Supabase calls.
  - **`supabaseAdmin`** – service role key; used in middleware to call `getUser(token)` and validate JWTs. Never expose this key to the client.

- **Env (see `.env.example`):**
  - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY` – required for auth.
  - `SESSION_DURATION_DAYS` – optional; document intended session length (actual expiry is set in Supabase).

---

## Middleware

### `src/middleware/auth.ts`

- **`authenticate`**  
  - Reads `Authorization: Bearer <token>`.  
  - Calls `supabaseAdmin.auth.getUser(token)`.  
  - On success: sets `request.user` with `{ id, email, ...user_metadata }` and continues.  
  - On missing/invalid token: sends 401 and does not call the route handler.

- **`optionalAuth`**  
  - Same lookup, but if there is no token or it’s invalid, does **not** send 401; it just leaves `request.user` unset.  
  - Use when a route serves both anonymous and authenticated users.

- **`AuthenticatedRequest`**  
  - Type that extends Fastify’s request with `user?: { id: string; email?: string; [key: string]: unknown }`.  
  - Use this type for handlers that run after `authenticate` or `optionalAuth` when you expect `user` to possibly be set.

### `src/middleware/authorize.ts`

- **`requireAuth`**  
  - Assumes `optionalAuth` (or similar) has run.  
  - If `request.user` is not set, sends 401 and stops.  
  - Use when the route must have a logged-in user but you still want to use `optionalAuth` for flexibility (e.g. logging).

---

## Protecting routes

### Route requires a logged-in user

Use **`authenticate`** as a preHandler so only valid JWTs reach the handler:

```ts
import { authenticate } from "../../middleware/auth";
import type { AuthenticatedRequest } from "../../middleware/auth";

fastify.withTypeProvider<ZodTypeProvider>().route({
  method: "GET",
  url: "/me",
  preHandler: [authenticate],
  schema: { /* ... */ },
  handler: async (request: AuthenticatedRequest, reply) => {
    // request.user is set
    return reply.send({ user: request.user });
  },
});
```

### Route works for both guest and logged-in users

Use **`optionalAuth`** so `request.user` is set when a valid token is sent, then in the handler use **`requireAuth`** only when the action requires a user:

```ts
import { optionalAuth } from "../../middleware/auth";
import { requireAuth } from "../../middleware/authorize";
import type { AuthenticatedRequest } from "../../middleware/auth";

fastify.withTypeProvider<ZodTypeProvider>().route({
  method: "POST",
  url: "/favorite",
  preHandler: [optionalAuth],
  schema: { /* ... */ },
  handler: async (request: AuthenticatedRequest, reply) => {
    await requireAuth(request, reply);
    if (reply.sent) return; // 401 already sent
    // request.user is set here
    // ...
  },
});
```

Alternatively, use **`authenticate`** on routes that always require auth and **`optionalAuth`** only where you truly need both behaviors.

---

## Response shape on auth errors

The global error handler in `src/index.ts` sends a consistent JSON body. Middleware sends 401 with:

- `error: "Unauthorized"`
- `message`: short reason (e.g. "Missing or invalid authorization header", "Invalid or expired token", "Authentication required")

Clients should rely on HTTP status and these fields; do not add new ad-hoc auth response shapes without updating this doc and the global handler if needed.

---

## Extending with roles or permissions

This boilerplate does **not** include roles or permissions. To add them:

1. **Store roles** – e.g. a `user_roles` table or a `role` column on a `users` table, populated by your app or by Supabase hooks.
2. **Load roles in auth** – After validating the JWT in `authenticate` (and optionally in `optionalAuth`), fetch the user’s roles from the DB and attach them to `request.user` (e.g. `request.user.roles`).
3. **Authorization helpers** – In `src/middleware/authorize.ts` (or a new file), add helpers like `requireRole('admin')` or `requireAnyRole(['admin', 'editor'])` that check `request.user.roles` and send 403 if the user does not have the required role.
4. **Typing** – Extend `AuthenticatedRequest` so `user` includes `roles` (e.g. `roles: string[]`).

Keep JWT validation in one place (middleware) and role/permission checks in authorize helpers or inside handlers when logic is complex.

---

## Summary

| Need | Middleware / helper |
|------|----------------------|
| Only logged-in users | `preHandler: [authenticate]`, type handler with `AuthenticatedRequest` |
| Optional user, then require in handler | `preHandler: [optionalAuth]`, then `requireAuth(request, reply)` in handler |
| Roles/permissions | Add your own tables and helpers; load roles after auth and check in authorize middleware or in handler |

See **`src/middleware/auth.ts`** and **`src/middleware/authorize.ts`** for the current implementation.
