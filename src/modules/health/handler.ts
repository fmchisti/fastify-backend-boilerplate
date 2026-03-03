import { FastifyReply, FastifyRequest } from "fastify";
import { logger } from "../../config/logger";
import { HealthCheckSchemaResponse } from "./schema";
import { getHealthStatus } from "./service";

export const healthCheckHandler = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  try {
    const healthStatus = getHealthStatus();

    // Validate response with Zod
    const validatedResponse = HealthCheckSchemaResponse.parse(healthStatus);

    logger.debug("Health check requested", {
      timestamp: validatedResponse.timestamp,
      uptime: validatedResponse.uptime,
    });

    reply.send(validatedResponse);
  } catch (error) {
    logger.error("Health check failed", { error });
    reply.status(500).send({
      error: "Internal server error",
      message: "Failed to get health status",
    });
  }
};
