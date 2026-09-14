// The ORM is chosen by `pnpm setup`. Only this line (and the matching
// repository/adapter lines) change when switching between Drizzle and Prisma.
// @setup-select orm
export { type AppDatabase, createDatabase } from "./drizzle/index.ts";
export type { Database } from "./types.ts";
