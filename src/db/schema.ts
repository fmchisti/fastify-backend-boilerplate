import { pgTable, serial, timestamp, varchar } from "drizzle-orm/pg-core";

/**
 * Example table – remove or replace with your own tables.
 * Run: pnpm db:generate && pnpm db:push (or db:migrate)
 */
export const example = pgTable("example", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Example = typeof example.$inferSelect;
export type NewExample = typeof example.$inferInsert;
