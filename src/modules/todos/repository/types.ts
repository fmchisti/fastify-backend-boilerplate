import type { Page, PaginationQuery } from "../../../lib/pagination.ts";
import type { CreateTodoInput, Todo, UpdateTodoInput } from "../schema.ts";

export interface ListTodosFilter extends PaginationQuery {
  completed?: boolean | undefined;
}

/**
 * Data access for todos. One implementation per ORM (drizzle.ts, prisma.ts).
 * Every method is scoped to `userId`, so a user can never read or change another user's todos.
 */
export interface TodoRepository {
  list(userId: string, filter: ListTodosFilter): Promise<Page<Todo>>;
  findById(userId: string, id: string): Promise<Todo | null>;
  create(userId: string, input: CreateTodoInput): Promise<Todo>;
  /** Returns `null` when the todo does not exist for this user. */
  update(userId: string, id: string, input: UpdateTodoInput): Promise<Todo | null>;
  /** Returns `false` when the todo does not exist for this user. */
  delete(userId: string, id: string): Promise<boolean>;
}
