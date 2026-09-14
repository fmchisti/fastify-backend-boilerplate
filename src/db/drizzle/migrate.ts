import { fileURLToPath, pathToFileURL } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { logger } from "../../config/logger.ts";
import { loadDatabaseEnv } from "../env.ts";
import { type AppDatabase, createDatabase } from "./index.ts";

// Same folder/table/schema as drizzle.config.ts. src/db/drizzle and dist/db/drizzle are both 3 levels deep.
export const MIGRATIONS_FOLDER = fileURLToPath(new URL("../../../drizzle", import.meta.url));

/** Apply pending migrations. Safe to run repeatedly. */
export const runMigrations = async (database: AppDatabase): Promise<void> => {
  await migrate(database.client, {
    migrationsFolder: MIGRATIONS_FOLDER,
    migrationsTable: "__drizzle_migrations",
    migrationsSchema: "drizzle",
  });
};

/**
 * Production entry point: `pnpm db:migrate:deploy` (node dist/db/drizzle/migrate.js).
 * Uses only runtime dependencies, so it works in the slim Docker image and Railway's pre-deploy step.
 */
const isEntryPoint = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntryPoint) {
  const database = createDatabase(loadDatabaseEnv().DATABASE_URL, { max: 1 });
  runMigrations(database)
    .then(() => logger.info("Migrations applied"))
    .catch((err: unknown) => {
      logger.fatal({ err }, "Migration failed");
      process.exitCode = 1;
    })
    .finally(() => database.close());
}
