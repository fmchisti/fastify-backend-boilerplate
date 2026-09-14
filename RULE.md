# Project Rules & Conventions

These rules apply when editing this codebase. AI agents and developers should follow them.

---

## General

- **Single source of truth:** Env in `src/config/env.ts`, DB schema in `src/db/schema.ts`, API docs via Zod schemas + Swagger. Keep them in sync when adding features.
- **No business logic in `src/index.ts` or `src/app.ts`.** They only wire config, plugins, and routes.
- **One feature per module** under `src/modules/<name>/`. Do not create cross-cutting top-level folders (e.g. `src/services/`, `src/utils/`) without explicit agreement; prefer module-local or shared types.

---

## TypeScript & Fastify

- Use **Zod** for all request/response validation and schema definitions. Attach schemas to routes so `fastify-type-provider-zod` validates and serializes.
- Throw `HttpError` (`src/lib/errors.ts`) for expected failures so the global error handler returns the right status and shape.
- Use `async` handlers that **return** the response value. Avoid ad-hoc `reply.status(...).send({ error: ... })`.
- Type handlers with `ZodRouteHandler<typeof Schema>` and route plugins with `FastifyPluginAsyncZod`.
- Strict TypeScript: no `any`, no non-null `!`, no `as` casts to bypass errors.
- Log with `request.log` inside requests (keeps request IDs). Pino signature is `log.info(obj, msg)`, object first.

---

## Modules

- **routes.ts:** `const routes: FastifyPluginAsyncZod = async (fastify) => { fastify.route({ method, url, schema, handler }) }`. Include OpenAPI `tags`, `summary`, `description` (from `docs.ts`).
- **handler.ts:** `ZodRouteHandler<typeof Schema>`. Thin layer: call service, return result. Do not put business logic or complex branching here.
- **service.ts:** Business logic and DB. Import `db` from `src/db` or `src/config/database`. No `request`/`reply`.
- **schema.ts:** Zod schemas; export both the Zod schema and any Fastify `response` schema used in routes.
- **docs.ts:** Export objects like `{ tags: ["Tag"], summary: "...", description: "..." }` and spread into route schema.

---

## Database

- All tables and enums live in **`src/db/schema.ts`**. Do not split schema across files unless the project explicitly adopts a different structure.
- Use **Drizzle** for queries (in services). Prefer type-safe query builders over raw SQL.
- After changing schema: run `pnpm db:generate` then `pnpm db:push` (or `pnpm db:migrate`) and document in PR or commit message.

---

## Auth

- Use **`authenticate`** for routes that require a logged-in user and read it with **`getAuthUser(request)`**. Use **`optionalAuth`** when anonymous is allowed (`request.user` is `AuthUser | null`). See [AUTH.md](./AUTH.md).
- **Never** use `user.metadata` (Supabase `user_metadata`) for identity or authorization – users can edit it.
- Do not store secrets or tokens in code; use `env` from `src/config/env.ts`.

---

## Tests

- Every new route needs a test in `test/` (happy path + main error cases). Use `useTestApp()` and `app().inject()`.
- Run `pnpm type-check && pnpm test` before committing.

---

## API and docs

- Prefix API routes with **`/api`** (already applied via `prefix: "/api"` when registering module routes).
- Keep **Swagger** in sync: new routes must have schema and docs so `/api/docs` stays accurate.
- Add new Swagger **tags** in `src/config/swagger.ts` when introducing a new tag name.

---

## Files to touch with care

- **`src/config/env.ts`** – Adding env vars here affects startup and validation; add to `.env.example` and document.
- **`src/config/swagger.ts`** – Changing title/description/servers affects all of OpenAPI.
- **`src/db/schema.ts`** – Schema changes require migrations or push; consider existing data.

---

When adding a new feature, copy the structure from **`src/modules/health/`** and follow the patterns above. Refer to [AGENT.md](./AGENT.md) for the full agent workflow and [AUTH.md](./AUTH.md) for auth details.
