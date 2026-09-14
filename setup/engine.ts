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

const DIRECTIVE = /^\s*(?:\/\/|#|<!--)\s*@setup-(select|if|template-only|endif)\b\s*(.*?)\s*(?:-->)?\s*$/;

/**
 * Apply `@setup-*` directives to one file's content.
 *
 * - `// @setup-select <feature>`: in the next line, the path segment naming an option of
 *   <feature> (e.g. `./providers/better-auth/index.ts`) is replaced with the selected option.
 * - `// @setup-if <feature>=<a>,<b>` ... `// @setup-endif`: the block is kept only when the
 *   selected option is one of the listed ones.
 *
 * - `// @setup-template-only` ... `// @setup-endif`: kept only while the setup tool is kept
 *   (instructions about choosing providers that make no sense after setup).
 *
 * Directives also work with `#` and `<!-- -->` comments. Directive lines are removed.
 */
export const processDirectives = (
  content: string,
  selection: Record<string, string>,
  file = "<input>",
  manifest: Features = features,
  options: { keepTemplateOnly: boolean } = { keepTemplateOnly: false },
): string => {
  const lines = content.split("\n");
  const output: string[] = [];
  let block: { keep: boolean; line: number } | null = null;
  let pendingSelect: { feature: string; line: number } | null = null;

  for (const [index, line] of lines.entries()) {
    const lineNumber = index + 1;
    const match = DIRECTIVE.exec(line);

    if (match) {
      const [, kind, args = ""] = match;
      if (pendingSelect) {
        throw new Error(`${file}:${pendingSelect.line}: @setup-select must be followed by a code line`);
      }
      if (kind === "select") {
        optionsOf(manifest, args);
        pendingSelect = { feature: args, line: lineNumber };
      } else if (kind === "template-only") {
        if (block) throw new Error(`${file}:${lineNumber}: nested @setup blocks are not supported`);
        block = { keep: options.keepTemplateOnly, line: lineNumber };
      } else if (kind === "if") {
        if (block) throw new Error(`${file}:${lineNumber}: nested @setup-if is not supported`);
        const [feature = "", values = ""] = args.split("=");
        const allowed = values.split(",").map((value) => value.trim());
        const options = optionsOf(manifest, feature);
        for (const value of allowed) {
          if (!(value in options)) throw new Error(`${file}:${lineNumber}: unknown ${feature} option "${value}"`);
        }
        const selected = selection[feature];
        block = { keep: selected !== undefined && allowed.includes(selected), line: lineNumber };
      } else {
        if (!block) throw new Error(`${file}:${lineNumber}: @setup-endif without @setup-if`);
        block = null;
      }
      continue;
    }

    if (block && !block.keep) {
      if (pendingSelect) pendingSelect = null;
      continue;
    }

    if (pendingSelect) {
      const { feature, line: directiveLine } = pendingSelect;
      pendingSelect = null;
      const ids = Object.keys(optionsOf(manifest, feature))
        .map((id) => id.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"))
        .sort((a, b) => b.length - a.length);
      const segment = new RegExp(`(?<=[/"'])(${ids.join("|")})(?=[/."'])`, "g");
      const found = line.match(segment) ?? [];
      if (found.length !== 1) {
        throw new Error(
          `${file}:${directiveLine}: expected exactly one ${feature} option in the next line, found ${found.length}`,
        );
      }
      const selected = selection[feature];
      if (!selected) throw new Error(`${file}:${directiveLine}: no selection for ${feature}`);
      output.push(line.replace(segment, selected));
      continue;
    }

    output.push(line);
  }

  if (block) throw new Error(`${file}:${block.line}: @setup-if without @setup-endif`);
  if (pendingSelect) throw new Error(`${file}: @setup-select at end of file`);
  return output.join("\n");
};

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
  options: { removeSetup: boolean },
  manifest: Features = features,
): PackageJson => {
  const selected = Object.entries(manifest).map(([feature, entry]) => entry.options[selection[feature] ?? ""]);
  const all = Object.values(manifest).flatMap((entry) => Object.values(entry.options));

  const keep = (key: "dependencies" | "devDependencies") =>
    new Set(selected.flatMap((option) => option?.[key] ?? []));
  const owned = (key: "dependencies" | "devDependencies") => new Set(all.flatMap((option) => option[key] ?? []));

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

  return {
    ...pkg,
    scripts: Object.fromEntries(Object.entries(scripts).sort(([a], [b]) => a.localeCompare(b))),
    dependencies: filterDeps("dependencies"),
    devDependencies: filterDeps("devDependencies", options.removeSetup ? SETUP_DEV_DEPENDENCIES : []),
  };
};

export const renderEnvExample = (selection: Record<string, string>, manifest: Features = features): string => {
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

const DIRECTIVE_FILE_GLOBS = ["**/*.{ts,mts,prisma,md,mdc,yml,yaml}", ".cursor/**/*.mdc"];
const IGNORE_GLOBS = ["**/node_modules/**", "**/dist/**", "src/generated/**", ".git/**"];

export interface ApplyOptions {
  removeSetup: boolean;
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
