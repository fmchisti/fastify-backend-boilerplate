import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { authenticate } from "../../middleware/auth";
import { meDocs } from "./docs";
import { meHandler } from "./handler";
import { MeSchema } from "./schema";

const authRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.route({
    method: "GET",
    url: "/auth/me",
    preHandler: [authenticate],
    schema: { ...MeSchema, ...meDocs },
    handler: meHandler,
  });
};

export default authRoutes;
