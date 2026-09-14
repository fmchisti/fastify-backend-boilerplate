import type { Field, FieldType, ModuleNames } from "./model.ts";

export interface TemplateContext {
  names: ModuleNames;
  fields: Field[];
}

// ---------------------------------------------------------------------------
// Per-type building blocks
// ---------------------------------------------------------------------------

const RESPONSE_ZOD: Record<FieldType, string> = {
  string: "z.string()",
  text: "z.string()",
  int: "z.number().int()",
  float: "z.number()",
  boolean: "z.boolean()",
  datetime: "z.date()",
};

const INPUT_ZOD: Record<FieldType, string> = {
  string: "z.string().trim().min(1).max(255)",
  text: "z.string().max(10_000)",
  int: "z.number().int()",
  float: "z.number()",
  boolean: "z.boolean()",
  // Accept ISO strings in JSON, store and return Date
  datetime: "z.iso.datetime({ offset: true }).transform((value) => new Date(value))",
};

const DRIZZLE_BUILDER: Record<FieldType, { fn: string; call: (column: string) => string }> = {
  string: { fn: "varchar", call: (c) => `varchar("${c}", { length: 255 })` },
  text: { fn: "text", call: (c) => `text("${c}")` },
  int: { fn: "integer", call: (c) => `integer("${c}")` },
  float: { fn: "doublePrecision", call: (c) => `doublePrecision("${c}")` },
  boolean: { fn: "boolean", call: (c) => `boolean("${c}")` },
  datetime: { fn: "timestamp", call: (c) => `timestamp("${c}", { withTimezone: true })` },
};

const PRISMA_TYPE: Record<FieldType, { type: string; attributes: string }> = {
  string: { type: "String", attributes: "@db.VarChar(255)" },
  text: { type: "String", attributes: "" },
  int: { type: "Int", attributes: "" },
  float: { type: "Float", attributes: "" },
  boolean: { type: "Boolean", attributes: "" },
  datetime: { type: "DateTime", attributes: "@db.Timestamptz(6)" },
};

/** JSON sample values used by generated tests. */
const SAMPLE: Record<FieldType, { create: string; update: string }> = {
  string: { create: '"Sample"', update: '"Updated"' },
  text: { create: '"Sample text"', update: '"Updated text"' },
  int: { create: "42", update: "7" },
  float: { create: "9.5", update: "1.25" },
  boolean: { create: "true", update: "false" },
  datetime: { create: '"2026-01-01T00:00:00.000Z"', update: '"2026-02-01T00:00:00.000Z"' },
};

const lines = (items: string[], indent: string) => items.map((item) => `${indent}${item}`).join("\n");

// ---------------------------------------------------------------------------
// src/modules/<plural>/
// ---------------------------------------------------------------------------

export const schemaTemplate = ({ names, fields }: TemplateContext) => {
  const { pascal } = names.singular;
  const response = fields.map((f) => `${f.name}: ${RESPONSE_ZOD[f.type]}${f.optional ? ".nullable()" : ""},`);
  const create = fields.map(
    (f) => `${f.name}: ${INPUT_ZOD[f.type]}${f.optional ? ".nullable().default(null)" : ""},`,
  );
  const update = fields.map(
    (f) => `${f.name}: ${INPUT_ZOD[f.type]}${f.optional ? ".nullable()" : ""}.optional(),`,
  );

  return `import { z } from "zod";
import { ErrorResponseSchema } from "../../lib/errors.ts";
import { PaginationQuerySchema, paginatedSchema } from "../../lib/pagination.ts";

export const ${pascal}Schema = z.object({
  id: z.uuid(),
${lines(response, "  ")}
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type ${pascal} = z.infer<typeof ${pascal}Schema>;

export const Create${pascal}BodySchema = z.object({
${lines(create, "  ")}
});

export type Create${pascal}Input = z.infer<typeof Create${pascal}BodySchema>;

export const Update${pascal}BodySchema = z
  .object({
${lines(update, "    ")}
  })
  .refine((body) => Object.values(body).some((value) => value !== undefined), {
    message: "Provide at least one field to update",
  });

export type Update${pascal}Input = z.infer<typeof Update${pascal}BodySchema>;

export const ${pascal}ParamsSchema = z.object({ id: z.uuid() });

const authErrors = { 401: ErrorResponseSchema };

export const List${names.plural.pascal}Schema = {
  querystring: PaginationQuerySchema,
  response: { 200: paginatedSchema(${pascal}Schema), 400: ErrorResponseSchema, ...authErrors },
};

export const Get${pascal}Schema = {
  params: ${pascal}ParamsSchema,
  response: { 200: ${pascal}Schema, 404: ErrorResponseSchema, ...authErrors },
};

export const Create${pascal}Schema = {
  body: Create${pascal}BodySchema,
  response: { 201: ${pascal}Schema, 400: ErrorResponseSchema, ...authErrors },
};

export const Update${pascal}Schema = {
  params: ${pascal}ParamsSchema,
  body: Update${pascal}BodySchema,
  response: { 200: ${pascal}Schema, 400: ErrorResponseSchema, 404: ErrorResponseSchema, ...authErrors },
};

export const Delete${pascal}Schema = {
  params: ${pascal}ParamsSchema,
  response: { 204: z.null(), 404: ErrorResponseSchema, ...authErrors },
};
`;
};

