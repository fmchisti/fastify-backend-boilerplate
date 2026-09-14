import { describe, expect, it } from "vitest";
import { parseFields, parseModuleName, pluralize } from "../../scripts/gen/model.ts";
import { addImport, detectOrm, generateModule, insertBeforeMarker } from "../../scripts/gen-module.ts";

describe("parseModuleName", () => {
  it("derives every naming form", () => {
    expect(parseModuleName("blog-post")).toEqual({
      singular: {
        camel: "blogPost",
        pascal: "BlogPost",
        kebab: "blog-post",
        snake: "blog_post",
        words: "blog post",
      },
      plural: {
        camel: "blogPosts",
        pascal: "BlogPosts",
        kebab: "blog-posts",
        snake: "blog_posts",
        words: "blog posts",
      },
    });
    expect(parseModuleName("InvoiceLine").plural.snake).toBe("invoice_lines");
  });

  it("accepts an explicit plural for irregular words", () => {
    expect(parseModuleName("person", "people").plural.kebab).toBe("people");
  });

  it.each([
    ["1product", /Invalid module name/],
    ["user", /reserved/],
    ["todo", /reserved/],
  ])("rejects %s", (name, error) => {
    expect(() => parseModuleName(name)).toThrow(error);
  });

  it("rejects a plural equal to the singular", () => {
    expect(() => parseModuleName("sheep", "sheep")).toThrow(/--plural/);
  });
});

describe("pluralize", () => {
  it.each([
    ["product", "products"],
    ["category", "categories"],
    ["day", "days"],
    ["box", "boxes"],
    ["address", "addresses"],
    ["match", "matches"],
  ])("%s → %s", (word, plural) => {
    expect(pluralize(word)).toBe(plural);
  });
});

describe("parseFields", () => {
  it("parses types, optional markers, and snake_case columns", () => {
    expect(parseFields("title:string releasedAt:datetime? price:float")).toEqual([
      { name: "title", column: "title", type: "string", optional: false },
      { name: "releasedAt", column: "released_at", type: "datetime", optional: true },
      { name: "price", column: "price", type: "float", optional: false },
    ]);
  });

  it.each([
    ["", /at least one field/],
    ["title", /Invalid field/],
    ["Title:string", /Invalid field/],
    ["title:uuid", /Invalid type/],
    ["id:string", /added automatically/],
    ["userId:string", /added automatically/],
    ["a:int a:int", /Duplicate/],
  ])("rejects %j", (input, error) => {
    expect(() => parseFields(input)).toThrow(error);
  });
});

describe("source editing", () => {
  it("inserts before a marker with the marker's indentation", () => {
    const content = "return {\n    todos: x,\n    // @gen:factories\n};";

    expect(insertBeforeMarker(content, "@gen:factories", "products: y,", "f.ts")).toBe(
      "return {\n    todos: x,\n    products: y,\n    // @gen:factories\n};",
    );
    expect(() => insertBeforeMarker(content, "@gen:missing", "x", "f.ts")).toThrow(/marker/);
  });

  it("adds an import after the last import, including multi-line ones", () => {
    const content = 'import a from "a";\nimport {\n  b,\n} from "b";\n\nconst x = 1;';

    expect(addImport(content, 'import c from "c";')).toBe(
      'import a from "a";\nimport {\n  b,\n} from "b";\nimport c from "c";\n\nconst x = 1;',
    );
  });
});

describe("generateModule", () => {
  it("detects the ORM of this project", async () => {
    expect(["drizzle", "prisma"]).toContain(await detectOrm(process.cwd()));
  });

  it("plans the full module in a dry run without writing", async () => {
    const files = await generateModule({
      root: process.cwd(),
      name: "widget",
      fields: "name:string",
      dryRun: true,
    });
    const orm = await detectOrm(process.cwd());

    expect(files).toEqual(
      expect.arrayContaining([
        "src/modules/widgets/routes.ts",
        `src/modules/widgets/repository/${orm}.ts`,
        "test/widgets.test.ts",
        `test/repositories/widgets.${orm}.test.ts`,
      ]),
    );
  });

  it("refuses to overwrite an existing module", async () => {
    await expect(
      generateModule({
        root: process.cwd(),
        name: "todo-item",
        plural: "todos",
        fields: "name:string",
        dryRun: true,
      }),
    ).rejects.toThrow(/Refusing to overwrite/);
  });
});
