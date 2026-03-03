# Agent Guide – Fastify Backend Boilerplate

This document tells **AI agents** how to work with this codebase: stack, structure, conventions, and where to add or change code.

---

## 1. Project overview

- **Purpose:** TypeScript backend API boilerplate. Start here and add features as modules.
- **Stack:** Fastify, TypeScript, Drizzle ORM (PostgreSQL), Zod (validation + OpenAPI), Supabase (JWT auth), Pino (logging).
- **Entry:** `src/index.ts` – loads config, registers plugins and routes, listens. Do not put business logic in `index.ts`; keep it to wiring only.

---

## 2. Directory structure

| Path | Role |
|------|------|
| `src/config/` | Env, DB, logger, Supabase, Swagger. Change only when adding new config concerns. |
| `src/db/` | Drizzle schema and re-exports. Add tables in `schema.ts`; run `pnpm db:generate` then `pnpm db:push` or `pnpm db:migrate`. |
| `src/middleware/` | Auth and authorization. See [AUTH.md](./AUTH.md). |
| `src/modules/` | **Feature modules.** One folder per feature (e.g. `health`, `users`, `posts`). Add new features here. |
| `src/types/` | Shared TypeScript types. Re-export from here when multiple modules need a type. |

Do **not** add top-level folders under `src/` (e.g. no `src/services/` or `src/utils/` unless the team agrees). Prefer putting logic inside the module that uses it or in shared code under `src/types/` or a dedicated module.

---

## 3. Module pattern

Each feature lives under `src/modules/<feature>/` with this layout:

- **`routes.ts`** – Registers Fastify routes; uses `fastify.withTypeProvider<ZodTypeProvider>().route(...)`. Merge Zod schema + `docs` for Swagger. Export a default async plugin that receives `(fastify, options)`.
- **`handler.ts`** – Route handlers. Thin: validate input (Zod does this via schema), call service, send response. Use `AuthenticatedRequest` and middleware when the route is protected (see [AUTH.md](./AUTH.md)).
- **`service.ts`** – Business logic and DB access. Use `db` from `src/config/database` / `src/db`. No request/reply here.
- **`schema.ts`** – Zod schemas and Fastify response schemas (e.g. `response: { 200: MyZodSchema }`). Reuse for validation and OpenAPI.
- **`docs.ts`** – OpenAPI bits: `tags`, `summary`, `description`. Spread into route schema so Swagger stays in sync.

**Adding a new module:**

1. Create `src/modules/<name>/` with `routes.ts`, `handler.ts`, `service.ts`, `schema.ts`, `docs.ts` as needed.
2. In `src/index.ts`: `import <name>Routes from "./modules/<name>/routes"` and `await fastify.register(<name>Routes, { prefix: "/api" })`.
3. If the module has Swagger tags, add them in `src/config/swagger.ts` under `tags`.

Use the **health** module (`src/modules/health/`) as the reference for structure and patterns.

---

## 4. Conventions (see RULE.md)

- **Errors:** Let the global error handler in `index.ts` format responses. Throw or pass errors with an appropriate `statusCode` when possible; use `reply.send()` only when you need a custom shape.
- **Validation:** Use Zod schemas on routes; avoid ad-hoc checks in handlers.
- **Auth:** Use `authenticate` for routes that require a user; use `optionalAuth` + `requireAuth` when the route can work for both anonymous and logged-in users. See [AUTH.md](./AUTH.md).
- **DB:** All schema in `src/db/schema.ts`. Use Drizzle queries in services, not raw SQL, unless necessary.
- **Env:** All env vars are validated in `src/config/env.ts`. Add new vars there and in `.env.example`.

---

## 5. Commands

| Command | Use |
|--------|-----|
| `pnpm dev` | Run with hot reload. |
| `pnpm build` | Compile to `dist/`. |
| `pnpm start` | Run production build. |
| `pnpm type-check` | TypeScript check only. |
| `pnpm db:generate` | Generate Drizzle migrations from `src/db/schema.ts`. |
| `pnpm db:push` | Push schema to DB (dev). |
| `pnpm db:migrate` | Run migrations. |
| `pnpm db:studio` | Open Drizzle Studio. |

Before suggesting DB changes, remind the user to run migrations or push after schema edits.

---

## 6. Testing and quality

- There is no test runner in this boilerplate. When adding tests later, keep them next to the code or in a `test/` directory and document the command in README and here.
- Run `pnpm type-check` after edits to ensure types are valid.
- When adding routes, keep Swagger in sync (schema + docs) so `/api/docs` stays accurate.

---

## 7. References

- **Project rules:** [RULE.md](./RULE.md)
- **Auth and authorization:** [AUTH.md](./AUTH.md)
- **Setup and deployment:** [BACKEND_SETUP_GUIDE.md](./BACKEND_SETUP_GUIDE.md)
- **Quick start:** [README.md](./README.md)

When in doubt, follow existing patterns in `src/modules/health/` and the conventions in RULE.md and AUTH.md.
