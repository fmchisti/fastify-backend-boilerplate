import { HttpError } from "../../lib/errors.ts";
import type { Page } from "../../lib/pagination.ts";
import type { ListTodosFilter, TodoRepository } from "./repository/index.ts";
import type { CreateTodoInput, Todo, UpdateTodoInput } from "./schema.ts";

const notFound = (): HttpError => new HttpError(404, "Todo not found");

export interface TodoService {
  list(userId: string, filter: ListTodosFilter): Promise<Page<Todo>>;
  get(userId: string, id: string): Promise<Todo>;
  create(userId: string, input: CreateTodoInput): Promise<Todo>;
  update(userId: string, id: string, input: UpdateTodoInput): Promise<Todo>;
  delete(userId: string, id: string): Promise<void>;
}

/** Business rules live here; the repository only does data access. */
export const createTodoService = (repository: TodoRepository): TodoService => ({
  list: (userId, filter) => repository.list(userId, filter),

  get: async (userId, id) => {
    const todo = await repository.findById(userId, id);
    if (!todo) throw notFound();
    return todo;
  },

  create: (userId, input) => repository.create(userId, input),

  update: async (userId, id, input) => {
    const todo = await repository.update(userId, id, input);
    if (!todo) throw notFound();
    return todo;
  },

  delete: async (userId, id) => {
    const deleted = await repository.delete(userId, id);
    if (!deleted) throw notFound();
  },
});
