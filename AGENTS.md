# AGENTS.md

The rulebook for this codebase, for developers and AI coding agents (Claude Code, Cursor, Codex, Copilot, Gemini, …).
`CLAUDE.md` and `.cursor/rules` point here. When this file and the code disagree, the code in `src/modules/todos/` is the reference; fix this file.

## Stack

Fastify 5 · TypeScript (strict, ESM, NodeNext) · Zod 4 (validation, types, OpenAPI) · PostgreSQL · Vitest · Biome · Pino.
Auth, ORM, storage, and Redis sit behind interfaces. `README.md` lists which ones this project uses.

## Workflow for every task

1. **Read before writing.** Open the files you will change and the closest existing example (`src/modules/todos/` for modules, an existing provider for adapters). Match its structure, naming, and comment style.
2. **Plan the smallest change** that solves the task. Do not refactor, rename, or reformat unrelated code.
3. **New CRUD resource?** Start with `pnpm gen:module` (see [Adding a module](#adding-a-module)) instead of writing it by hand.
4. **Write or update tests with the change.** A bug fix starts with a failing test.
5. **Verify:**
   ```bash
   pnpm check:fix && pnpm type-check && pnpm test
   ```
   All three must pass. Tests need no database, network, Docker, or credentials.
6. **Update docs** when behaviour, env vars, scripts, or conventions change: this file, `README.md`, `docs/providers.md`, and `.env.example`.
7. **Report honestly:** what changed, what was verified, and anything not verified.

### Definition of done

- [ ] `pnpm check`, `pnpm type-check`, `pnpm test` pass
- [ ] Every new route has a Zod schema (params/query/body/response), docs, auth, and tests (happy path, 401, 404, 400)
- [ ] User-owned data is scoped by `userId` in the repository
- [ ] Schema change has a committed migration
- [ ] New env vars are validated (`loadEnv`) and listed in `.env.example`
- [ ] No `any`, `!`, silencing `as` casts, `console.log`, or commented-out code
- [ ] Docs updated if behaviour or conventions changed

## Layout

```
src/
  app.ts               buildApp(overrides, { env }): plugins, hooks, error handling, routes. No listen, no business logic.
  index.ts             Starts the server, wires graceful shutdown.
  container.ts         AppDependencies: database, auth, repositories, storage, redis. Tests replace them with fakes.
  auth/                AuthProvider interface (types.ts), middleware.ts, providers/<name>/
  db/                  Database interface (types.ts), index.ts re-exports the selected ORM, <orm>/ client + schema
  storage/             StorageProvider interface, providers/<name>/ (if file storage was selected)
  redis/               Shared Redis client (if Redis was selected)
  modules/<feature>/   Feature modules (see Module pattern)
  lib/                 Framework helpers: errors, pagination, crud, request-id, shutdown, basic-auth
  config/              Core env (env.ts), logger, swagger, app-info
  types/fastify.ts     ZodRouteHandler and Fastify type augmentation (request.user, app.auth)
  generated/           Prisma client (generated, gitignored). Never edit.
scripts/gen-module.ts  Module generator (pnpm gen:module)
test/
  helpers.ts           useTestApp, buildTestApp, testEnv, createTestDependencies, multipartBody
  fakes/               In-memory implementations: auth, database, storage, redis, repositories
  repositories/        Repository contract tests on in-process Postgres (PGlite) + ORM harnesses
  providers/, storage/ Adapter tests with injected clients (no network)
drizzle/ or prisma/    Migrations (commit them; never edit an applied one)
docs/providers.md      Auth, ORM, storage, Redis details and how to add a provider
```

Do not add other folders under `src/` (e.g. `utils/`, `services/`, `helpers/`). Put code in the module that uses it; only framework-level helpers go in `src/lib/`.

## Module pattern

`src/modules/todos/` is the hand-written reference; generated modules follow the same shape.

| File | Contains | Must not |
|---|---|---|
| `schema.ts` | Zod schemas for params/query/body/response, route schema objects (`CreateTodoSchema`), domain types via `z.infer` | Import ORM or Fastify |
| `docs.ts` | OpenAPI `tags`, `summary`, `description`, `security` | |
| `repository/types.ts` | Repository interface, every method scoped by `userId` for user-owned data | |
| `repository/<orm>.ts` | ORM implementation; maps rows to domain types (never return raw rows) | Contain business rules |
| `repository/index.ts` | Re-exports the implementation for this project's ORM | |
| `service.ts` | Business rules, throws `HttpError` | Touch `request`/`reply` or import ORM clients |
| `handler.ts` | Thin handlers typed `ZodRouteHandler<typeof Schema>`: call service, return result | Contain logic or catch-and-send errors |
| `routes.ts` | `FastifyPluginAsyncZod<Options>`; auth hook; routes; dependencies come from plugin options | Import `container.ts` or create clients |

### Adding a module

**User-owned CRUD resource (most cases): generate, then edit.**

```bash
pnpm gen:module product --fields "name:string price:float stock:int description:text? releasedAt:datetime?"
pnpm db:migrate
pnpm check:fix && pnpm type-check && pnpm test
```

- Field types: `string` (≤255), `text`, `int`, `float`, `boolean`, `datetime`. `?` = nullable. `id`, `userId`, `createdAt`, `updatedAt` are added.
- Creates the module files, table, migration, fake, route tests, and repository contract tests, and registers the module at the `// @gen:` markers in `app.ts`, `container.ts`, `swagger.ts`, `test/helpers.ts`.
- `--plural people` for irregular names, `--dry-run` to preview. It refuses to overwrite files.
- Then customize: add validation to the schema, rules to the service, and extra query methods to the repository interface (plus fake and implementation).

**Anything else** (public data, relations, custom queries): generate as a starting point or copy `todos`, then:

1. Add the table to the ORM schema and create a migration (see [Database](#database)).
2. Write the module files above.
3. Add the repository to `AppDependencies` and `createDependencies` in `src/container.ts`.
4. Register routes in `src/app.ts`: `await app.register(xRoutes, { prefix: "/api", repository: deps.x })`.
5. Add the Swagger tag in `src/config/swagger.ts`.
6. Add an in-memory fake to `test/fakes/` and `createTestDependencies`, route tests in `test/<feature>.test.ts`, and a repository contract test in `test/repositories/`.

## Rules

### TypeScript
- No `any`, no non-null `!`, no `as` casts to silence errors, no `@ts-ignore`. Fix the types. (`@ts-expect-error` only in type tests.)
- Handlers use `ZodRouteHandler<typeof Schema>` so params, query, body, and the return value are checked against the schema.
- Relative imports end in `.ts` (rewritten to `.js` on build). Use `import type` for types.
- Prefer `const` arrow functions and small factory functions (`createXService(repository)`) over classes and singletons.

### Naming
- Files and folders: `kebab-case`. Module folders and URLs: plural (`/api/blog-posts`).
- Functions and variables: `camelCase`. Types and interfaces: `PascalCase`. `UPPER_SNAKE_CASE` only for true constants.
- Zod schemas: `XSchema`; route schema objects: `CreateXSchema`; inputs: `CreateXInput`. Factories: `createX`.
- Tables and columns: `snake_case`, tables plural. Every table has `id uuid`, `created_at`, `updated_at` (timestamptz).

### API conventions
- All routes under `/api`. Every route has a Zod schema (including `response`) and docs, so `/api/docs` stays accurate.
- `POST` → 201 with the created resource. `PATCH` → partial update, 200. `DELETE` → 204, no body. Lists → `{ items, page, pageSize, total, totalPages }` via `paginatedSchema` and `PaginationQuerySchema`.
- Errors: throw `new HttpError(status, message)`. The global handler returns `{ error, message, details? }`, adds validation `details`, and hides messages on 5xx. Document error codes with `ErrorResponseSchema`.
- Never catch errors just to send a response. Catch only to translate a known failure into an `HttpError` or to clean up.
- Dates are `Date` in code (`z.date()` in responses) and ISO strings in JSON. IDs are UUIDs validated with `z.uuid()`.

### Auth and data access
- Protected routes: `onRequest: [authenticate]` (or `fastify.addHook("onRequest", authenticate)` for a whole plugin), then `getAuthUser(request)`. `onRequest` rejects anonymous requests before body parsing and validation.
- Optional user: `onRequest: [optionalAuth]`, then read `request.user` (`AuthUser | null`).
- Modules depend on `AuthUser` and the middleware only. Never import an auth provider or vendor SDK in a module.
- Never use provider user metadata (e.g. Supabase `user_metadata`) for identity or authorization: users can edit it.
- Scope every query on user-owned data by `userId`. Return 404, not 403, for other users' records so IDs cannot be probed.

### Security checklist
- Validate all input with Zod schemas on the route; never read `request.body` without one.
- No secrets in code, logs, tests, or committed files. Read them through validated env.
- Use `request.ip` (respects `TRUST_PROXY`); never read `x-forwarded-for` yourself.
- Keep helmet, CORS (`CORS_ORIGINS`), and rate limiting on. Add stricter limits on expensive or sensitive routes: `config: { rateLimit: { max: 5, timeWindow: "1 minute" } }`.
- File uploads: server-generated keys, content-type allowlist, size limit, owner checks (see `src/modules/files/` when present).
- New dependency: prefer well-maintained packages already in the stack, and say why in the PR.

### Env and config
- Core variables: `src/config/env.ts`. Provider or module variables: validate where used with `loadEnv(schema)`, so only what the project uses is required.
- Add every new variable to `.env.example` with a comment.
<!-- @setup-template-only -->
- In the template, also add it to `CORE_ENV` or the option's `env` in `setup/features.ts`, because setup regenerates `.env.example`.
<!-- @setup-endif -->
- Inside the app, read config from the `env` passed to `buildApp(overrides, { env })`, not module-level imports, so tests can vary it with `testEnv({ ... })`.

### Logging
- In requests use `request.log` (includes `requestId`); elsewhere `logger` from `src/config/logger.ts`. No `console.log`.
- Pino signature is `log.info({ context }, "message")`: object first.
- Never log tokens, passwords, or full headers. Add new secret paths to `redact` in `src/config/logger.ts`.

### Database
- Only repositories import ORM clients. Services and handlers depend on repository interfaces.
- Scope, paginate, and order lists (`createdAt desc, id desc`). No unbounded queries.
<!-- @setup-if orm=drizzle -->
- Schema: `src/db/drizzle/schema/*.ts`, exported from `schema/index.ts`. After a change: `pnpm db:generate` (creates SQL in `drizzle/`), then `pnpm db:migrate`.
<!-- @setup-endif -->
<!-- @setup-if orm=prisma -->
- Schema: `prisma/schema/*.prisma`. After a change: `pnpm db:migrate` (creates the migration and regenerates the client).
<!-- @setup-endif -->
- Commit migrations. Never edit a migration that has been applied anywhere; add a new one.
- Production applies migrations with `pnpm db:migrate:deploy`.

### Lifecycle
- Anything holding connections (clients, pools) is created in `container.ts` and closed in the `onClose` hook in `app.ts` or the provider's `close()`, so graceful shutdown works.
- Health checks (`/api/health`, `/api/health/ready`) are never rate limited. A new external dependency adds a check to `/api/health/ready` in `app.ts`.

## Testing

- **Route tests** use fakes, not real services:
  ```ts
  const app = useTestApp(); // buildApp with fakes for every dependency
  const res = await app().inject({ method: "GET", url: "/api/todos", headers: bearer("alice-token") });
  ```
  `bearer("alice-token")` → `ALICE`, `bearer("bob-token")` → `BOB` (`test/fakes/auth.ts`). Any other token is unauthenticated.
- **Custom dependencies or config:** `buildTestApp({ auth: myFake }, testEnv({ RATE_LIMIT_MAX: "2" }))`, then `await app.close()`.
- **Repositories:** one contract suite per repository interface, run against the in-memory fake and the real ORM on PGlite (`test/repositories/`). Generated modules use `describeCrudRepositoryContract`.
- **Adapters:** inject the vendor client through options (see `test/providers/`); never call real services.
- **Types:** `test/*.test-d.ts` with `expectTypeOf` and `@ts-expect-error`.
- Each test creates its own data; tests do not depend on order. Mocks are restored automatically (`restoreMocks`).
- Test through the HTTP API where possible, and assert error bodies, not just status codes.

## Markers in source

- `// @gen:dependencies`, `// @gen:factories`, `// @gen:routes`, `// @gen:tags`, `// @gen:fakes`: insertion points for `pnpm gen:module`. **Do not remove or move them.**
<!-- @setup-template-only -->
- `@setup-select`, `@setup-if`, `@setup-template-only` (template only): resolved and removed by `pnpm setup:project`. Read [docs/template.md](./docs/template.md) before editing them.
<!-- @setup-endif -->

## Git

- Conventional Commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`. Imperative subject, ≤72 characters; the body explains why.
- One logical change per commit. Never commit `.env`, secrets, `dist/`, or `src/generated/`.
- PR description: summary, breaking changes, and a test plan listing what was actually run.

## More

- [README.md](./README.md): setup, scripts, production, deployment
- [docs/providers.md](./docs/providers.md): auth, ORM, storage, Redis, and adding a provider
<!-- @setup-template-only -->
- [docs/template.md](./docs/template.md): maintaining Fastra itself (setup CLI, directives, verify matrix)
<!-- @setup-endif -->
<!-- @setup-if deploy=railway -->
- `railway.json`: runs `pnpm db:migrate:deploy` before deploy and health-checks `/api/health/ready`
<!-- @setup-endif -->
