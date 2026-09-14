import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { authenticate } from "../../auth/middleware.ts";
import * as docs from "./docs.ts";
import { createTodoHandlers } from "./handler.ts";
import type { TodoRepository } from "./repository/index.ts";
import {
  CreateTodoSchema,
  DeleteTodoSchema,
  GetTodoSchema,
  ListTodosSchema,
  UpdateTodoSchema,
} from "./schema.ts";
import { createTodoService } from "./service.ts";

export interface TodoRoutesOptions {
  repository: TodoRepository;
}

const todoRoutes: FastifyPluginAsyncZod<TodoRoutesOptions> = async (fastify, options) => {
  const handlers = createTodoHandlers(createTodoService(options.repository));

  // Every todo route requires a signed-in user
  fastify.addHook("onRequest", authenticate);

  fastify.route({
    method: "GET",
    url: "/todos",
    schema: { ...ListTodosSchema, ...docs.listTodosDocs },
    handler: handlers.list,
  });
  fastify.route({
    method: "POST",
    url: "/todos",
    schema: { ...CreateTodoSchema, ...docs.createTodoDocs },
    handler: handlers.create,
  });
  fastify.route({
    method: "GET",
    url: "/todos/:id",
    schema: { ...GetTodoSchema, ...docs.getTodoDocs },
    handler: handlers.get,
  });
  fastify.route({
    method: "PATCH",
    url: "/todos/:id",
    schema: { ...UpdateTodoSchema, ...docs.updateTodoDocs },
    handler: handlers.update,
  });
  fastify.route({
    method: "DELETE",
    url: "/todos/:id",
    schema: { ...DeleteTodoSchema, ...docs.deleteTodoDocs },
    handler: handlers.remove,
  });
};

export default todoRoutes;
