import { getAuthUser } from "../../auth/middleware.ts";
import { toPaginatedResponse } from "../../lib/pagination.ts";
import type { ZodRouteHandler } from "../../types/fastify.ts";
import type {
  CreateTodoSchema,
  DeleteTodoSchema,
  GetTodoSchema,
  ListTodosSchema,
  UpdateTodoSchema,
} from "./schema.ts";
import type { TodoService } from "./service.ts";

export const createTodoHandlers = (service: TodoService) => {
  const list: ZodRouteHandler<typeof ListTodosSchema> = async (request) => {
    const page = await service.list(getAuthUser(request).id, request.query);
    return toPaginatedResponse(page, request.query);
  };

  const get: ZodRouteHandler<typeof GetTodoSchema> = async (request) =>
    service.get(getAuthUser(request).id, request.params.id);

  const create: ZodRouteHandler<typeof CreateTodoSchema> = async (request, reply) => {
    const todo = await service.create(getAuthUser(request).id, request.body);
    return reply.status(201).send(todo);
  };

  const update: ZodRouteHandler<typeof UpdateTodoSchema> = async (request) =>
    service.update(getAuthUser(request).id, request.params.id, request.body);

  const remove: ZodRouteHandler<typeof DeleteTodoSchema> = async (request, reply) => {
    await service.delete(getAuthUser(request).id, request.params.id);
    return reply.status(204).send(null);
  };

  return { list, get, create, update, remove };
};
