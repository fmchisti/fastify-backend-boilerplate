import { and, count, desc, eq, type SQL } from "drizzle-orm";
import type { AppDatabase } from "../../../db/drizzle/index.ts";
import { type TodoRow, todos } from "../../../db/drizzle/schema/todos.ts";
import { toOffset } from "../../../lib/pagination.ts";
import type { Todo } from "../schema.ts";
import type { TodoRepository } from "./types.ts";

const toTodo = (row: TodoRow): Todo => ({
  id: row.id,
  title: row.title,
  completed: row.completed,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const byOwner = (userId: string, id: string): SQL | undefined =>
  and(eq(todos.userId, userId), eq(todos.id, id));

export const createTodoRepository = ({ client: db }: AppDatabase): TodoRepository => ({
  list: async (userId, filter) => {
    const where = and(
      eq(todos.userId, userId),
      filter.completed === undefined ? undefined : eq(todos.completed, filter.completed),
    );
    const [rows, [totalRow]] = await Promise.all([
      db
        .select()
        .from(todos)
        .where(where)
        .orderBy(desc(todos.createdAt), desc(todos.id))
        .limit(filter.pageSize)
        .offset(toOffset(filter)),
      db.select({ total: count() }).from(todos).where(where),
    ]);
    return { items: rows.map(toTodo), total: totalRow?.total ?? 0 };
  },

  findById: async (userId, id) => {
    const [row] = await db.select().from(todos).where(byOwner(userId, id)).limit(1);
    return row ? toTodo(row) : null;
  },

  create: async (userId, input) => {
    const [row] = await db
      .insert(todos)
      .values({ userId, title: input.title, completed: input.completed })
      .returning();
    if (!row) throw new Error("Insert did not return a row");
    return toTodo(row);
  },

  update: async (userId, id, input) => {
    const [row] = await db
      .update(todos)
      .set({
        ...(input.title !== undefined && { title: input.title }),
        ...(input.completed !== undefined && { completed: input.completed }),
        updatedAt: new Date(),
      })
      .where(byOwner(userId, id))
      .returning();
    return row ? toTodo(row) : null;
  },

  delete: async (userId, id) => {
    const deleted = await db
      .delete(todos)
      .where(byOwner(userId, id))
      .returning({ id: todos.id });
    return deleted.length > 0;
  },
});
