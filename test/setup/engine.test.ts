import { describe, expect, it } from "vitest";
import {
  pathsToRemove,
  processDirectives,
  renderEnvExample,
  updatePackageJson,
  validateSelection,
} from "../../setup/engine.ts";
import { type FeatureManifest, features } from "../../setup/features.ts";

const manifest: Record<string, FeatureManifest> = {
  auth: {
    label: "Auth",
    default: "a",
    options: {
      a: { label: "A", paths: ["src/auth/a", "shared/auth-a-orm-x.ts"], dependencies: ["dep-a", "shared-dep"], env: [{ key: "A_KEY", example: "1" }] },
      "b-two": { label: "B", paths: ["src/auth/b-two"], dependencies: ["dep-b", "shared-dep"], scripts: { "auth:b": "b" } },
    },
  },
  orm: {
    label: "ORM",
    default: "x",
    options: {
      x: { label: "X", paths: ["src/db/x", "shared/auth-a-orm-x.ts", "src/files"], devDependencies: ["x-kit"], scripts: { "db:generate": "x generate" } },
      y: { label: "Y", paths: ["src/db/y", "src/files"], scripts: { "db:generate": "y generate", postinstall: "y" } },
    },
  },
};

describe("processDirectives", () => {
  const selection = { auth: "b-two", orm: "y" };
  const run = (content: string) => processDirectives(content, selection, "file.ts", manifest);

  it("rewrites the option segment on the line after @setup-select", () => {
    const input = [
      "// @setup-select auth",
      'export { create } from "./providers/a/index.ts";',
      "// @setup-select orm",
      'import { repo } from "./repository/x.ts";',
    ].join("\n");

    expect(run(input)).toBe(
      ['export { create } from "./providers/b-two/index.ts";', 'import { repo } from "./repository/y.ts";'].join("\n"),
    );
  });

  it("keeps or drops @setup-if blocks and removes directive lines", () => {
    const input = [
      "start",
      "  // @setup-if auth=a",
      "  only-a",
      "  // @setup-endif",
      "  # @setup-if orm=x,y",
      "  x-or-y",
      "  # @setup-endif",
      "<!-- @setup-if auth=b-two -->",
      "only-b",
      "<!-- @setup-endif -->",
      "end",
    ].join("\n");

    expect(run(input)).toBe(["start", "  x-or-y", "only-b", "end"].join("\n"));
  });

  it("keeps @setup-template-only blocks only while the setup tool is kept", () => {
    const input = ["a", "<!-- @setup-template-only -->", "choose providers", "<!-- @setup-endif -->", "b"].join("\n");

    expect(processDirectives(input, selection, "f", manifest, { keepTemplateOnly: false })).toBe("a\nb");
    expect(processDirectives(input, selection, "f", manifest, { keepTemplateOnly: true })).toBe("a\nchoose providers\nb");
  });

  it("drops a @setup-select inside a removed block", () => {
    const input = ["// @setup-if auth=a", "// @setup-select orm", 'import "./x.ts";', "// @setup-endif", "kept"].join("\n");

    expect(run(input)).toBe("kept");
  });

  it("does not match option ids inside longer words", () => {
    const input = ["// @setup-select orm", 'import { x } from "./xylophone/x.ts";'].join("\n");

    expect(run(input)).toBe('import { x } from "./xylophone/y.ts";');
  });

  it.each([
    ["unknown feature", "// @setup-select nope\nline"],
    ["no option in next line", "// @setup-select auth\nimport './other.ts';"],
    ["two options in next line", "// @setup-select orm\nimport './x/y.ts';"],
    ["unknown option", "// @setup-if auth=zzz\n// @setup-endif"],
    ["unclosed block", "// @setup-if auth=a\nline"],
    ["endif without if", "// @setup-endif"],
    ["nested if", "// @setup-if auth=a\n// @setup-if orm=x\n// @setup-endif\n// @setup-endif"],
    ["select at end", "// @setup-select auth"],
  ])("throws on %s", (_label, input) => {
    expect(() => run(input)).toThrow();
  });
});

describe("pathsToRemove", () => {
  it("removes unselected option paths but keeps paths shared within a feature", () => {
    expect(pathsToRemove({ auth: "a", orm: "y" }, manifest)).toEqual(["shared/auth-a-orm-x.ts", "src/auth/b-two", "src/db/x"]);
  });

  it("keeps a path owned by several features only when every feature keeps it", () => {
    expect(pathsToRemove({ auth: "a", orm: "x" }, manifest)).not.toContain("shared/auth-a-orm-x.ts");
    expect(pathsToRemove({ auth: "b-two", orm: "x" }, manifest)).toContain("shared/auth-a-orm-x.ts");
  });
});

describe("updatePackageJson", () => {
  const pkg = {
    name: "app",
    scripts: { dev: "tsx", "db:generate": "x generate", "auth:b": "b", "setup:project": "tsx setup/cli.ts" },
    dependencies: { fastify: "5", "dep-a": "1", "dep-b": "1", "shared-dep": "1" },
    devDependencies: { "x-kit": "1", vitest: "5", "@clack/prompts": "1" },
  };

  it("removes dependencies and scripts of unselected options, keeps shared and core ones", () => {
    const result = updatePackageJson(pkg, { auth: "a", orm: "y" }, { removeSetup: true }, manifest);

    expect(result.dependencies).toEqual({ fastify: "5", "dep-a": "1", "shared-dep": "1" });
    expect(result.devDependencies).toEqual({ vitest: "5" });
    expect(result.scripts).toEqual({ dev: "tsx", "db:generate": "y generate", postinstall: "y" });
    expect(result["name"]).toBe("app");
  });

  it("keeps setup scripts and dependencies with --keep-setup", () => {
    const result = updatePackageJson(pkg, { auth: "b-two", orm: "x" }, { removeSetup: false }, manifest);

    expect(result.scripts).toMatchObject({ "setup:project": "tsx setup/cli.ts", "auth:b": "b", "db:generate": "x generate" });
    expect(result.devDependencies).toHaveProperty("@clack/prompts");
  });
});

describe("renderEnvExample", () => {
  it("includes core env and only the selected options' env", () => {
    const env = renderEnvExample({ auth: "a", orm: "x" }, manifest);

    expect(env).toContain("DATABASE_URL=");
    expect(env).toContain("# Auth: A\nA_KEY=1");
  });
});

describe("real features manifest", () => {
  it("has a valid default selection", () => {
    const defaults = Object.fromEntries(Object.entries(features).map(([id, feature]) => [id, feature.default]));
    expect(() => validateSelection(defaults)).not.toThrow();
  });

  it("only references dependencies that exist in package.json", async () => {
    const pkg = (await import("../../package.json", { with: { type: "json" } })).default as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    for (const feature of Object.values(features) as FeatureManifest[]) {
      for (const [id, option] of Object.entries(feature.options)) {
        for (const dep of option.dependencies ?? []) expect(pkg.dependencies, `${id}: ${dep}`).toHaveProperty([dep]);
        for (const dep of option.devDependencies ?? []) expect(pkg.devDependencies, `${id}: ${dep}`).toHaveProperty([dep]);
      }
    }
  });

  it("only references paths that exist", async () => {
    const { existsSync } = await import("node:fs");
    for (const feature of Object.values(features) as FeatureManifest[]) {
      for (const [id, option] of Object.entries(feature.options)) {
        for (const p of option.paths ?? []) {
          // Generated at install time
          if (p === "src/generated") continue;
          expect(existsSync(p), `${id}: ${p}`).toBe(true);
        }
      }
    }
  });
});
