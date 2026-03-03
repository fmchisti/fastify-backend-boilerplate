# Fastify Backend Boilerplate

A minimal Fastify + TypeScript backend with **Drizzle ORM**, **Zod**, **Swagger**, and **Supabase** auth. Use this as a starting point for new APIs.

## Stack

- **Fastify** – HTTP server  
- **TypeScript** – type safety  
- **Drizzle ORM** – PostgreSQL schema and queries  
- **Zod** – validation and OpenAPI schema generation  
- **Supabase** – JWT auth (optional)  
- **Pino** – logging  

## Quick start

```bash
pnpm install
cp .env.example .env   # create and fill your env
pnpm dev
```

- **Root:** `GET /` – API info  
- **Health:** `GET /api/health` – health check  
- **Docs:** `GET /api/docs` – Swagger UI (optional Basic auth via `DOCS_USERNAME` / `DOCS_PASSWORD`)  

## Scripts

| Command        | Description                |
|----------------|----------------------------|
| `pnpm dev`     | Run with hot reload        |
| `pnpm build`   | Compile to `dist/`         |
| `pnpm start`   | Run production build       |
| `pnpm type-check` | TypeScript check        |
| `pnpm db:generate` | Generate Drizzle migrations |
| `pnpm db:push` | Push schema to DB          |
| `pnpm db:studio` | Drizzle Studio UI        |

## Project structure

- `src/config/` – env, database, logger, Supabase, Swagger  
- `src/db/` – Drizzle schema (edit `schema.ts`, then `db:generate` / `db:push`)  
- `src/middleware/` – `authenticate`, `optionalAuth`, `requireAuth`  
- `src/modules/` – feature modules (e.g. `health`); add new ones here (routes, handler, service, schema, docs)
- `src/types/` – shared types

See **[BACKEND_SETUP_GUIDE.md](./BACKEND_SETUP_GUIDE.md)** for full setup, env vars, and deployment.

**AI & maintainers:** See [AGENT.md](./AGENT.md) (workflow), [RULE.md](./RULE.md) (conventions), [AUTH.md](./AUTH.md) (auth).
