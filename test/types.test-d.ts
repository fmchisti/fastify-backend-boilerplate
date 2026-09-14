// Compile-time checks: run by `vitest --typecheck` and `pnpm type-check`
import { describe, expectTypeOf, it } from "vitest";
import { z } from "zod";
import type { AuthUser } from "../src/auth/types.ts"; // @setup-if auth!=none
import type { ZodRouteHandler } from "../src/types/fastify.ts";

const CreateTodoSchema = {
  body: z.object({ title: z.string() }),
  params: z.object({ listId: z.uuid() }),
  response: { 201: z.object({ id: z.string(), title: z.string() }) },
};

describe("ZodRouteHandler", () => {
  it("infers request types from the schema", () => {
    const handler: ZodRouteHandler<typeof CreateTodoSchema> = async (request) => {
      expectTypeOf(request.body).toEqualTypeOf<{ title: string }>();
      expectTypeOf(request.params).toEqualTypeOf<{ listId: string }>();
      return { id: "1", title: request.body.title };
    };
    expectTypeOf(handler).toBeFunction();
  });

  it("rejects return values that do not match the response schema", () => {
    // @ts-expect-error – `title` is missing from the response
    const handler: ZodRouteHandler<typeof CreateTodoSchema> = async () => ({ id: "1" });
    expectTypeOf(handler).toBeFunction();
  });
});

// @setup-if auth!=none
describe("request.user", () => {
  it("is typed as AuthUser | null on every request", () => {
    const handler: ZodRouteHandler<typeof CreateTodoSchema> = async (request) => {
      expectTypeOf(request.user).toEqualTypeOf<AuthUser | null>();
      return { id: "1", title: "t" };
    };
    expectTypeOf(handler).toBeFunction();
  });
});
// @setup-endif