export const docsTemplate = ({ names }: TemplateContext) => {
  const { singular, plural } = names;
  return `/**
 * OpenAPI / Swagger documentation for ${plural.words} endpoints.
 */

const base = { tags: ["${plural.pascal}"], security: [{ bearerAuth: [] }] };

export const list${plural.pascal}Docs = { ...base, summary: "List ${plural.words}", description: "Paginated, newest first." };
export const get${singular.pascal}Docs = { ...base, summary: "Get a ${singular.words}" };
export const create${singular.pascal}Docs = { ...base, summary: "Create a ${singular.words}" };
export const update${singular.pascal}Docs = { ...base, summary: "Update a ${singular.words}", description: "Partial update." };
export const delete${singular.pascal}Docs = { ...base, summary: "Delete a ${singular.words}" };
`;
};

export const repositoryTypesTemplate = ({ names }: TemplateContext) => {
  const { pascal } = names.singular;
  return `import type { CrudRepository } from "../../../lib/crud.ts";
import type { Create${pascal}Input, ${pascal}, Update${pascal}Input } from "../schema.ts";

/** Data access for ${names.plural.words}. Add query methods here as the module grows. */
export type ${pascal}Repository = CrudRepository<${pascal}, Create${pascal}Input, Update${pascal}Input>;
`;
};

export const repositoryIndexTemplate = ({ names }: TemplateContext, orm: "drizzle" | "prisma") => {
  const { pascal } = names.singular;
  return `export { create${pascal}Repository } from "./${orm}.ts";
export type { ${pascal}Repository } from "./types.ts";
`;
};

const toEntity = ({ names, fields }: TemplateContext, rowType: string) => {
  const { pascal } = names.singular;
  return `const to${pascal} = (row: ${rowType}): ${pascal} => ({
  id: row.id,
${lines(
  fields.map((f) => `${f.name}: row.${f.name},`),
  "  ",
)}
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});`;
};

export const repositoryDrizzleTemplate = (context: TemplateContext) => {
  const { singular, plural } = context.names;
  const table = plural.camel;
  return `import { and, count, desc, eq } from "drizzle-orm";
import type { AppDatabase } from "../../../db/drizzle/index.ts";
import { type ${singular.pascal}Row, ${table} } from "../../../db/drizzle/schema/${plural.kebab}.ts";
import { withoutUndefined } from "../../../lib/crud.ts";
import { toOffset } from "../../../lib/pagination.ts";
import type { ${singular.pascal} } from "../schema.ts";
import type { ${singular.pascal}Repository } from "./types.ts";

${toEntity(context, `${singular.pascal}Row`)}

const byOwner = (userId: string, id: string) => and(eq(${table}.userId, userId), eq(${table}.id, id));

export const create${singular.pascal}Repository = ({ client: db }: AppDatabase): ${singular.pascal}Repository => ({
  list: async (userId, query) => {
    const where = eq(${table}.userId, userId);
    const [rows, [totalRow]] = await Promise.all([
      db
        .select()
        .from(${table})
        .where(where)
        .orderBy(desc(${table}.createdAt), desc(${table}.id))
        .limit(query.pageSize)
        .offset(toOffset(query)),
      db.select({ total: count() }).from(${table}).where(where),
    ]);
    return { items: rows.map(to${singular.pascal}), total: totalRow?.total ?? 0 };
  },

  findById: async (userId, id) => {
    const [row] = await db.select().from(${table}).where(byOwner(userId, id)).limit(1);
    return row ? to${singular.pascal}(row) : null;
  },

  create: async (userId, input) => {
    const [row] = await db
      .insert(${table})
      .values({ ...input, userId })
      .returning();
    if (!row) throw new Error("Insert did not return a row");
    return to${singular.pascal}(row);
  },

  update: async (userId, id, input) => {
    const [row] = await db
      .update(${table})
      .set({ ...withoutUndefined(input), updatedAt: new Date() })
      .where(byOwner(userId, id))
      .returning();
    return row ? to${singular.pascal}(row) : null;
  },

  delete: async (userId, id) => {
    const deleted = await db.delete(${table}).where(byOwner(userId, id)).returning({ id: ${table}.id });
    return deleted.length > 0;
  },
});
`;
};

