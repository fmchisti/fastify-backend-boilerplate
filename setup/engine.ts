import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { glob } from "tinyglobby";
import {
  CORE_ENV,
  type EnvEntry,
  FEATURE_IDS,
  type FeatureId,
  type FeatureManifest,
  features,
  type OptionManifest,
  SETUP_DEV_DEPENDENCIES,
  SETUP_PATHS,
  SETUP_SCRIPTS,
  type Selection,
} from "./features.ts";

type Features = Record<string, FeatureManifest>;

const optionsOf = (manifest: Features, feature: string): Record<string, OptionManifest> => {
  const entry = manifest[feature];
  if (!entry) throw new Error(`Unknown feature "${feature}"`);
  return entry.options;
};

export const validateSelection = (selection: Record<string, string>, manifest: Features = features): void => {
  for (const [feature, entry] of Object.entries(manifest)) {
    const value = selection[feature];
    if (value === undefined || !(value in entry.options)) {
      const valid = Object.keys(entry.options).join(", ");
      throw new Error(`Invalid ${feature} "${value ?? ""}". Choose one of: ${valid}`);
    }
  }
};

// ---------------------------------------------------------------------------
// Directives
// ---------------------------------------------------------------------------

/** A whole line that is a block directive: `// @setup-if a=b`, `# @setup-endif`, `<!-- @setup-template-only -->`. */
const BLOCK_DIRECTIVE = /^\s*(?:\/\/|#|<!--)\s*@setup-(if|template-only|endif)\b\s*(.*?)\s*(?:-->)?\s*$/;
/** A directive trailing code on the same line: `import x from "./drizzle.ts"; // @setup-select orm`. */
const LINE_DIRECTIVE = /^(.*?\S)\s*\/\/\s*@setup-(select|if)\s+(\S+)\s*$/;
/** Line-level @setup-if may only remove complete one-line statements, never part of one. */
const SINGLE_LINE_STATEMENT = /^\s*(import|export)\b.*;\s*$/;

const escapeRegExp = (value: string) => value.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");

const parseCondition = (
  args: string,
  selection: Record<string, string>,
  manifest: Features,
  where: string,
): boolean => {
  const [feature = "", values = ""] = args.split("=");
  const allowed = values.split(",").map((value) => value.trim());
  const options = optionsOf(manifest, feature);
  for (const value of allowed) {
    if (!(value in options)) throw new Error(`${where}: unknown ${feature} option "${value}"`);
  }
  const selected = selection[feature];
  return selected !== undefined && allowed.includes(selected);
};

/**
 * Apply `@setup-*` directives to one file's content.
 *
 * Trailing (survive import sorting and formatting):
 * - `import { x } from "./providers/better-auth/index.ts"; // @setup-select auth`
 *   replaces the path segment naming an option of <feature> with the selected option.
 * - `import fileRoutes from "./modules/files/routes.ts"; // @setup-if storage=s3,local`
 *   keeps the line only for the listed options. Only for one-line import/export statements.
 *
 * Blocks (for code that tools do not reorder):
 * - `// @setup-if <feature>=<a>,<b>` ... `// @setup-endif`
 * - `// @setup-template-only` ... `// @setup-endif`: kept only while the setup tool is kept.
 *
 * Block directives also work with `#` and `<!-- -->` comments. All directives are removed.
 */
export const processDirectives = (
  content: string,
  selection: Record<string, string>,
  file = "<input>",
  manifest: Features = features,
  options: { keepTemplateOnly: boolean } = { keepTemplateOnly: false },
): string => {
  const output: string[] = [];
  let block: { keep: boolean; line: number } | null = null;

  for (const [index, line] of content.split("\n").entries()) {
    const where = `${file}:${index + 1}`;
    const blockMatch = BLOCK_DIRECTIVE.exec(line);

    if (blockMatch) {
      const [, kind, args = ""] = blockMatch;
      if (kind === "endif") {
        if (!block) throw new Error(`${where}: @setup-endif without @setup-if`);
        block = null;
        continue;
      }
      if (block) throw new Error(`${where}: nested @setup blocks are not supported`);
      block = {
        keep:
          kind === "template-only"
            ? options.keepTemplateOnly
            : parseCondition(args, selection, manifest, where),
        line: index + 1,
      };
      continue;
    }

    if (block && !block.keep) continue;

    const lineMatch = LINE_DIRECTIVE.exec(line);
    if (!lineMatch) {
      if (/@setup-(select|if)\b/.test(line)) throw new Error(`${where}: malformed @setup directive`);
      output.push(line);
      continue;
    }

    const [, code = "", kind, args = ""] = lineMatch;
    if (kind === "if") {
      if (!SINGLE_LINE_STATEMENT.test(code)) {
        throw new Error(`${where}: line-level @setup-if must be on a complete one-line import/export`);
      }
      if (parseCondition(args, selection, manifest, where)) output.push(code);
      continue;
    }

    const ids = Object.keys(optionsOf(manifest, args))
      .map(escapeRegExp)
      .sort((a, b) => b.length - a.length);
    const segment = new RegExp(`(?<=[/"'])(${ids.join("|")})(?=[/."'])`, "g");
    const found = code.match(segment) ?? [];
    if (found.length !== 1) {
      throw new Error(`${where}: expected exactly one ${args} option in the line, found ${found.length}`);
    }
    const selected = selection[args];
    if (!selected) throw new Error(`${where}: no selection for ${args}`);
    output.push(code.replace(segment, selected));
  }

  if (block) throw new Error(`${file}:${block.line}: @setup block without @setup-endif`);
  return output.join("\n");
};

// ---------------------------------------------------------------------------
// Project name
// ---------------------------------------------------------------------------

const NPM_NAME = /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;

/** Validates an npm package name (lowercase, URL-safe, ≤214 chars). */
export const validateProjectName = (name: string): void => {
  if (name.length === 0 || name.length > 214 || !NPM_NAME.test(name)) {
    throw new Error(
      `Invalid project name "${name}". Use lowercase letters, numbers, "-", "." or "_" (e.g. shop-api).`,
    );
  }
};

/** Turns a folder name like "My Shop API" into a valid package name ("my-shop-api"). */
export const toProjectName = (folder: string): string =>
  folder
    .toLowerCase()
    .replace(/[^a-z0-9-._~]+/g, "-")
    .replace(/^[-._~]+|[-._~]+$/g, "") || "my-api";

/** Replaces the first `# Heading` of a README with the project name. */
export const renameReadme = (readme: string, name: string): string => readme.replace(/^# .*$/m, `# ${name}`);

// ---------------------------------------------------------------------------
// Paths, package.json, env
// ---------------------------------------------------------------------------

/** Paths to delete for a selection. See OptionManifest.paths for the keep rules. */
export const pathsToRemove = (selection: Record<string, string>, manifest: Features = features): string[] => {
  // path -> feature -> set of options that own it
  const owners = new Map<string, Map<string, Set<string>>>();
  for (const [feature, entry] of Object.entries(manifest)) {
    for (const [option, config] of Object.entries(entry.options)) {
      for (const p of config.paths ?? []) {
        const byFeature = owners.get(p) ?? new Map<string, Set<string>>();
        const set = byFeature.get(feature) ?? new Set<string>();
        set.add(option);
        byFeature.set(feature, set);
        owners.set(p, byFeature);
      }
    }
  }

  return [...owners.entries()]
    .filter(([, byFeature]) =>
      [...byFeature.entries()].some(([feature, options]) => !options.has(selection[feature] ?? "")),
    )
    .map(([p]) => p)
    .sort();
};

interface PackageJson {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  [key: string]: unknown;
}

export const updatePackageJson = (
  pkg: PackageJson,
  selection: Record<string, string>,
  options: { removeSetup: boolean; projectName?: string | undefined },
  manifest: Features = features,
): PackageJson => {
  const selected = Object.entries(manifest).map(
    ([feature, entry]) => entry.options[selection[feature] ?? ""],
  );
  const all = Object.values(manifest).flatMap((entry) => Object.values(entry.options));

  const keep = (key: "dependencies" | "devDependencies") =>
    new Set(selected.flatMap((option) => option?.[key] ?? []));
  const owned = (key: "dependencies" | "devDependencies") =>
    new Set(all.flatMap((option) => option[key] ?? []));

  const filterDeps = (key: "dependencies" | "devDependencies", extraRemove: string[] = []) => {
    const deps = { ...(pkg[key] ?? {}) };
    const kept = keep(key);
    for (const name of [...owned(key), ...extraRemove]) {
      if (!kept.has(name)) delete deps[name];
    }
    return deps;
  };

  const scripts = { ...(pkg.scripts ?? {}) };
  for (const option of all) {
    for (const name of Object.keys(option.scripts ?? {})) delete scripts[name];
  }
  for (const option of selected) Object.assign(scripts, option?.scripts ?? {});
  if (options.removeSetup) for (const name of SETUP_SCRIPTS) delete scripts[name];

  // A generated project is its own package, not a copy of the template's metadata
  const { repository: _repository, homepage: _homepage, bugs: _bugs, keywords: _keywords, ...rest } = pkg;
  const identity = options.projectName
    ? { ...rest, name: options.projectName, version: "0.1.0", description: "" }
    : pkg;

  return {
    ...identity,
    scripts: Object.fromEntries(Object.entries(scripts).sort(([a], [b]) => a.localeCompare(b))),
    dependencies: filterDeps("dependencies"),
    devDependencies: filterDeps("devDependencies", options.removeSetup ? SETUP_DEV_DEPENDENCIES : []),
  };
};

export const renderEnvExample = (
  selection: Record<string, string>,
  manifest: Features = features,
): string => {
  const section = (title: string, entries: EnvEntry[]) =>
    [
      `# ${title}`,
      ...entries.flatMap((entry) => [
        ...(entry.comment ? [`# ${entry.comment}`] : []),
        `${entry.key}=${entry.example}`,
      ]),
    ].join("\n");

  const sections = [section("Core", CORE_ENV)];
  for (const [feature, entry] of Object.entries(manifest)) {
    const option = entry.options[selection[feature] ?? ""];
    if (option?.env?.length) sections.push(section(`${entry.label}: ${option.label}`, option.env));
  }
  return `${sections.join("\n\n")}\n`;
};

// ---------------------------------------------------------------------------
// Apply to a directory
// ---------------------------------------------------------------------------

const DIRECTIVE_FILE_GLOBS = ["**/*.{ts,mts,prisma,md,mdc,yml,yaml}", "**/Dockerfile", ".cursor/**/*.mdc"];
const IGNORE_GLOBS = ["**/node_modules/**", "**/dist/**", "src/generated/**", ".git/**"];

export interface ApplyOptions {
  removeSetup: boolean;
  /** npm package name for the new project; also used as the README title. */
  projectName?: string | undefined;
}

export interface ApplyResult {
  removed: string[];
  updatedFiles: string[];
}

export const applySelection = async (
  rootDir: string,
  selection: Selection,
  options: ApplyOptions,
): Promise<ApplyResult> => {
  validateSelection(selection);
  if (options.projectName !== undefined) validateProjectName(options.projectName);
  const root = path.resolve(rootDir);

  // 1. Delete paths owned by unselected options (and the setup tool itself)
  const removed = [...pathsToRemove(selection), ...(options.removeSetup ? SETUP_PATHS : [])];
  for (const relative of removed) {
    await rm(path.join(root, relative), { recursive: true, force: true });
  }

  // 2. Resolve directives in the remaining files
  const files = await glob(DIRECTIVE_FILE_GLOBS, { cwd: root, ignore: IGNORE_GLOBS, dot: true });
  const updatedFiles: string[] = [];
  for (const relative of files) {
    // Directive fixtures inside the setup tool must not be rewritten while it is kept
    if (relative.startsWith("setup/") || relative.startsWith("test/setup/")) continue;
    const filePath = path.join(root, relative);
    const original = await readFile(filePath, "utf8");
    if (!original.includes("@setup-")) continue;
    const next = processDirectives(original, selection, relative, features, {
      keepTemplateOnly: !options.removeSetup,
    });
    if (next !== original) {
      await writeFile(filePath, next);
      updatedFiles.push(relative);
    }
  }

  // 3. package.json and .env.example
  const pkgPath = path.join(root, "package.json");
  const pkg = JSON.parse(await readFile(pkgPath, "utf8")) as PackageJson;
  await writeFile(pkgPath, `${JSON.stringify(updatePackageJson(pkg, selection, options), null, 2)}\n`);
  await writeFile(path.join(root, ".env.example"), renderEnvExample(selection));

  if (options.projectName) {
    const readmePath = path.join(root, "README.md");
    await writeFile(readmePath, renameReadme(await readFile(readmePath, "utf8"), options.projectName));
  }

  return { removed, updatedFiles };
};

export const describeSelection = (selection: Selection): string[] =>
  FEATURE_IDS.map((feature: FeatureId) => {
    const options: Record<string, OptionManifest> = features[feature].options;
    return `${features[feature].label}: ${options[selection[feature]]?.label ?? selection[feature]}`;
  });

export const nextStepsFor = (selection: Selection): string[] =>
  FEATURE_IDS.flatMap((feature: FeatureId) => {
    const options: Record<string, OptionManifest> = features[feature].options;
    return options[selection[feature]]?.nextSteps ?? [];
  });
