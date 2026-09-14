import { prismaAdapter } from "better-auth/adapters/prisma";
import type { AppDatabase } from "../../../../db/prisma/index.ts";

export const createAuthDatabase = (database: AppDatabase) =>
  prismaAdapter(database.client, { provider: "postgresql" });