export const repositoryPrismaTemplate = (context: TemplateContext) => {
  const { singular } = context.names;
  const model = singular.camel;
  return `import type { AppDatabase } from "../../../db/prisma/index.ts";
import type { ${singular.pascal} as ${singular.pascal}Row } from "../../../generated/prisma/client.ts";
import { withoutUndefined } from "../../../lib/crud.ts";
import { toOffset } from "../../../lib/pagination.ts";
import type { ${singular.pascal} } from "../schema.ts";
import type { ${singular.pascal}Repository } from "./types.ts";

${toEntity(context, `${singular.pascal}Row`)}

export const create${singular.pascal}Repository = ({ client: prisma }: AppDatabase): ${singular.pascal}Repository => ({
  list: async (userId, query) => {
    const [rows, total] = await prisma.$transaction([
      prisma.${model}.findMany({
        where: { userId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: query.pageSize,
        skip: toOffset(query),
      }),
      prisma.${model}.count({ where: { userId } }),
    ]);
    return { items: rows.map(to${singular.pascal}), total };
  },

  findById: async (userId, id) => {
    const row = await prisma.${model}.findFirst({ where: { id, userId } });
    return row ? to${singular.pascal}(row) : null;
  },

  create: async (userId, input) => {
    const row = await prisma.${model}.create({ data: { ...input, userId } });
    return to${singular.pascal}(row);
  },

  update: async (userId, id, input) => {
    // updateMany scopes by owner; update() would only filter by id
    const { count } = await prisma.${model}.updateMany({ where: { id, userId }, data: withoutUndefined(input) });
    if (count === 0) return null;
    const row = await prisma.${model}.findFirst({ where: { id, userId } });
    return row ? to${singular.pascal}(row) : null;
  },

  delete: async (userId, id) => {
    const { count } = await prisma.${model}.deleteMany({ where: { id, userId } });
    return count > 0;
  },
});
`;
};

export const serviceTemplate = ({ names }: TemplateContext) => {
  const { pascal, words } = names.singular;
  const capitalized = words.charAt(0).toUpperCase() + words.slice(1);
  return `import { HttpError } from "../../lib/errors.ts";
import type { Page, PaginationQuery } from "../../lib/pagination.ts";
import type { ${pascal}Repository } from "./repository/index.ts";
import type { Create${pascal}Input, ${pascal}, Update${pascal}Input } from "./schema.ts";

const notFound = (): HttpError => new HttpError(404, "${capitalized} not found");

export interface ${pascal}Service {
  list(userId: string, query: PaginationQuery): Promise<Page<${pascal}>>;
  get(userId: string, id: string): Promise<${pascal}>;
  create(userId: string, input: Create${pascal}Input): Promise<${pascal}>;
  update(userId: string, id: string, input: Update${pascal}Input): Promise<${pascal}>;
  delete(userId: string, id: string): Promise<void>;
}

/** Business rules live here; the repository only does data access. */
export const create${pascal}Service = (repository: ${pascal}Repository): ${pascal}Service => ({
  list: (userId, query) => repository.list(userId, query),

  get: async (userId, id) => {
    const item = await repository.findById(userId, id);
    if (!item) throw notFound();
    return item;
  },

  create: (userId, input) => repository.create(userId, input),

  update: async (userId, id, input) => {
    const item = await repository.update(userId, id, input);
    if (!item) throw notFound();
    return item;
  },

  delete: async (userId, id) => {
    if (!(await repository.delete(userId, id))) throw notFound();
  },
});
`;
};

