import { randomUUID } from "node:crypto";
import type { TodoRepository } from "../../src/modules/todos/repository/types.ts";
import type { Todo } from "../../src/modules/todos/schema.ts";

/** In-memory TodoRepository. Passes the same contract tests as the ORM implementations. */
export const createMemoryTodoRepository = (): TodoRepository => {
  const rows = new Map<string, Todo & { userId: string }>();
  let clock = Date.now();
  // Strictly increasing timestamps keep ordering deterministic
  const now = () => new Date(++clock);

  const strip = ({ userId: _userId, ...todo }: Todo & { userId: string }): Todo => ({ ...todo });
  const owned = (userId: string, id: string) => {
    const row = rows.get(id);
    return row?.userId === userId ? row : undefined;
  };

  return {
    list: async (userId, filter) => {
      const matching = [...rows.values()]
        .filter((row) => row.userId === userId)
        .filter((row) => filter.completed === undefined || row.completed === filter.completed)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const start = (filter.page - 1) * filter.pageSize;
      return {
        items: matching.slice(start, start + filter.pageSize).map(strip),
        total: matching.length,
      };
    },
    findById: async (userId, id) => {
      const row = owned(userId, id);
      return row ? strip(row) : null;
    },
    create: async (userId, input) => {
      const timestamp = now();
      const row = { id: randomUUID(), userId, ...input, createdAt: timestamp, updatedAt: timestamp };
      rows.set(row.id, row);
      return strip(row);
    },
    update: async (userId, id, input) => {
      const row = owned(userId, id);
      if (!row) return null;
      if (input.title !== undefined) row.title = input.title;
      if (input.completed !== undefined) row.completed = input.completed;
      row.updatedAt = now();
      return strip(row);
    },
    delete: async (userId, id) => (owned(userId, id) ? rows.delete(id) : false),
  };
};
