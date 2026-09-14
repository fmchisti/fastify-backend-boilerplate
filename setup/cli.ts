import { execFileSync } from "node:child_process";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import * as p from "@clack/prompts";
import { regenerateDatabaseArtifacts, type Runner } from "./database.ts";
import { applySelection, describeSelection, nextStepsFor, validateSelection } from "./engine.ts";
import { FEATURE_IDS, type FeatureId, features, type OptionManifest, type Selection } from "./features.ts";

const HELP = `
Configure this boilerplate for a new project. Deletes code, dependencies and env
vars for everything you do not select.

Usage:
  pnpm setup:project                           interactive
  pnpm setup:project --auth logto --orm prisma --storage s3 --deploy railway --yes

Options:
${FEATURE_IDS.map((id) => `  --${id.padEnd(10)} ${Object.keys(features[id].options).join(" | ")}  (default: ${features[id].default})`).join("\n")}
  --yes          use defaults for anything not passed, skip confirmation
  --dir          project directory (default: current directory)
  --skip-install do not run pnpm install (migrations are still regenerated)
  --keep-setup   keep the setup tool (for re-running on a copy)
  --force        run even if git has uncommitted changes
  --help
`;

const run = (command: string, args: string[], cwd: string) => {
  execFileSync(command, args, { cwd, stdio: "inherit" });
};

const inheritRunner: Runner = async (command, args, options) => {
  execFileSync(command, args, { ...options, stdio: "inherit" });
};

const isGitDirty = (cwd: string): boolean => {
  try {
    return execFileSync("git", ["status", "--porcelain"], { cwd, encoding: "utf8" }).trim().length > 0;
  } catch {
    return false; // not a git repo
  }
};

const main = async () => {
  const { values } = parseArgs({
    options: {
      auth: { type: "string" },
      orm: { type: "string" },
      storage: { type: "string" },
      deploy: { type: "string" },
      yes: { type: "boolean", default: false },
      dir: { type: "string", default: process.cwd() },
      "skip-install": { type: "boolean", default: false },
      "keep-setup": { type: "boolean", default: false },
      force: { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
  });
  // Fails to compile if a feature in features.ts has no matching flag above
  const featureFlags: { [K in FeatureId]: string | undefined } = { auth: values.auth, orm: values.orm, storage: values.storage, deploy: values.deploy };

  if (values.help) {
    console.log(HELP);
    return;
  }

  const cwd = path.resolve(String(values.dir));
  p.intro("Fastify boilerplate setup");

  if (!values.force && isGitDirty(cwd)) {
    p.cancel("Git has uncommitted changes. Commit or stash them first (setup deletes files), or pass --force.");
    process.exit(1);
  }

  const selection: Record<string, string> = {};
  for (const feature of FEATURE_IDS) {
    const manifest = features[feature];
    const passed = featureFlags[feature];
    if (typeof passed === "string") {
      selection[feature] = passed;
      continue;
    }
    if (values.yes) {
      selection[feature] = manifest.default;
      continue;
    }
    const options: Record<string, OptionManifest> = manifest.options;
    const answer = await p.select({
      message: manifest.label,
      initialValue: manifest.default,
      options: Object.entries(options).map(([value, option]) => ({
        value,
        label: option.label,
        ...(option.hint && { hint: option.hint }),
      })),
    });
    if (p.isCancel(answer)) {
      p.cancel("Setup cancelled. Nothing was changed.");
      process.exit(0);
    }
    selection[feature] = answer;
  }

  validateSelection(selection);
  const chosen = selection as Selection;
  p.note(describeSelection(chosen).join("\n"), "Selection");

  if (!values.yes) {
    const confirmed = await p.confirm({ message: "Apply? Unselected providers will be deleted." });
    if (p.isCancel(confirmed) || !confirmed) {
      p.cancel("Setup cancelled. Nothing was changed.");
      process.exit(0);
    }
  }

  const spinner = p.spinner();
  spinner.start("Removing unselected providers");
  const result = await applySelection(cwd, chosen, { removeSetup: !values["keep-setup"] });
  spinner.stop(`Removed ${result.removed.length} paths, updated ${result.updatedFiles.length} files`);

  if (!values["skip-install"]) {
    p.log.step("Installing dependencies");
    // Setup edits package.json on purpose; CI environments default to a frozen lockfile
    run("pnpm", ["install", "--no-frozen-lockfile"], cwd);
  }
  // Always regenerate: the initial migration must match the selected schema
  p.log.step("Generating database migrations");
  await regenerateDatabaseArtifacts(cwd, chosen.orm, inheritRunner);
  p.log.step("Type-checking");
  run("pnpm", ["type-check"], cwd);

  const envExists = (await readdir(cwd)).includes(".env");
  const steps = [
    ...(envExists ? [] : ["cp .env.example .env   # then fill in the values"]),
    "pnpm db:up             # local Postgres in Docker (or point DATABASE_URL elsewhere)",
    "pnpm db:migrate",
    "pnpm dev               # http://localhost:3000/api/docs",
    ...nextStepsFor(chosen),
  ];
  p.note(steps.join("\n"), "Next steps");
  p.outro("Done. Commit the result to start your project.");
};

main().catch((error: unknown) => {
  p.cancel(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
