import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { authenticate, getAuthUser } from "../../auth/middleware.ts";
import { ErrorResponseSchema } from "../../lib/errors.ts";

export const MeResponseSchema = z.object({
  id: z.string(),
  email: z.string().nullable(),
  name: z.string().nullable(),
});

const meRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.route({
    method: "GET",
    url: "/me",
    onRequest: [authenticate],
    schema: {
      tags: ["Auth"],
      summary: "Get current user",
      description: "Returns the user resolved by the configured auth provider.",
      security: [{ bearerAuth: [] }],
      response: { 200: MeResponseSchema, 401: ErrorResponseSchema },
    },
    handler: async (request) => getAuthUser(request),
  });
};

export default meRoutes;
