import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { TodoRepository } from "../../src/modules/todos/repository/types.ts";

export interface RepositoryHarness {
  repository: TodoRepository;
  reset(): Promise<void>;
  close(): Promise<void>;
}

// Rows created in the same millisecond tie on created_at (then order by id), so space them out
const tick = () => new Promise((resolve) => setTimeout(resolve, 3));

const MISSING_ID = "00000000-0000-4000-8000-000000000000";
const page = (overrides: { page?: number; pageSize?: number; completed?: boolean } = {}) => ({
  page: 1,
  pageSize: 20,
  ...overrides,
});

/**
 * Behaviour every TodoRepository must have, regardless of ORM.
 * Run it for each implementation so Drizzle and Prisma stay interchangeable.
 */
export const describeTodoRepositoryContract = (
  name: string,
  createHarness: () => Promise<RepositoryHarness>,
) => {
  describe(`TodoRepository contract: ${name}`, () => {
    let harness: RepositoryHarness;
    const repo = () => harness.repository;

    beforeAll(async () => {
      harness = await createHarness();
    });
    beforeEach(() => harness.reset());
    afterAll(() => harness.close());

    it("creates a todo with generated id and timestamps", async () => {
      const todo = await repo().create("alice", { title: "First", completed: false });

      expect(todo.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(todo).toMatchObject({ title: "First", completed: false });
      expect(todo.createdAt).toBeInstanceOf(Date);
      expect(todo.updatedAt).toBeInstanceOf(Date);
      expect(Object.keys(todo).sort()).toEqual(["completed", "createdAt", "id", "title", "updatedAt"]);
    });

    it("finds by id only for the owner", async () => {
      const todo = await repo().create("alice", { title: "Mine", completed: false });

      expect(await repo().findById("alice", todo.id)).toEqual(todo);
      expect(await repo().findById("bob", todo.id)).toBeNull();
      expect(await repo().findById("alice", MISSING_ID)).toBeNull();
    });

    it("lists newest first with pagination, totals, and a completed filter", async () => {
      for (const [index, completed] of [false, true, false, true, false].entries()) {
        await repo().create("alice", { title: `Todo ${index}`, completed });
        await tick();
      }
      await repo().create("bob", { title: "Not Alice's", completed: false });

      const first = await repo().list("alice", page({ pageSize: 2 }));
      expect(first.total).toBe(5);
      expect(first.items.map((todo) => todo.title)).toEqual(["Todo 4", "Todo 3"]);

      const last = await repo().list("alice", page({ page: 3, pageSize: 2 }));
      expect(last.items.map((todo) => todo.title)).toEqual(["Todo 0"]);

      const done = await repo().list("alice", page({ completed: true }));
      expect(done.total).toBe(2);
      expect(done.items.every((todo) => todo.completed)).toBe(true);

      const empty = await repo().list("carol", page());
      expect(empty).toEqual({ items: [], total: 0 });
    });

    it("updates only provided fields, only for the owner", async () => {
      const todo = await repo().create("alice", { title: "Original", completed: false });

      expect(await repo().update("bob", todo.id, { title: "Hacked" })).toBeNull();

      const updated = await repo().update("alice", todo.id, { completed: true });
      expect(updated).toMatchObject({ id: todo.id, title: "Original", completed: true });
      expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(todo.updatedAt.getTime());

      expect(await repo().findById("alice", todo.id)).toMatchObject({ title: "Original", completed: true });
      expect(await repo().update("alice", MISSING_ID, { title: "x" })).toBeNull();
    });

    it("deletes only for the owner", async () => {
      const todo = await repo().create("alice", { title: "Delete me", completed: false });

      expect(await repo().delete("bob", todo.id)).toBe(false);
      expect(await repo().findById("alice", todo.id)).not.toBeNull();

      expect(await repo().delete("alice", todo.id)).toBe(true);
      expect(await repo().findById("alice", todo.id)).toBeNull();
      expect(await repo().delete("alice", todo.id)).toBe(false);
    });
  });
};
