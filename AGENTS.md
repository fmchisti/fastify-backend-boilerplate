# AGENTS.md

How to work in this codebase. Applies to developers and AI agents (Claude Code, Cursor, Codex, …).

## Stack

Fastify 5, TypeScript (strict, ESM, NodeNext), Zod 4, PostgreSQL, Vitest, Pino.
Auth, ORM, and storage sit behind interfaces; `README.md` lists which ones this project uses.

## Verify every change

```bash
pnpm check:fix && pnpm type-check && pnpm test
```

`check:fix` formats, organizes imports, and applies safe lint fixes (Biome). CI runs `pnpm check` and fails on any difference.

Tests need no database, network, or credentials.

## Layout

| Path | Role |
|---|---|
| `src/app.ts` | `buildApp(overrides)`: registers plugins, error handlers, routes. No listening, no business logic. |
| `src/index.ts` | Starts the server. |
| `src/container.ts` | `AppDependencies`: database, auth, repositories, storage. Add a field when a module needs a new dependency. |
| `src/auth/` | `AuthProvider` interface (`types.ts`), middleware, `providers/<name>/`. |
| `src/db/` | `Database` interface, selected ORM client and schema. |
| `src/storage/` | `StorageProvider` interface, `providers/<name>/`. |
| `src/modules/<feature>/` | Feature modules (see below). |
| `src/lib/` | Framework helpers: `errors.ts`, `pagination.ts`, `basic-auth.ts`. Not for feature logic. |
| `src/config/` | Core env (`env.ts`), logger, swagger. |
| `test/` | Vitest. `fakes/` for providers, `repositories/` for ORM contract tests. |

Do not add other top-level folders under `src/` (e.g. `utils/`, `services/`). Put logic in the module that uses it.

## Module pattern

`src/modules/todos/` is the reference. Each feature has:

| File | Contains |
|---|---|
| `schema.ts` | Zod schemas for body/params/query/response, exported as route schema objects (`CreateTodoSchema`). Domain types via `z.infer`. |
| `docs.ts` | OpenAPI `tags`, `summary`, `description`, `security`. |
| `repository/types.ts` | Repository interface. Every method scoped by `userId` when data is user-owned. |
| `repository/<orm>.ts` | One implementation per ORM, mapping rows to domain types. `repository/index.ts` re-exports the selected one. |
| `service.ts` | Business rules. Throws `HttpError`. No `request`/`reply`, no ORM imports. |
| `handler.ts` | Thin handlers typed `ZodRouteHandler<typeof Schema>`. Call the service, return the result. |
| `routes.ts` | `FastifyPluginAsyncZod<Options>`; receives dependencies via plugin options. |

### Adding a module

**Standard user-owned CRUD resource:** generate it, then edit.

```bash
pnpm gen:module product --fields "name:string price:float stock:int description:text? releasedAt:datetime?"
pnpm db:migrate
```

Types: `string` (≤255), `text`, `int`, `float`, `boolean`, `datetime`; `?` = nullable. It creates the files below for the project's ORM, the table and migration, registers the module in `app.ts`, `container.ts`, `swagger.ts`, and `test/helpers.ts` (at the `// @gen:` markers, keep them), and writes route and repository contract tests. Use `--plural` for irregular names and `--dry-run` to preview.

**Anything else (custom queries, no user ownership, relations):** generate as a starting point or copy `src/modules/todos/`, then:

1. Create the files above. Add tables to the ORM schema (`src/db/drizzle/schema/` or `prisma/schema/`), then `pnpm db:generate`.
2. Add the repository to `AppDependencies` in `src/container.ts`.
3. Register in `src/app.ts`: `await app.register(xRoutes, { prefix: "/api", repository: deps.x })`.
4. Add the Swagger tag in `src/config/swagger.ts`.
5. Tests: routes in `test/<feature>.test.ts` with `useTestApp()` + an in-memory fake; repository behaviour in a contract test under `test/repositories/` (see `todo-repository.contract.ts`).

## Rules

### Types
- No `any`, no non-null `!`, no `as` casts to silence errors. Fix the types.
- Handlers: `ZodRouteHandler<typeof Schema>` so body, params, query, and the return value are checked against the schema.
- Relative imports end in `.ts` (rewritten to `.js` on build).
- Use `import type` for type-only imports (`verbatimModuleSyntax`).

### Errors
- Throw `new HttpError(status, message)` from `src/lib/errors.ts`. The global handler returns `{ error, message, details? }` and hides messages on 5xx.
- Never catch-and-send error responses in handlers. Use `ErrorResponseSchema` in route `response` for documented error codes.

### Auth
- Protected routes: `onRequest: [authenticate]` (or `fastify.addHook("onRequest", authenticate)` for a whole plugin), then `getAuthUser(request)` in the handler. `onRequest` rejects anonymous requests before body parsing and validation.
- Optional user: `onRequest: [optionalAuth]`, then read `request.user` (`AuthUser | null`).
- Never import a specific auth provider in modules. Depend only on `AuthUser` / middleware.
- Never use provider user metadata (e.g. Supabase `user_metadata`) for identity or authorization: users can edit it.
- Scope queries by `userId`. Return 404 (not 403) for other users' records so ids cannot be probed.

### Env
- Core variables: `src/config/env.ts`. Provider variables: validated inside the provider with `loadEnv(schema)`, so only the selected provider's variables are required.
- New variables also go in `setup/features.ts` (env entries) so `.env.example` is generated correctly.

### Logging
- In requests use `request.log` (includes `requestId`). Pino signature is `log.info(obj, msg)`, object first.
- Never log tokens, passwords, or full headers. Authorization and cookie headers are redacted in `src/config/logger.ts`; add new secret paths there.

### Production behaviour
- Every route is rate limited per client IP. Opt out only for probes: `config: { rateLimit: false }`. Stricter limits: `config: { rateLimit: { max: 5, timeWindow: "1 minute" } }`.
- Core config is passed to `buildApp(overrides, { env })`. Read config from that `env`, not from module-level imports, so tests can vary it with `testEnv({ ... })`.
- Resources that need cleanup (connections, clients) must close in an `onClose` hook or the provider's `close()`, so graceful shutdown works.
- Never trust client-sent IP headers directly. Use `request.ip`, which respects `TRUST_PROXY`.

### Database
- Only repositories import ORM clients (`src/db/<orm>/`). Services and handlers depend on repository interfaces.
- After schema changes run `pnpm db:generate` and commit the migration.

### API
- All routes under `/api`. Every route has a Zod schema and docs so `/api/docs` stays accurate.

## Providers and setup

- Details on each provider and adding new ones: [docs/providers.md](./docs/providers.md).
<!-- @setup-if deploy=railway -->
- Deploy config: `railway.json` runs `pnpm db:migrate:deploy` before deploy and health-checks `/api/health/ready`.
<!-- @setup-endif -->
