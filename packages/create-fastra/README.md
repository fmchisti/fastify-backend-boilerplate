# create-fastra

Create a type-safe Fastify + TypeScript API from [Fastra](https://github.com/fmchisti/fastra).

```bash
pnpm create fastra shop-api
```

It downloads the template, installs dependencies, runs Fastra's setup (you choose auth, ORM, storage, Redis, and deploy target; everything else is deleted), and creates a git repository with an initial commit.

Non-interactive:

```bash
pnpm create fastra shop-api --auth logto --orm prisma --storage s3 --redis redis --deploy railway --yes
```

| Option | Values |
|---|---|
| `--name` | package name (default: directory name) |
| `--auth` | `better-auth` · `supabase` · `firebase` · `logto` |
| `--orm` | `drizzle` · `prisma` |
| `--storage` | `s3` · `local` · `none` |
| `--redis` | `none` · `redis` |
| `--deploy` | `railway` · `none` |
| `--yes` | use defaults for anything not passed |
| `--template <source>` | another branch or tag (`gh:fmchisti/fastra#v1.0.0`), a fork, or a local folder |
| `--no-git` | skip `git init` and the initial commit |

Requires Node.js 22.12+ and pnpm (`corepack enable`).
