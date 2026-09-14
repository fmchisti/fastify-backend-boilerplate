import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "../../config/env.ts";
import { PrismaClient } from "../../generated/prisma/client.ts";
import type { Database } from "../types.ts";

export type AppDatabase = Database<PrismaClient>;

export const createDatabase = (
  connectionString: string = env.DATABASE_URL,
): AppDatabase => {
  const client = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  return {
    client,
    ping: async () => {
      await client.$queryRaw`select 1`;
    },
    close: () => client.$disconnect(),
  };
};
