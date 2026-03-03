import type { FastifyPluginOptions, FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import * as healthDocs from "./docs";
import { healthCheckHandler } from "./handler";
import { HealthCheckSchema } from "./schema";

const healthRoutes = async (
  fastify: FastifyInstance,
  options: FastifyPluginOptions,
): Promise<void> => {
  fastify.withTypeProvider<ZodTypeProvider>().route({
    method: "GET",
    url: "/health",
    schema: { ...HealthCheckSchema, ...healthDocs.healthCheckDocs },
    handler: healthCheckHandler,
  });
};

export default healthRoutes;
