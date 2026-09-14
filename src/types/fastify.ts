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
import type { AuthProvider, AuthUser } from "../auth/types.ts"; // @setup-if auth!=none

// @setup-if auth!=none
declare module "fastify" {
  interface FastifyInstance {
    /** Selected auth provider. Used by the auth middleware. */
    auth: AuthProvider;
  }
  interface FastifyRequest {
    /** Set by `authenticate` / `optionalAuth`. `null` for anonymous requests. */
    user: AuthUser | null;
  }
}
// @setup-endif

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
