import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { Database } from "../../db/types.ts";
import { ErrorResponseSchema } from "../../lib/errors.ts";
import { healthCheckDocs, readinessDocs } from "./docs.ts";
import { healthCheckHandler } from "./handler.ts";
import { HealthCheckSchema, ReadinessResponseSchema } from "./schema.ts";

export interface HealthRoutesOptions {
  database: Pick<Database, "ping">;
}

const healthRoutes: FastifyPluginAsyncZod<HealthRoutesOptions> = async (fastify, options) => {
  // Liveness: the process is up. Does not touch dependencies.
  fastify.route({
    method: "GET",
    url: "/health",
    // Probes must never be rate limited
    config: { rateLimit: false },
    schema: { ...HealthCheckSchema, ...healthCheckDocs },
    handler: healthCheckHandler,
  });

  // Readiness: dependencies are reachable. Point load balancer / Railway health checks here.
  fastify.route({
    method: "GET",
    url: "/health/ready",
    config: { rateLimit: false },
    schema: {
      ...readinessDocs,
      response: { 200: ReadinessResponseSchema, 503: ErrorResponseSchema },
    },
    handler: async (request, reply) => {
      try {
        await options.database.ping();
        return { status: "ready" as const, database: "up" as const };
      } catch (err) {
        request.log.error({ err }, "Readiness check failed: database unreachable");
        return reply
          .status(503)
          .send({ error: "Service Unavailable", message: "Database unreachable" });
      }
    },
  });
};

export default healthRoutes;
