import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { healthCheckDocs } from "./docs";
import { healthCheckHandler } from "./handler";
import { HealthCheckSchema } from "./schema";

const healthRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.route({
    method: "GET",
    url: "/health",
    schema: { ...HealthCheckSchema, ...healthCheckDocs },
    handler: healthCheckHandler,
  });
};

export default healthRoutes;
