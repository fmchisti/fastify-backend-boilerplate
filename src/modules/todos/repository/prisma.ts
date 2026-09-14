import type { AppDatabase } from "../../../db/prisma/index.ts";
import type { Todo as TodoRow } from "../../../generated/prisma/client.ts";
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

export const createTodoRepository = ({ client: prisma }: AppDatabase): TodoRepository => ({
  list: async (userId, filter) => {
    const where = {
      userId,
      ...(filter.completed !== undefined && { completed: filter.completed }),
    };
    const [rows, total] = await prisma.$transaction([
      prisma.todo.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: filter.pageSize,
        skip: toOffset(filter),
      }),
      prisma.todo.count({ where }),
    ]);
    return { items: rows.map(toTodo), total };
  },

  findById: async (userId, id) => {
    const row = await prisma.todo.findFirst({ where: { id, userId } });
    return row ? toTodo(row) : null;
  },

  create: async (userId, input) => {
    const row = await prisma.todo.create({
      data: { userId, title: input.title, completed: input.completed },
    });
    return toTodo(row);
  },

  update: async (userId, id, input) => {
    // updateMany scopes by owner; a plain update() would only filter by id
    const { count } = await prisma.todo.updateMany({
      where: { id, userId },
      data: {
        ...(input.title !== undefined && { title: input.title }),
        ...(input.completed !== undefined && { completed: input.completed }),
      },
    });
    if (count === 0) return null;
    const row = await prisma.todo.findFirst({ where: { id, userId } });
    return row ? toTodo(row) : null;
  },

  delete: async (userId, id) => {
    const { count } = await prisma.todo.deleteMany({ where: { id, userId } });
    return count > 0;
  },
});
