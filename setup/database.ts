import { execFile } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { Selection } from "./features.ts";

const execFileAsync = promisify(execFile);

export type Runner = (
  command: string,
  args: string[],
  options: { cwd: string; env: NodeJS.ProcessEnv },
) => Promise<void>;

/** Runs a command and only surfaces output when it fails. */
export const quietRunner: Runner = async (command, args, options) => {
  // A tool waiting for interactive input would otherwise hang forever
  await execFileAsync(command, args, { ...options, timeout: 300_000 });
};

/**
 * Regenerates migrations (and the Prisma client) for the selected schema.
 * Needed because the schema depends on the selection, e.g. Better Auth adds tables.
 * No database connection is required.
 */
export const regenerateDatabaseArtifacts = async (
  cwd: string,
  orm: Selection["orm"],
  run: Runner = quietRunner,
): Promise<void> => {
  if (orm === "none") return;
  const env = { ...process.env, DATABASE_URL: "postgresql://setup:setup@localhost:5432/setup" };

  if (orm === "drizzle") {
    await rm(path.join(cwd, "drizzle"), { recursive: true, force: true });
    await run("pnpm", ["exec", "drizzle-kit", "generate", "--name", "init"], { cwd, env });
    return;
  }

  const migrations = path.join(cwd, "prisma", "migrations");
  await rm(migrations, { recursive: true, force: true });
  await mkdir(path.join(migrations, "0_init"), { recursive: true });
  await run("pnpm", ["exec", "prisma", "generate"], { cwd, env });
  await run(
    "pnpm",
    [
      "exec",
      "prisma",
      "migrate",
      "diff",
      "--from-empty",
      "--to-schema",
      "prisma/schema",
      "--script",
      "-o",
      "prisma/migrations/0_init/migration.sql",
    ],
    { cwd, env },
  );
  await writeFile(path.join(migrations, "migration_lock.toml"), 'provider = "postgresql"\n');
};

/** Format and organize imports after directives removed code, so the new project starts lint-clean. */
export const formatProject = async (cwd: string, run: Runner = quietRunner): Promise<void> => {
  await run("pnpm", ["exec", "biome", "check", "--write", "."], { cwd, env: process.env });
};

/**
 * A database without auth has no example table (todos is user-owned), so create a public
 * `notes` module with the generator. Call after `regenerateDatabaseArtifacts`: the generator
 * then adds its migration on top of the clean initial state (no rename prompts).
 */
export const createExampleModule = async (
  cwd: string,
  selection: Pick<Selection, "auth" | "orm">,
  run: Runner = quietRunner,
): Promise<boolean> => {
  if (selection.orm === "none" || selection.auth !== "none") return false;
  await run("pnpm", ["exec", "tsx", "scripts/gen-module.ts", "note", "--fields", "title:string body:text?"], {
    cwd,
    env: process.env,
  });
  return true;
};
