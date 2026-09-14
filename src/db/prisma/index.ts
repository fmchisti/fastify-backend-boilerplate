import { PrismaPg } from "@prisma/adapter-pg";
import type pg from "pg";
import { PrismaClient } from "../../generated/prisma/client.ts";
import { loadDatabaseEnv } from "../env.ts";
import type { Database } from "../types.ts";

export type AppDatabase = Database<PrismaClient>;

export const createDatabase = (
  connectionString: string = loadDatabaseEnv().DATABASE_URL,
  poolOptions: pg.PoolConfig = { max: loadDatabaseEnv().DATABASE_POOL_MAX },
): AppDatabase => {
  const client = new PrismaClient({
    adapter: new PrismaPg({ connectionString, ...poolOptions }),
  });

  return {
    client,
    ping: async () => {
      await client.$queryRaw`select 1`;
    },
    close: () => client.$disconnect(),
  };
};
