import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { AppDatabase } from "../../../../db/drizzle/index.ts";
import { account, session, user, verification } from "../../../../db/drizzle/schema/auth.ts";

export const createAuthDatabase = (database: AppDatabase) =>
  drizzleAdapter(database.client, {
    provider: "pg",
    schema: { user, session, account, verification },
  });
