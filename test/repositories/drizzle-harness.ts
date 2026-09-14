import { readdir } from "node:fs/promises";
import path from "node:path";
import { type AppDatabase, createDatabase } from "../../src/db/drizzle/index.ts";
import { startTestPostgres, type TestPostgres } from "../postgres.ts";

/** In-process Postgres with every Drizzle migration applied. */
export const startDrizzleTestDatabase = async (): Promise<{
  database: AppDatabase;
  postgres: TestPostgres;
}> => {
  const dir = path.resolve("drizzle");
  const files = (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort();
  const postgres = await startTestPostgres(files.map((file) => path.join(dir, file)));
  return { database: createDatabase(postgres.url, { max: 1 }), postgres };
};
