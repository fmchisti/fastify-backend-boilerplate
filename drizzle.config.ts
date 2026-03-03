/// <reference types="node" />
import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is required");
}

export default defineConfig({
  out: "./drizzle",
  schema: "./src/db/schema.ts",
  dialect: "postgresql",
  migrations: {
    table: "__drizzle_migrations",
    schema: "./drizzle",
  },
  dbCredentials: {
    url: databaseUrl,
  },
});
