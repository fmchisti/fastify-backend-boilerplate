# Maintaining Fastra

This file is for changes to Fastra, the template itself. `pnpm setup:project` deletes it (with `setup/` and `test/setup/`) from generated projects.

## How setup works

`setup/cli.ts` asks for one option per feature in `setup/features.ts` (auth, orm, storage, redis, deploy), then:

1. **Deletes paths** owned by unselected options (`paths` in the manifest).
   - A path listed by several options of the same feature is kept if any of them is selected.
   - A path listed by several features is kept only if every feature keeps it (e.g. `src/auth/providers/better-auth/database/prisma.ts` needs Better Auth and Prisma).
2. **Resolves directives** in `.ts`, `.mts`, `.prisma`, `.md`, `.mdc`, `.yml`, and `Dockerfile` files, and removes the directive comments.
3. **Rewrites `package.json`**: removes dependencies and scripts owned only by unselected options, sets the selected options' scripts, and removes the setup tool.
4. **Generates `.env.example`** from `CORE_ENV` plus the selected options' `env`.
5. Runs `pnpm install`, regenerates the initial migration for the selected schema, formats with Biome, and type-checks.

## Directives

| Form | Use for | Example |
|---|---|---|
| Trailing `// @setup-select <feature>` | Import/export whose path names the selected option | `export { createAuthProvider } from "./providers/better-auth/index.ts"; // @setup-select auth` |
| Trailing `// @setup-if <feature>=<a>,<b>` | Keep one complete one-line `import`/`export` | `import fileRoutes from "./modules/files/routes.ts"; // @setup-if storage=s3,local` |
| Block `// @setup-if <feature>=<a>,<b>` … `// @setup-endif` | Anything else (object properties, route registration, docs sections) | see `src/container.ts` |
| Block `@setup-template-only` … `@setup-endif` | Text that only makes sense before setup | see `README.md` |

- Blocks also work as `# …` (YAML, Dockerfile) and `<!-- … -->` (Markdown). Blocks cannot be nested.
- **Imports must use the trailing forms.** Biome's organize-imports moves standalone comment lines with the import below them, which breaks block directives around imports.
- In Markdown tables, avoid block directives between rows (they break table rendering in the template); use lists instead.
- `@gen:` markers are not setup directives. They stay in generated projects for `pnpm gen:module`.

## Template state

The template compiles and runs with every option present at once: `@setup-select` lines point at a default (Better Auth, Drizzle, local storage), and every `@setup-if` block is kept. All provider code is type-checked and tested in the template.

## Adding an option (e.g. Clerk auth, GCS storage, a Kysely ORM)

1. Implement the interface under `src/<area>/providers/<id>/` with the same factory name as the other options (`createAuthProvider`, `createStorage`, `createDatabase`). Validate env inside with `loadEnv`. Accept injected clients for tests.
2. Add tests next to the others (`test/providers/<id>.test.ts`, …) using injected fakes, no network.
3. Add the option to `setup/features.ts`: `paths`, `dependencies`, `devDependencies`, `scripts`, `env`, `nextSteps`. Install dependencies in the template's `package.json`.
4. Add `@setup-if` blocks where the option changes shared files (Dockerfile, CI env, docs).
5. Run `pnpm setup:verify --only <id>`, then the full matrix.

Adding a whole feature (a new question): add it to `features`, the CLI flags in `setup/cli.ts`, the matrix in `setup/verify.ts`, and `test/setup/engine.test.ts` if the engine changes.

## Verifying

```bash
pnpm setup:verify                 # every auth × ORM × storage × Redis combination
pnpm setup:verify --only prisma   # combinations whose name contains "prisma"
pnpm setup:verify --no-tests      # skip vitest
```

Each combination is applied to a temporary copy (sharing `node_modules`). Then it regenerates migrations, formats, generates a module with every field type, and runs `tsc`, `biome check --error-on-warnings`, and `vitest`. Failing copies are kept, and their paths are printed.

CI runs the matrix (`setup-matrix` job) and a Docker smoke test for a Drizzle and a Prisma + Redis project (`docker` job) on every pull request.

## `create-fastra` package

`packages/create-fastra/` is the `pnpm create fastra` CLI. It downloads the template with giget (skipping `packages/`, `node_modules`, `.env`, …), runs `pnpm install` and `pnpm setup:project` (forwarding every option it does not own), then creates a git repository with an initial commit. Setup removes `packages/` from generated projects.

- Code: `src/cli.ts` (argument parsing, target checks, template fetching) and `src/index.ts` (the interactive flow). Tests: `packages/create-fastra/test/`, run by the root `pnpm test`.
- `--template` accepts a giget source (`gh:fmchisti/fastra#v1.0.0`) or a local folder, which CI uses to test the current commit.
- CI job `create-fastra` builds and packs the package like `npm publish`, creates a project from the checkout with `pnpm dlx`, and checks it (name, no setup files, clean git tree, check/type-check/test).

### Publishing

Publishing needs an npm account with 2FA (npm asks for the authenticator code):

```bash
pnpm install
pnpm build:create
npm login
(cd packages/create-fastra && npm publish --access public)
```

Then anyone can run `pnpm create fastra my-api` (or `npm create fastra@latest my-api`).

For a new CLI release, bump `version` in `packages/create-fastra/package.json`, build, and publish it. The CLI downloads the template from `main` at run time, so template changes need no new package version.

## Checklist for template changes

- [ ] `pnpm check && pnpm type-check && pnpm test`
- [ ] `pnpm setup:verify` passes for every combination
- [ ] New env vars in `CORE_ENV` or the option's `env`
- [ ] Docs use directives so generated projects only describe what they contain
- [ ] `AGENTS.md` updated if conventions changed
