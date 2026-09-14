import type { ZodRouteHandler } from "../../types/fastify";
import type { HealthCheckSchema } from "./schema";
import { getHealthStatus } from "./service";

export const healthCheckHandler: ZodRouteHandler<
  typeof HealthCheckSchema
> = async (request) => {
  const healthStatus = getHealthStatus();
  request.log.debug({ uptime: healthStatus.uptime }, "Health check requested");
  // Response is validated and serialized by the route's Zod schema
  return healthStatus;
};
