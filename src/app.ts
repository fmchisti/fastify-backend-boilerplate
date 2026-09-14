import fastifyCors from "@fastify/cors";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import Fastify from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { z } from "zod";
import { env } from "./config/env";
import { loggerOptions } from "./config/logger";
import { swaggerOptions, swaggerUiOptions } from "./config/swagger";
import { errorHandler, notFoundHandler } from "./lib/errors";
import authRoutes from "./modules/auth/routes";
import healthRoutes from "./modules/health/routes";

const DEV_ORIGINS = ["http://localhost:3000", "http://localhost:5173"];

const corsOrigins = (): string[] => {
  const origins = env.FRONTEND_URL ? [env.FRONTEND_URL] : [];
  // Localhost origins are only allowed outside production
  return env.NODE_ENV === "production" ? origins : [...origins, ...DEV_ORIGINS];
};

/**
 * Build a fully configured Fastify instance without listening.
 * Used by `src/index.ts` to start the server and by tests via `app.inject()`.
 */
export const buildApp = async () => {
  const app = Fastify({ logger: loggerOptions }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler(notFoundHandler);
  app.decorateRequest("user", null);

  await app.register(fastifyCors, {
    origin: corsOrigins(),
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    credentials: true,
  });
  await app.register(fastifySwagger, swaggerOptions);
  await app.register(fastifySwaggerUi, swaggerUiOptions);

  await app.register(healthRoutes, { prefix: "/api" });
  await app.register(authRoutes, { prefix: "/api" });

  app.get(
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

  return app;
};

export type App = Awaited<ReturnType<typeof buildApp>>;
