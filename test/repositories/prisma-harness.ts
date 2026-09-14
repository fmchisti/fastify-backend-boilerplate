import { readdir } from "node:fs/promises";
import path from "node:path";
import { type AppDatabase, createDatabase } from "../../src/db/prisma/index.ts";
import { startTestPostgres, type TestPostgres } from "../postgres.ts";

/** In-process Postgres with every Prisma migration applied, in order. */
export const startPrismaTestDatabase = async (): Promise<{
  database: AppDatabase;
  postgres: TestPostgres;
}> => {
  const dir = path.resolve("prisma/migrations");
  const migrations = (await readdir(dir, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(dir, entry.name, "migration.sql"))
    .sort();
  const postgres = await startTestPostgres(migrations);
  return { database: createDatabase(postgres.url, { max: 1 }), postgres };
};
