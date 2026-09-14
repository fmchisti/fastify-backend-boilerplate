import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { ErrorResponseSchema } from "../../lib/errors.ts";
import { healthCheckDocs, readinessDocs } from "./docs.ts";
import { healthCheckHandler } from "./handler.ts";
import { HealthCheckSchema, ReadinessResponseSchema } from "./schema.ts";

export interface HealthRoutesOptions {
  /** Name → check that throws when the dependency is unreachable (database, redis, ...). */
  checks: Record<string, () => Promise<void>>;
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
      const entries = Object.entries(options.checks);
      const results = await Promise.allSettled(entries.map(([, check]) => check()));

      const failed: string[] = [];
      results.forEach((result, index) => {
        const name = entries[index]?.[0] ?? "unknown";
        if (result.status === "rejected") {
          failed.push(name);
          request.log.error({ err: result.reason, check: name }, "Readiness check failed");
        }
      });

      if (failed.length > 0) {
        return reply
          .status(503)
          .send({ error: "Service Unavailable", message: `Unavailable: ${failed.join(", ")}` });
      }
      return {
        status: "ready" as const,
        checks: Object.fromEntries(entries.map(([name]) => [name, "up" as const])),
      };
    },
  });
};

export default healthRoutes;
