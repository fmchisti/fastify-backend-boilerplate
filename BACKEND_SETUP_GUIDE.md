# Backend Setup Guide

A replication guide to configure another project with the same backend stack: **Fastify + TypeScript + Drizzle ORM + Supabase Auth + PostgreSQL**.

---

## Stack Overview

| Technology | Purpose |
|------------|---------|
| **Fastify** | High-performance HTTP server |
| **TypeScript** | Type safety |
| **Drizzle ORM** | PostgreSQL ORM + migrations |
| **Supabase** | Auth (JWT) + optional storage |
| **PostgreSQL** | Database (via `postgres` / `pg`) |
| **Zod** | Validation + schema generation for Swagger |
| **Pino** | Logging |

---

## 1. Project Structure

```
backend/
├── .gitignore
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── drizzle.config.ts
├── src/
│   ├── index.ts
│   ├── config/
│   │   ├── env.ts          # Environment validation (Zod)
│   │   ├── database.ts     # Drizzle + postgres client
│   │   ├── logger.ts       # Pino logger
│   │   ├── supabase.ts     # Supabase clients (anon + admin)
│   │   └── swagger.ts      # OpenAPI / Swagger UI config
│   ├── db/
│   │   ├── index.ts        # Re-exports
│   │   └── schema.ts       # Drizzle schema
│   ├── middleware/
│   │   ├── auth.ts         # JWT auth + optionalAuth
│   │   └── authorize.ts    # requireAuth (authenticated user required)
│   ├── modules/            # Feature modules
│   │   └── health/         # Example: health check
│   │       ├── routes.ts
│   │       ├── handler.ts
│   │       ├── service.ts
│   │       ├── schema.ts
│   │       └── docs.ts
│   └── types/
├── scripts/
└── public/
```

---

## 2. Dependencies

### package.json (dependencies)

```json
{
  "dependencies": {
    "@fastify/cors": "^11.2.0",
    "@fastify/swagger": "^9.6.1",
    "@fastify/swagger-ui": "^5.2.4",
    "@supabase/supabase-js": "^2.39.3",
    "dotenv": "^16.6.1",
    "drizzle-orm": "^0.45.1",
    "fastify": "^5.7.2",
    "fastify-type-provider-zod": "^6.1.0",
    "pg": "^8.16.3",
    "pino": "^8.17.2",
    "postgres": "^3.4.3",
    "zod": "^4.3.5"
  },
  "devDependencies": {
    "@types/node": "^20.19.28",
    "@types/pg": "^8.16.0",
    "drizzle-kit": "^0.31.8",
    "pino-pretty": "^10.3.1",
    "tsx": "^4.21.0",
    "typescript": "^5.3.3"
  }
}
```

### Scripts

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "type-check": "tsc --noEmit",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio"
  }
}
```

---

## 3. TypeScript Config (`tsconfig.json`)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "rootDir": "./src",
    "outDir": "./dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## 4. Drizzle Config (`drizzle.config.ts`)

```typescript
/// <reference types="node" />
import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is required");
}

export default defineConfig({
  out: "./drizzle",
  schema: "./src/db/schema.ts",
  dialect: "postgresql",
  migrations: {
    table: "__drizzle_migrations",
    schema: "./drizzle",
  },
  dbCredentials: {
    url: databaseUrl,
  },
});
```

---

## 5. Environment Variables (`.env`)

Create a `.env` file and validate with Zod in `src/config/env.ts`:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `BACKEND_URL` | ✅ | Backend API base URL |
| `FRONTEND_URL` | No | Frontend URL (optional) |
| `SUPABASE_URL` | ✅ | Supabase project URL |
| `SUPABASE_ANON_KEY` | ✅ | Supabase anon key |
| `SUPABASE_SERVICE_KEY` | ✅ | Supabase service role key |
| `PORT` | No | Default `3000` |
| `HOST` | No | Default `0.0.0.0` |
| `NODE_ENV` | No | `development` \| `production` \| `test` |
| `LOG_LEVEL` | No | `trace`, `debug`, `info`, `warn`, `error`, `fatal` |
| `SESSION_DURATION_DAYS` | No | Default `7` |
| `DOCS_USERNAME` | No | HTTP Basic auth for `/api/docs` |
| `DOCS_PASSWORD` | No | HTTP Basic auth for `/api/docs` |

### Example `.env.example`

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/mydb
BACKEND_URL=http://localhost:3000
FRONTEND_URL=http://localhost:3001
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...
PORT=3000
HOST=0.0.0.0
NODE_ENV=development
SESSION_DURATION_DAYS=7
```

