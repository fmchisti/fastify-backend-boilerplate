import type {
  ContextConfigDefault,
  FastifySchema,
  RawReplyDefaultExpression,
  RawRequestDefaultExpression,
  RawServerDefault,
  RouteGenericInterface,
  RouteHandlerMethod,
} from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";

/**
 * Handler type inferred from a route's Zod schema.
 * `request.body` / `params` / `querystring` and the return value are all typed.
 *
 * @example
 * export const getTodo: ZodRouteHandler<typeof GetTodoSchema> = async (request) => {
 *   return todoService.get(request.params.id); // must match response schema
 * };
 */
export type ZodRouteHandler<TSchema extends FastifySchema> = RouteHandlerMethod<
  RawServerDefault,
  RawRequestDefaultExpression,
  RawReplyDefaultExpression,
  RouteGenericInterface,
  ContextConfigDefault,
  TSchema,
  ZodTypeProvider
>;