export const handlerTemplate = ({ names }: TemplateContext) => {
  const { singular, plural } = names;
  const S = singular.pascal;
  return `import { getAuthUser } from "../../auth/middleware.ts";
import { toPaginatedResponse } from "../../lib/pagination.ts";
import type { ZodRouteHandler } from "../../types/fastify.ts";
import type {
  Create${S}Schema,
  Delete${S}Schema,
  Get${S}Schema,
  List${plural.pascal}Schema,
  Update${S}Schema,
} from "./schema.ts";
import type { ${S}Service } from "./service.ts";

export const create${S}Handlers = (service: ${S}Service) => {
  const list: ZodRouteHandler<typeof List${plural.pascal}Schema> = async (request) => {
    const page = await service.list(getAuthUser(request).id, request.query);
    return toPaginatedResponse(page, request.query);
  };

  const get: ZodRouteHandler<typeof Get${S}Schema> = async (request) =>
    service.get(getAuthUser(request).id, request.params.id);

  const create: ZodRouteHandler<typeof Create${S}Schema> = async (request, reply) => {
    const item = await service.create(getAuthUser(request).id, request.body);
    return reply.status(201).send(item);
  };

  const update: ZodRouteHandler<typeof Update${S}Schema> = async (request) =>
    service.update(getAuthUser(request).id, request.params.id, request.body);

  const remove: ZodRouteHandler<typeof Delete${S}Schema> = async (request, reply) => {
    await service.delete(getAuthUser(request).id, request.params.id);
    return reply.status(204).send(null);
  };

  return { list, get, create, update, remove };
};
`;
};

export const routesTemplate = ({ names }: TemplateContext) => {
  const { singular, plural } = names;
  const S = singular.pascal;
  return `import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { authenticate } from "../../auth/middleware.ts";
import * as docs from "./docs.ts";
import { create${S}Handlers } from "./handler.ts";
import type { ${S}Repository } from "./repository/index.ts";
import {
  Create${S}Schema,
  Delete${S}Schema,
  Get${S}Schema,
  List${plural.pascal}Schema,
  Update${S}Schema,
} from "./schema.ts";
import { create${S}Service } from "./service.ts";

export interface ${S}RoutesOptions {
  repository: ${S}Repository;
}

const ${singular.camel}Routes: FastifyPluginAsyncZod<${S}RoutesOptions> = async (fastify, options) => {
  const handlers = create${S}Handlers(create${S}Service(options.repository));

  fastify.addHook("onRequest", authenticate);

  fastify.route({
    method: "GET",
    url: "/${plural.kebab}",
    schema: { ...List${plural.pascal}Schema, ...docs.list${plural.pascal}Docs },
    handler: handlers.list,
  });
  fastify.route({
    method: "POST",
    url: "/${plural.kebab}",
    schema: { ...Create${S}Schema, ...docs.create${S}Docs },
    handler: handlers.create,
  });
  fastify.route({
    method: "GET",
    url: "/${plural.kebab}/:id",
    schema: { ...Get${S}Schema, ...docs.get${S}Docs },
    handler: handlers.get,
  });
  fastify.route({
    method: "PATCH",
    url: "/${plural.kebab}/:id",
    schema: { ...Update${S}Schema, ...docs.update${S}Docs },
    handler: handlers.update,
  });
  fastify.route({
    method: "DELETE",
    url: "/${plural.kebab}/:id",
    schema: { ...Delete${S}Schema, ...docs.delete${S}Docs },
    handler: handlers.remove,
  });
};

export default ${singular.camel}Routes;
`;
};

// ---------------------------------------------------------------------------
// Database schema
// ---------------------------------------------------------------------------

