#!/usr/bin/env node
import { existsSync } from "node:fs";
import path from "node:path";
import * as p from "@clack/prompts";
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

const main = async () => {
  const options = parseCliArgs(process.argv.slice(2));
  if (options.help) {
    console.log(HELP);
    return;
  }

  p.intro("Fastra");

  let directory = options.directory;
  if (directory === undefined) {
    if (!process.stdin.isTTY) fail("Pass a directory: pnpm create fastra <directory>");
    const answer = await p.text({
      message: "Project directory",
      placeholder: "my-api",
      defaultValue: "my-api",
    });
    if (p.isCancel(answer)) fail("Cancelled.");
    directory = typeof answer === "string" && answer.length > 0 ? answer : "my-api";
  }

  const cwd = process.cwd();
  const target = path.resolve(cwd, toSafeDirectoryName(directory));
  const relative = path.relative(cwd, target) || ".";
  await assertEmptyTarget(target);

  if (!commandExists("pnpm")) {
    fail("Fastra uses pnpm. Install it with `corepack enable` (Node.js 22+) and run this again.");
  }

  const spinner = p.spinner();
  spinner.start(`Downloading ${options.template}`);
  try {
    await fetchTemplate(options.template, target, cwd);
  } catch (error) {
    spinner.stop("Download failed");
    fail(error instanceof Error ? error.message : String(error));
  }
  spinner.stop(`Template copied to ${relative}`);

  p.log.step("Installing dependencies");
  if ((await run("pnpm", ["install"], target)) !== 0) {
    fail(
      `pnpm install failed. Fix the error, then run: cd ${relative} && pnpm install && pnpm setup:project`,
    );
  }

  p.log.step("Configuring the project");
  const setupCode = await run("pnpm", ["setup:project", ...options.setupArgs], target);
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
