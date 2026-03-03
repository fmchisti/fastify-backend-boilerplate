import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../db/schema";
import { env } from "./env";
import { logger } from "./logger";

// Disable prefetch as it is not supported for "Transaction" pool mode
const client = postgres(env.DATABASE_URL, { prepare: false });

export const db = drizzle(client, { schema });

logger.info("Database connection initialized");