export const drizzleTableTemplate = ({ names, fields }: TemplateContext) => {
  const { singular, plural } = names;
  const builders = new Set(["index", "pgTable", "text", "timestamp", "uuid"]);
  for (const field of fields) builders.add(DRIZZLE_BUILDER[field.type].fn);
  const columns = fields.map(
    (f) => `${f.name}: ${DRIZZLE_BUILDER[f.type].call(f.column)}${f.optional ? "" : ".notNull()"},`,
  );

  return `import { sql } from "drizzle-orm";
import { ${[...builders].sort().join(", ")} } from "drizzle-orm/pg-core";

export const ${plural.camel} = pgTable(
  "${plural.snake}",
  {
    id: uuid("id").primaryKey().default(sql\`gen_random_uuid()\`),
    // Auth provider user id. No foreign key, so any auth provider works.
    userId: text("user_id").notNull(),
${lines(columns, "    ")}
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("${plural.snake}_user_id_created_at_idx").on(table.userId, table.createdAt)],
);

export type ${singular.pascal}Row = typeof ${plural.camel}.$inferSelect;
`;
};

export const prismaModelTemplate = ({ names, fields }: TemplateContext) => {
  const { singular, plural } = names;
  const field = (name: string, type: string, attributes: string) =>
    `  ${name} ${type}${attributes ? ` ${attributes}` : ""}`;
  const columns = fields.map((f) => {
    const { type, attributes } = PRISMA_TYPE[f.type];
    const map = f.column === f.name ? "" : `@map("${f.column}")`;
    return field(f.name, `${type}${f.optional ? "?" : ""}`, [map, attributes].filter(Boolean).join(" "));
  });

  return `model ${singular.pascal} {
  id String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  // Auth provider user id. No foreign key, so any auth provider works.
  userId String @map("user_id")
${columns.join("\n")}
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt DateTime @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)

  @@index([userId, createdAt], map: "${plural.snake}_user_id_created_at_idx")
  @@map("${plural.snake}")
}
`;
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

export const fakeTemplate = ({ names, fields }: TemplateContext) => {
  const { singular } = names;
  const S = singular.pascal;
  const create = fields.map((f) => `${f.name}: ${SAMPLE[f.type].create},`);
  const update = fields.map((f) => `${f.name}: ${SAMPLE[f.type].update},`);
  const merge = fields.map(
    (f) => `${f.name}: input.${f.name} === undefined ? row.${f.name} : input.${f.name},`,
  );

  return `import { randomUUID } from "node:crypto";
import type { ${S}Repository } from "../../src/modules/${names.plural.kebab}/repository/types.ts";
import type { ${S} } from "../../src/modules/${names.plural.kebab}/schema.ts";

/** Valid JSON bodies for POST and PATCH. */
export const ${singular.camel}Sample = {
${lines(create, "  ")}
};

export const ${singular.camel}UpdateSample = {
${lines(update, "  ")}
};

/** In-memory ${S}Repository. Passes the same contract tests as the ORM implementation. */
export const createMemory${S}Repository = (): ${S}Repository => {
  const rows = new Map<string, ${S} & { userId: string }>();
  let clock = Date.now();
  const now = () => new Date(++clock);
  const owned = (userId: string, id: string) => {
    const row = rows.get(id);
    return row?.userId === userId ? row : undefined;
  };
  const strip = ({ userId: _userId, ...item }: ${S} & { userId: string }): ${S} => item;

  return {
    list: async (userId, query) => {
      const matching = [...rows.values()]
        .filter((row) => row.userId === userId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const start = (query.page - 1) * query.pageSize;
      return { items: matching.slice(start, start + query.pageSize).map(strip), total: matching.length };
    },
    findById: async (userId, id) => {
      const row = owned(userId, id);
      return row ? strip(row) : null;
    },
    create: async (userId, input) => {
      const timestamp = now();
      const row = { ...input, id: randomUUID(), userId, createdAt: timestamp, updatedAt: timestamp };
      rows.set(row.id, row);
      return strip(row);
    },
    update: async (userId, id, input) => {
      const row = owned(userId, id);
      if (!row) return null;
      const next = {
        ...row,
${lines(merge, "        ")}
        updatedAt: now(),
      };
      rows.set(id, next);
      return strip(next);
    },
    delete: async (userId, id) => (owned(userId, id) ? rows.delete(id) : false),
  };
};
`;
};

export const routeTestTemplate = ({ names, fields }: TemplateContext) => {
  const { singular, plural } = names;
  const firstField = fields[0];
  const invalidPayload = firstField
    ? `{ ...${singular.camel}Sample, ${firstField.name}: ${firstField.type === "string" || firstField.type === "text" ? "123" : '"not-valid"'} }`
    : "{}";

  return `import { describe, expect, it } from "vitest";
import { bearer } from "./fakes/auth.ts";
import { ${singular.camel}Sample, ${singular.camel}UpdateSample } from "./fakes/${plural.kebab}.ts";
import { useTestApp } from "./helpers.ts";

const alice = bearer("alice-token");
const bob = bearer("bob-token");
const url = "/api/${plural.kebab}";

describe("${plural.words} routes", () => {
  const app = useTestApp();

  const create = async () => {
    const response = await app().inject({ method: "POST", url, headers: alice, payload: ${singular.camel}Sample });
    expect(response.statusCode).toBe(201);
    return response.json<{ id: string }>();
  };

  it("requires authentication", async () => {
    const response = await app().inject({ method: "GET", url });

    expect(response.statusCode).toBe(401);
  });

  it("creates, reads, lists, updates, and deletes", async () => {
    const created = await create();
    expect(created).toMatchObject(${singular.camel}Sample);

    const fetched = await app().inject({ method: "GET", url: \`\${url}/\${created.id}\`, headers: alice });
    expect(fetched.json()).toMatchObject({ id: created.id, ...${singular.camel}Sample });

    const list = await app().inject({ method: "GET", url, headers: alice });
    expect(list.json<{ items: { id: string }[] }>().items.map((item) => item.id)).toContain(created.id);

    const updated = await app().inject({
      method: "PATCH",
      url: \`\${url}/\${created.id}\`,
      headers: alice,
      payload: ${singular.camel}UpdateSample,
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject(${singular.camel}UpdateSample);

    const deleted = await app().inject({ method: "DELETE", url: \`\${url}/\${created.id}\`, headers: alice });
    expect(deleted.statusCode).toBe(204);

    const missing = await app().inject({ method: "GET", url: \`\${url}/\${created.id}\`, headers: alice });
    expect(missing.statusCode).toBe(404);
  });

  it("hides other users' records", async () => {
    const created = await create();

    const response = await app().inject({ method: "GET", url: \`\${url}/\${created.id}\`, headers: bob });

    expect(response.statusCode).toBe(404);
  });

  it("validates input", async () => {
    const invalid = await app().inject({ method: "POST", url, headers: alice, payload: ${invalidPayload} });
    expect(invalid.statusCode).toBe(400);

    const created = await create();
    const empty = await app().inject({ method: "PATCH", url: \`\${url}/\${created.id}\`, headers: alice, payload: {} });
    expect(empty.statusCode).toBe(400);
  });
});
`;
};

export const contractTestTemplate = (
  { names }: TemplateContext,
  variant: "memory" | "drizzle" | "prisma",
) => {
  const { singular, plural } = names;
  const S = singular.pascal;
  const imports = `import {
  Create${S}BodySchema,
  Update${S}BodySchema,
} from "../../src/modules/${plural.kebab}/schema.ts";
import { ${singular.camel}Sample, ${singular.camel}UpdateSample${variant === "memory" ? `, createMemory${S}Repository` : ""} } from "../fakes/${plural.kebab}.ts";
import { describeCrudRepositoryContract } from "./crud-contract.ts";`;
  const samples = `{
  create: Create${S}BodySchema.parse(${singular.camel}Sample),
  update: Update${S}BodySchema.parse(${singular.camel}UpdateSample),
}`;

  if (variant === "memory") {
    return `${imports}

describeCrudRepositoryContract(
  "${plural.words} (memory fake)",
  async () => {
    let repository = createMemory${S}Repository();
    return {
      get repository() {
        return repository;
      },
      reset: async () => {
        repository = createMemory${S}Repository();
      },
      close: async () => undefined,
    };
  },
  ${samples},
);
`;
  }

  const harness = variant === "drizzle" ? "startDrizzleTestDatabase" : "startPrismaTestDatabase";
  return `import { create${S}Repository } from "../../src/modules/${plural.kebab}/repository/${variant}.ts";
${imports}
import { ${harness} } from "./${variant}-harness.ts";

describeCrudRepositoryContract(
  "${plural.words} (${variant})",
  async () => {
    const { database, postgres } = await ${harness}();
    return {
      repository: create${S}Repository(database),
      reset: () => postgres.truncate(["${plural.snake}"]),
      close: async () => {
        await database.close();
        await postgres.stop();
      },
    };
  },
  ${samples},
);
`;
};
