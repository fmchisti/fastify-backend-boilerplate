import { describe, expect, it } from "vitest";
import { z } from "zod";
import { bearer } from "./fakes/auth.ts";
import { useTestApp } from "./helpers.ts";

const TodoJson = z.object({
  id: z.uuid(),
  title: z.string(),
  completed: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
const alice = bearer("alice-token");
const bob = bearer("bob-token");

describe("todos routes", () => {
  const app = useTestApp();

  const createTodo = async (title: string, headers = alice, completed = false) => {
    const response = await app().inject({
      method: "POST",
      url: "/api/todos",
      headers,
      payload: { title, completed },
    });
    expect(response.statusCode).toBe(201);
    return TodoJson.parse(response.json());
  };

  it("requires authentication on every route", async () => {
    const id = "00000000-0000-4000-8000-000000000000";
    const requests = [
      { method: "GET", url: "/api/todos" },
      { method: "POST", url: "/api/todos" },
      { method: "GET", url: `/api/todos/${id}` },
      { method: "PATCH", url: `/api/todos/${id}` },
      { method: "DELETE", url: `/api/todos/${id}` },
    ] as const;

    for (const request of requests) {
      const response = await app().inject(request);
      expect(response.statusCode, `${request.method} ${request.url}`).toBe(401);
    }
  });

  it("creates, reads, updates, and deletes a todo", async () => {
    const created = await createTodo("  Write tests  ");
    expect(created).toMatchObject({ title: "Write tests", completed: false });

    const fetched = await app().inject({ method: "GET", url: `/api/todos/${created.id}`, headers: alice });
    expect(fetched.statusCode).toBe(200);
    expect(TodoJson.parse(fetched.json()).id).toBe(created.id);

    const updated = await app().inject({
      method: "PATCH",
      url: `/api/todos/${created.id}`,
      headers: alice,
      payload: { completed: true },
    });
    expect(updated.statusCode).toBe(200);
    expect(TodoJson.parse(updated.json())).toMatchObject({ title: "Write tests", completed: true });

    const deleted = await app().inject({ method: "DELETE", url: `/api/todos/${created.id}`, headers: alice });
    expect(deleted.statusCode).toBe(204);
    expect(deleted.body).toBe("");

    const missing = await app().inject({ method: "GET", url: `/api/todos/${created.id}`, headers: alice });
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toEqual({ error: "Not Found", message: "Todo not found" });
  });

  it("hides other users' todos (404, not 403)", async () => {
    const todo = await createTodo("Alice only");

    for (const method of ["GET", "PATCH", "DELETE"] as const) {
      const response = await app().inject({
        method,
        url: `/api/todos/${todo.id}`,
        headers: bob,
        ...(method === "PATCH" && { payload: { title: "hacked" } }),
      });
      expect(response.statusCode, method).toBe(404);
    }

    const list = await app().inject({ method: "GET", url: "/api/todos", headers: bob });
    const ids = list.json<{ items: { id: string }[] }>().items.map((item) => item.id);
    expect(ids).not.toContain(todo.id);
  });

  it("paginates and filters by completed", async () => {
    // Bob has no todos yet in this file, so totals are exact
    for (const [index, completed] of [false, true, false, true, false].entries()) {
      await createTodo(`Bob todo ${index}`, bob, completed);
    }

    const page1 = await app().inject({ method: "GET", url: "/api/todos?page=1&pageSize=2", headers: bob });
    expect(page1.statusCode).toBe(200);
    expect(page1.json()).toMatchObject({ page: 1, pageSize: 2, total: 5, totalPages: 3 });
    expect(page1.json<{ items: unknown[] }>().items).toHaveLength(2);

    const page3 = await app().inject({ method: "GET", url: "/api/todos?page=3&pageSize=2", headers: bob });
    expect(page3.json<{ items: unknown[] }>().items).toHaveLength(1);

    const completed = await app().inject({ method: "GET", url: "/api/todos?completed=true", headers: bob });
    const body = completed.json<{ items: { completed: boolean }[]; total: number }>();
    expect(body.total).toBe(2);
    expect(body.items.every((item) => item.completed)).toBe(true);
  });

  it.each([
    ["empty title", { title: "   " }],
    ["too long title", { title: "x".repeat(201) }],
    ["wrong type", { title: 42 }],
  ])("rejects %s with 400", async (_label, payload) => {
    const response = await app().inject({ method: "POST", url: "/api/todos", headers: alice, payload });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: "Bad Request", message: "Request validation failed" });
  });

  it("rejects an empty update and invalid ids", async () => {
    const todo = await createTodo("Patch me");

    const empty = await app().inject({
      method: "PATCH",
      url: `/api/todos/${todo.id}`,
      headers: alice,
      payload: {},
    });
    expect(empty.statusCode).toBe(400);

    const badId = await app().inject({ method: "GET", url: "/api/todos/not-a-uuid", headers: alice });
    expect(badId.statusCode).toBe(400);

    const badPage = await app().inject({ method: "GET", url: "/api/todos?pageSize=1000", headers: alice });
    expect(badPage.statusCode).toBe(400);
  });
});
