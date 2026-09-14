import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// Keep in sync with prisma/schema/todos.prisma
export const todos = pgTable(
  "todos",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    // Auth provider user id. No foreign key, so any auth provider works.
    userId: text("user_id").notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    completed: boolean("completed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("todos_user_id_created_at_idx").on(table.userId, table.createdAt)],
);

export type TodoRow = typeof todos.$inferSelect;
export type NewTodoRow = typeof todos.$inferInsert;
