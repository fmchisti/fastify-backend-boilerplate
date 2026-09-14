#!/usr/bin/env node
import { existsSync } from "node:fs";
import { readdir, rm } from "node:fs/promises";
import path from "node:path";
import * as p from "@clack/prompts";
import {
  allowedOptions,
  type Choices,
  parseSetupFlags,
  projectNameError,
  readChoices,
  toProjectName,
  toSetupArgs,
} from "./choices.ts";
import {
  assertEmptyTarget,
  commandExists,
  fetchTemplate,
  HELP,
  parseCliArgs,
  run,
  toSafeDirectoryName,
} from "./cli.ts";

const fail = (message: string): never => {
  p.cancel(message);
  process.exit(1);
};

/** Removes what this run created, so a cancelled run leaves nothing behind. */
const cleanUp = async (target: string, existedBefore: boolean) => {
  if (!existedBefore) {
    await rm(target, { recursive: true, force: true });
    return;
  }
  for (const entry of await readdir(target)) {
    await rm(path.join(target, entry), { recursive: true, force: true });
  }
};

/** Asks every question the template's setup would ask, before anything is installed. */
const askAnswers = async (
  choices: Choices,
  preset: Record<string, string>,
  useDefaults: boolean,
): Promise<Record<string, string> | null> => {
  const answers: Record<string, string> = {};
  for (const feature of choices.features) {
    const allowed = allowedOptions(choices, answers, feature.id);
    const given = preset[feature.id];
    if (given !== undefined) {
      if (!allowed.includes(given)) {
        const valid = allowed.join(", ");
        throw new Error(
          `--${feature.id} ${given} does not work with your other choices. Choose one of: ${valid}`,
        );
      }
      answers[feature.id] = given;
      continue;
    }
    const fallback = allowed.includes(feature.default) ? feature.default : (allowed[0] ?? feature.default);
    if (useDefaults || allowed.length === 1) {
      answers[feature.id] = fallback;
      continue;
    }
    const answer = await p.select({
      message: feature.label,
      initialValue: fallback,
      options: allowed.map((value) => {
        const option = feature.options.find((entry) => entry.value === value);
        return { value, label: option?.label ?? value, ...(option?.hint && { hint: option.hint }) };
      }),
    });
    if (p.isCancel(answer)) return null;
    answers[feature.id] = answer;
  }
  return answers;
};

const main = async () => {
  const options = parseCliArgs(process.argv.slice(2));
  if (options.help) {
    console.log(HELP);
    return;
  }

  p.intro("Fastra");
  const interactive = process.stdin.isTTY === true;

  let directory = options.directory;
  if (directory === undefined) {
    if (!interactive) fail("Pass a directory: pnpm create fastra <directory>");
    const answer = await p.text({
      message: "Project directory",
      placeholder: "my-api",
      defaultValue: "my-api",
    });
    if (p.isCancel(answer)) fail("Cancelled. Nothing was created.");
    directory = typeof answer === "string" && answer.length > 0 ? answer : "my-api";
  }

  const cwd = process.cwd();
  const target = path.resolve(cwd, toSafeDirectoryName(directory));
  const relative = path.relative(cwd, target) || ".";
  await assertEmptyTarget(target);
  const existedBefore = existsSync(target);

  if (!commandExists("pnpm")) {
    fail("Fastra uses pnpm. Install it with `corepack enable` (Node.js 22+) and run this again.");
  }

  const abort = async (message: string): Promise<never> => {
    await cleanUp(target, existedBefore);
    return fail(message);
  };

  // 1. Download only (a few seconds): the questions come from the template itself
  const spinner = p.spinner();
  spinner.start(`Downloading ${options.template}`);
  try {
    await fetchTemplate(options.template, target, cwd);
  } catch (error) {
    spinner.stop("Download failed");
    await abort(error instanceof Error ? error.message : String(error));
  }
  spinner.stop("Template downloaded");

  // 2. Ask everything before installing
  let setupArgs = options.setupArgs;
  const choices = await readChoices(target);
  if (choices) {
    const flags = parseSetupFlags(
      options.setupArgs,
      choices.features.map((feature) => feature.id),
    );
    const useDefaults = flags.yes || !interactive;

    let name = flags.name ?? toProjectName(path.basename(target));
    if (flags.name === undefined && !useDefaults) {
      const defaultName = name;
      const answer = await p.text({
        message: "Project name",
        placeholder: defaultName,
        defaultValue: defaultName,
        validate: (value) => projectNameError(value || defaultName),
      });
      if (p.isCancel(answer)) await abort("Cancelled. Nothing was created.");
      name = typeof answer === "string" && answer.length > 0 ? answer : defaultName;
    }
    const nameError = projectNameError(name);
    if (nameError) await abort(`Invalid project name "${name}". ${nameError}`);

    let answers: Record<string, string> | null = null;
    try {
      answers = await askAnswers(choices, flags.answers, useDefaults);
    } catch (error) {
      await abort(error instanceof Error ? error.message : String(error));
    }
    if (!answers) return abort("Cancelled. Nothing was created.");

    const summary = [
      `Name: ${name}`,
      ...choices.features.map((feature) => {
        const option = feature.options.find((entry) => entry.value === answers[feature.id]);
        return `${feature.label}: ${option?.label ?? answers[feature.id]}`;
      }),
    ];
    if (!useDefaults) {
      p.note(summary.join("\n"), "Your project");
      const confirmed = await p.confirm({ message: "Create it? Everything you did not choose is left out." });
      if (p.isCancel(confirmed) || !confirmed) await abort("Cancelled. Nothing was created.");
    }
    setupArgs = toSetupArgs(name, answers, flags.rest);
  }

  // 3. Install and build the project from the answers
  p.log.step("Installing dependencies");
  if ((await run("pnpm", ["install"], target)) !== 0) {
    fail(
      `pnpm install failed. Fix the error, then run: cd ${relative} && pnpm install && pnpm setup:project`,
    );
  }

  p.log.step("Creating your project");
  const setupCode = await run("pnpm", ["setup:project", ...setupArgs], target);
  // Setup deletes itself when it finishes; if it is still there, it was cancelled or failed
  if (setupCode !== 0 || existsSync(path.join(target, "setup"))) {
    fail(`Setup did not finish. Run it again with: cd ${relative} && pnpm setup:project`);
  }

  if (options.git && commandExists("git")) {
    await run("git", ["init", "--quiet"], target);
    await run("git", ["add", "--all"], target);
    const committed = await run(
      "git",
      ["commit", "--quiet", "-m", "chore: initial project from Fastra"],
      target,
    );
    if (committed !== 0) {
      p.log.warn("Created a git repository, but the initial commit failed (is git user.name/email set?).");
    }
  }

  p.outro(`Done. Next: cd ${relative}, then follow the steps above.`);
};

main().catch((error: unknown) => {
  fail(error instanceof Error ? error.message : String(error));
});
