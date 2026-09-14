// The ORM is chosen by `pnpm setup:project`. Only this line (and the matching
// repository/adapter lines) change when switching between Drizzle and Prisma.
export { type AppDatabase, createDatabase } from "./drizzle/index.ts"; // @setup-select orm
export type { Database } from "./types.ts";
