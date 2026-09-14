# Agent Guide – Fastify Backend Boilerplate

This document tells **AI agents** how to work with this codebase: stack, structure, conventions, and where to add or change code.

---

## 1. Project overview

- **Purpose:** TypeScript backend API boilerplate. Start here and add features as modules.
- **Stack:** Fastify, TypeScript, Drizzle ORM (PostgreSQL), Zod (validation + OpenAPI), Supabase (JWT auth), Pino (logging).
- **Entry:** `src/index.ts` – builds the app and listens. `src/app.ts` – `buildApp()` registers plugins, error handlers, and routes without listening (tests use it via `app.inject()`). Keep both to wiring only; no business logic.

---

## 2. Directory structure

| Path | Role |
|------|------|
| `src/config/` | Env, DB, logger, Supabase, Swagger. Change only when adding new config concerns. |
| `src/lib/` | Framework-level helpers: `errors.ts` (`HttpError`, `ErrorResponseSchema`, global error/404 handlers), `basic-auth.ts`. Not for feature logic. |
| `src/db/` | Drizzle schema and re-exports. Add tables in `schema.ts`; run `pnpm db:generate` then `pnpm db:push` or `pnpm db:migrate`. |
| `src/middleware/` | Auth and authorization. See [AUTH.md](./AUTH.md). |
| `src/modules/` | **Feature modules.** One folder per feature (e.g. `health`, `users`, `posts`). Add new features here. |
| `src/types/` | Shared TypeScript types, including `ZodRouteHandler`. |
| `test/` | Vitest tests (`*.test.ts`) and compile-time type tests (`*.test-d.ts`). |

Do **not** add other top-level folders under `src/` (e.g. no `src/services/` or `src/utils/` unless the team agrees). Prefer putting logic inside the module that uses it.

---

## 3. Module pattern

Each feature lives under `src/modules/<feature>/` with this layout:

- **`routes.ts`** – Default export typed `FastifyPluginAsyncZod`; calls `fastify.route(...)`. Merge Zod schema + `docs` for Swagger.
- **`handler.ts`** – Route handlers typed `ZodRouteHandler<typeof MySchema>` so `request.body/params/querystring` and the return value are inferred from the schema. Thin: call service, **return** the result (don't `reply.send()`), throw `HttpError` for expected failures. Use `request.log`, not the global `logger`. For protected routes see [AUTH.md](./AUTH.md).
- **`service.ts`** – Business logic and DB access. Use `db` from `src/config/database` / `src/db`. No request/reply here.
- **`schema.ts`** – Zod schemas and Fastify response schemas (e.g. `response: { 200: MyZodSchema }`). Reuse for validation and OpenAPI.
- **`docs.ts`** – OpenAPI bits: `tags`, `summary`, `description`. Spread into route schema so Swagger stays in sync.

**Adding a new module:**

1. Create `src/modules/<name>/` with `routes.ts`, `handler.ts`, `service.ts`, `schema.ts`, `docs.ts` as needed.
2. In `src/app.ts`: `import <name>Routes from "./modules/<name>/routes"` and `await app.register(<name>Routes, { prefix: "/api" })`.
3. If the module has Swagger tags, add them in `src/config/swagger.ts` under `tags`.
4. Add `test/<name>.test.ts` using `useTestApp()` from `test/helpers.ts`.

Use **health** (`src/modules/health/`) as the reference for a public route and **auth** (`src/modules/auth/`) for a protected route.

---

## 4. Conventions (see RULE.md)

- **Errors:** Throw `new HttpError(status, message)` from `src/lib/errors.ts`. The global handler formats every error as `{ error, message, details? }`, adds field `details` for validation failures, and hides messages on 5xx. Don't catch-and-send errors in handlers.
- **Validation:** Use Zod schemas on routes; avoid ad-hoc checks in handlers.
- **Auth:** `preHandler: [authenticate]` + `getAuthUser(request)` for protected routes; `optionalAuth` when anonymous is allowed. `request.user` is typed globally. Never trust `user.metadata` for authorization. See [AUTH.md](./AUTH.md).
- **Types:** `tsconfig.json` is strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, etc.). No `any`, no `as` casts to silence errors; fix the types.
- **DB:** All schema in `src/db/schema.ts`. Use Drizzle queries in services, not raw SQL, unless necessary.
- **Env:** All env vars are validated in `src/config/env.ts`. Add new vars there and in `.env.example`.

---

## 5. Commands

| Command | Use |
|--------|-----|
| `pnpm dev` | Run with hot reload. |
| `pnpm build` | Compile to `dist/`. |
| `pnpm start` | Run production build. |
| `pnpm type-check` | TypeScript check (src + tests). |
| `pnpm test` | Run Vitest once (unit, integration, and type tests). |
| `pnpm test:watch` | Vitest in watch mode. |
| `pnpm db:generate` | Generate Drizzle migrations from `src/db/schema.ts`. |
| `pnpm db:push` | Push schema to DB (dev). |
| `pnpm db:migrate` | Run migrations. |
| `pnpm db:studio` | Open Drizzle Studio. |

Before suggesting DB changes, remind the user to run migrations or push after schema edits.

---

## 6. Testing and quality

- **Runner:** Vitest. Tests live in `test/`. `test/setup.ts` sets a fake env (no real DB or Supabase needed).
- **HTTP tests:** `const app = useTestApp();` then `await app().inject({ method, url, headers, payload })`.
- **Mock Supabase:** `vi.spyOn(supabaseAdmin.auth, "getUser").mockResolvedValue(...)` with `fakeSupabaseUser()` from `test/helpers.ts`.
- **Type tests:** `test/*.test-d.ts` with `expectTypeOf` / `@ts-expect-error`.
- Before finishing any change run `pnpm type-check && pnpm test`.
- When adding routes, keep Swagger in sync (schema + docs) so `/api/docs` stays accurate.

---

## 7. References

- **Project rules:** [RULE.md](./RULE.md)
- **Auth and authorization:** [AUTH.md](./AUTH.md)
- **Setup and deployment:** [BACKEND_SETUP_GUIDE.md](./BACKEND_SETUP_GUIDE.md)
- **Quick start:** [README.md](./README.md)

When in doubt, follow existing patterns in `src/modules/health/` and the conventions in RULE.md and AUTH.md.
