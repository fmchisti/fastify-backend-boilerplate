import { readdir } from "node:fs/promises";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type AppDatabase, createDatabase } from "../../src/db/drizzle/index.ts";
import { MIGRATIONS_FOLDER, runMigrations } from "../../src/db/drizzle/migrate.ts";
import { startTestPostgres, type TestPostgres } from "../postgres.ts";

describe("Drizzle production migrator", () => {
  let postgres: TestPostgres;
  let database: AppDatabase;

  beforeAll(async () => {
    postgres = await startTestPostgres([]);
    database = createDatabase(postgres.url, { max: 1 });
  });

  afterAll(async () => {
    await database.close();
    await postgres.stop();
  });

  it("creates the schema and is idempotent", async () => {
    await runMigrations(database);
    await runMigrations(database);

    const tables = await database.client.execute<{ table_name: string }>(
      sql`select table_name from information_schema.tables where table_schema = 'public'`,
    );
    expect(tables.rows.map((row) => row.table_name)).toContain("todos");

    const applied = await database.client.execute(sql`select id from drizzle.__drizzle_migrations`);
    const files = (await readdir(MIGRATIONS_FOLDER)).filter((file) => file.endsWith(".sql"));
    expect(applied.rows).toHaveLength(files.length);
  });
});
