import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import { loadDatabaseEnv } from "../env.ts";
import type { Database } from "../types.ts";
import * as schema from "./schema/index.ts";

export type DrizzleClient = NodePgDatabase<typeof schema>;
export type AppDatabase = Database<DrizzleClient>;

export const createDatabase = (
  connectionString: string = loadDatabaseEnv().DATABASE_URL,
  poolOptions: pg.PoolConfig = { max: loadDatabaseEnv().DATABASE_POOL_MAX },
): AppDatabase => {
  const pool = new pg.Pool({ connectionString, ...poolOptions });
  const client = drizzle(pool, { schema });

  return {
    client,
    ping: async () => {
      await pool.query("select 1");
    },
    close: () => pool.end(),
  };
};