---

## 6. Config Files

### `src/config/env.ts`

- Use Zod schema to parse and validate `process.env`
- Export typed `env` and `Env` type
- Throw on invalid values

### `src/config/database.ts`

```typescript
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../db/schema";
import { env } from "./env";

const client = postgres(env.DATABASE_URL, { prepare: false });
export const db = drizzle(client, { schema });
```

### `src/config/logger.ts`

- Pino with `pino-pretty` in development
- Configurable level via `LOG_LEVEL`

### `src/config/supabase.ts`

- `supabaseClient` – anon key for user-facing auth
- `supabaseAdmin` – service key for server-side (e.g. `getUser(token)`)

### `src/config/swagger.ts`

- OpenAPI 3.1 with `fastify-type-provider-zod` / `jsonSchemaTransform`
- Swagger UI at `/api/docs`
- Optional HTTP Basic auth when `DOCS_USERNAME` and `DOCS_PASSWORD` are set

---

## 7. Main Entry (`src/index.ts`)

1. Load `env` first (via import)
2. Initialize DB, Supabase, logger
3. Create Fastify with `loggerOptions`
4. Set `validatorCompiler` / `serializerCompiler` from `fastify-type-provider-zod`
5. Set global error handler (consistent JSON error shape)
6. Register: CORS, Swagger, Swagger UI, routes
7. Listen on `env.PORT` / `env.HOST`

---

## 8. Auth & Authorization

### Auth Middleware (`middleware/auth.ts`)

- `authenticate`: Validates `Authorization: Bearer <token>` via `supabaseAdmin.auth.getUser(token)` and attaches `request.user` (id, email, metadata).
- `optionalAuth`: Same but does not fail when no token is provided.

### Authorize Middleware (`middleware/authorize.ts`)

- `requireAuth`: Ensures `request.user` is set (use after `optionalAuth` when you need a logged-in user).
- Add your own role-based helpers (e.g. `requireAdmin`) as needed.

---

## 9. Module Pattern

Each feature module:

```
modules/{feature}/
├── routes.ts   # Fastify routes + Zod schema + Swagger tags
├── handler.ts  # Handlers (thin, call services)
├── service.ts  # Business logic, DB
├── schema.ts   # Zod schemas
└── docs.ts     # Swagger descriptions (optional)
```

---

## 10. .gitignore

```
node_modules/
dist/
drizzle/
*.log
.env
.env.local
.DS_Store
*.tsbuildinfo
```

---

## 11. Quick Start

```bash
# Install
pnpm install

# Copy env
cp .env.example .env
# Edit .env with your values

# Generate migrations (after schema changes)
pnpm db:generate

# Run migrations
pnpm db:migrate

# Development
pnpm dev

# Production build
pnpm build
pnpm start
```

---

## 12. External Services

| Service | Purpose |
|---------|---------|
| **PostgreSQL** | Database (local, Supabase, Railway, Neon, etc.) |
| **Supabase** | Auth (JWT), optionally Storage/Realtime |
| **Railway** (optional) | Deploy via `railway up` |

---

## 13. Deployment (Railway)

If using Railway:

1. Add `railway` CLI and link project
2. Set env vars in Railway dashboard
3. `pnpm deploy` (runs `railway up`)

---

This guide covers the core configuration. Add new modules under `src/modules/{feature}/` (routes, handler, service, schema, docs).
