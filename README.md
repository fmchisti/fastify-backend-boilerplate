# Fastify Backend Boilerplate

Type-safe Fastify + TypeScript API.
<!-- @setup-template-only -->
Pick your auth provider, ORM, file storage and deploy target once, and the setup CLI deletes everything you did not choose.
<!-- @setup-endif -->

## Stack

- **Fastify 5** + **TypeScript** (strict, ESM) + **Zod 4** for validation, types, and OpenAPI
- **PostgreSQL**: local Docker, Railway, Supabase, Neon, RDS… anything with a connection string
- **Swagger UI** at `/api/docs`, **Pino** logging, **Vitest** tests (no database or credentials needed)

<!-- @setup-template-only -->
| Choice | Options |
|---|---|
| Auth | Better Auth (self-hosted) · Supabase · Firebase · Logto |
| ORM | Drizzle · Prisma |
| File storage | S3-compatible (AWS S3, R2, MinIO, Railway Buckets) · local disk · none |
| Deploy | Railway · none |
<!-- @setup-endif -->
<!-- @setup-if auth=better-auth -->
- **Auth**: Better Auth (users and sessions in this database)
<!-- @setup-endif -->
<!-- @setup-if auth=supabase -->
- **Auth**: Supabase Auth
<!-- @setup-endif -->
<!-- @setup-if auth=firebase -->
- **Auth**: Firebase Auth
<!-- @setup-endif -->
<!-- @setup-if auth=logto -->
- **Auth**: Logto
<!-- @setup-endif -->
<!-- @setup-if orm=drizzle -->
- **ORM**: Drizzle
<!-- @setup-endif -->
<!-- @setup-if orm=prisma -->
- **ORM**: Prisma
<!-- @setup-endif -->
<!-- @setup-if storage=s3 -->
- **Storage**: S3-compatible
<!-- @setup-endif -->
<!-- @setup-if storage=local -->
- **Storage**: local disk
<!-- @setup-endif -->
<!-- @setup-if deploy=railway -->
- **Deploy**: Railway (`railway.json`)
<!-- @setup-endif -->

<!-- @setup-template-only -->
## Start a new project

```bash
git clone <this-repo> my-api && cd my-api
rm -rf .git && git init && git add -A && git commit -m "Initial commit"
pnpm install
pnpm setup:project
```

`setup:project` asks four questions, then removes unselected providers (code, tests, dependencies, env vars), regenerates the initial migration, and type-checks. Non-interactive:

```bash
pnpm setup:project --auth logto --orm prisma --storage s3 --deploy railway --yes
```

<!-- @setup-endif -->
## Getting started

```bash
cp .env.example .env
pnpm db:up
pnpm db:migrate
pnpm dev
```

- API docs: http://localhost:3000/api/docs
- Liveness: `GET /api/health` · Readiness (checks DB): `GET /api/health/ready`
- Current user: `GET /api/me`
- Example CRUD: `/api/todos`
<!-- @setup-if storage=s3,local -->
- File uploads: `/api/files`
<!-- @setup-endif -->

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Run with hot reload |
| `pnpm build` / `pnpm start` | Compile to `dist/` / run it |
| `pnpm type-check` | TypeScript check (src + tests) |
| `pnpm test` | Unit, integration, and type tests |
| `pnpm db:up` / `pnpm db:down` | Local Postgres in Docker |
| `pnpm db:generate` | Generate a migration (Drizzle) or client (Prisma) |
| `pnpm db:migrate` | Apply migrations (development) |
| `pnpm db:migrate:deploy` | Apply migrations in production (after `pnpm build`) |
| `pnpm db:studio` | Browse the database |
<!-- @setup-template-only -->
| `pnpm setup:project` | Choose providers (deletes the rest) |
| `pnpm setup:verify` | Boilerplate maintainers: test every setup combination |
<!-- @setup-endif -->

## Project structure

```
src/
  app.ts            buildApp(): plugins, error handling, routes (no listen)
  index.ts          starts the server
  container.ts      dependencies (database, auth, repositories, storage); tests swap in fakes
  auth/             AuthProvider interface, middleware, providers/<name>
  db/               Database interface and the selected ORM client + schema
  storage/          StorageProvider interface and providers/<name>
  modules/<name>/   feature modules: routes, handler, service, schema, docs, repository
  lib/              errors, pagination, basic auth
  config/           env, logger, swagger
test/               Vitest; fakes/ for providers, repositories/ contract tests on in-process Postgres
```

## Production

Built in:
- **Graceful shutdown**: on SIGTERM, stops accepting connections, finishes in-flight requests (up to `SHUTDOWN_TIMEOUT_SECONDS`), closes the database, exits 0.
- **Health checks**: `/api/health` (liveness) and `/api/health/ready` (database reachable), never rate limited.
- **Security headers** (`@fastify/helmet`), **CORS** from `CORS_ORIGINS`, **rate limiting** per client IP (`RATE_LIMIT_MAX` per `RATE_LIMIT_WINDOW`).
- **`TRUST_PROXY=true`** behind Railway, Render, Fly, or a load balancer, so client IPs (rate limits, auth logs) are real. Leave `false` when exposed directly.
- **Request IDs**: `x-request-id` is accepted from your proxy or generated, returned on every response, and logged as `requestId`. Authorization and cookie headers are redacted from logs.
- **API docs** are off in production unless `DOCS_ENABLED=true` (protect them with `DOCS_USERNAME`/`DOCS_PASSWORD`).
- **Migrations without dev tools**: `pnpm db:migrate:deploy`.

Rate limits are stored in memory, so each instance counts separately. With several instances, pass a Redis store to `@fastify/rate-limit` in `src/app.ts`.

### Docker

```bash
docker build -t api .
docker run --rm --env-file .env api pnpm db:migrate:deploy
docker run --env-file .env -p 3000:3000 api
```

Multi-stage image on `node:22-alpine`, production dependencies only, runs as the `node` user, with a `HEALTHCHECK`. CI builds the image, runs migrations against Postgres, calls the API, and checks that `docker stop` exits cleanly.
<!-- @setup-if deploy=railway -->

### Railway

`railway.json` builds with Railpack, runs `pnpm db:migrate:deploy` before each deploy, health-checks `/api/health/ready`, and drains for 10 seconds. Set `TRUST_PROXY=true`, `CORS_ORIGINS`, and `DATABASE_URL=${{Postgres.DATABASE_URL}}`.
<!-- @setup-endif -->

## Database hosting

`DATABASE_URL` is the only thing that changes:

- **Local Docker**: `pnpm db:up` → `postgresql://postgres:postgres@localhost:5432/app`
- **Railway**: add a Postgres service, set `DATABASE_URL=${{Postgres.DATABASE_URL}}`
- **Supabase**: Project Settings → Database → connection string (session pooler for long-running servers)
- **Neon / RDS / other**: paste the connection string (add `?sslmode=require` if needed)

## Learn more

- [AGENTS.md](./AGENTS.md): conventions and how to add modules (for humans and AI agents)
- [docs/providers.md](./docs/providers.md): auth, ORM, and storage details, and how to add a new provider
