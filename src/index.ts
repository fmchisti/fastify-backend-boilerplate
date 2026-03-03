import fastifyCors from "@fastify/cors";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import Fastify, { FastifyError } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import { z } from "zod";
import "./config/database"; // Initialize database connection
import "./config/env"; // Load and validate environment variables first
import { env } from "./config/env";
import { logger, loggerOptions } from "./config/logger";
import "./config/supabase"; // Initialize Supabase clients
import { swaggerOptions, swaggerUiOptions } from "./config/swagger";
import healthRoutes from "./modules/health/routes";

const fastify = Fastify({
  logger: loggerOptions,
});

// Add schema validator and serializer
fastify.setValidatorCompiler(validatorCompiler);
fastify.setSerializerCompiler(serializerCompiler);

// Global error handler – map known errors to status codes, log, and send consistent shape
fastify.setErrorHandler((error: FastifyError, request, reply) => {
  const statusCode = error.statusCode ?? 500;
  const message = error.message ?? "An unexpected error occurred";
  if (statusCode >= 500) {
    fastify.log.error({ err: error, req: request }, message);
  } else {
    fastify.log.warn({ err: error, req: request }, message);
  }
  if (!reply.sent) {
    reply.status(statusCode).send({
      error:
        statusCode === 401
          ? "Unauthorized"
          : statusCode === 403
            ? "Forbidden"
            : statusCode === 404
              ? "Not Found"
              : statusCode >= 500
                ? "Internal server error"
                : "Bad Request",
      message: statusCode >= 500 ? "An unexpected error occurred" : message,
    });
  }
});

async function bootstrap(): Promise<void> {
  const corsOrigins = env.FRONTEND_URL
    ? [env.FRONTEND_URL, "http://localhost:3000", "http://localhost:5173"]
    : ["http://localhost:3000", "http://localhost:5173"];

  await fastify.register(fastifyCors, {
    origin: corsOrigins,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    credentials: true,
  });
  await fastify.register(fastifySwagger, swaggerOptions);
  await fastify.register(fastifySwaggerUi, swaggerUiOptions);
  await fastify.register(healthRoutes, { prefix: "/api" });

  fastify.withTypeProvider<ZodTypeProvider>().get(
    "/",
    {
      schema: {
        tags: ["Health"],
        description: "API root endpoint",
        summary: "API information",
        response: {
          200: z.object({
            message: z.string(),
            version: z.string(),
          }),
        },
      },
    },
    async () => ({ message: "Fastify API", version: "1.0.0" }),
  );

  await fastify.listen({ port: env.PORT, host: env.HOST });
  logger.info(`Server listening on http://${env.HOST}:${env.PORT}`);
}

bootstrap().catch((err) => {
  logger.error(err as FastifyError, "Failed to start server");
  process.exit(1);
});
