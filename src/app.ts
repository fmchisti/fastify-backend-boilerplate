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
import { env } from "./config/env.ts";
import { loggerOptions } from "./config/logger.ts";
import { swaggerOptions, swaggerUiOptions } from "./config/swagger.ts";
import { type AppDependencies, createDependencies } from "./container.ts";
import { errorHandler, notFoundHandler } from "./lib/errors.ts";
// @setup-if storage=s3,local
import fileRoutes from "./modules/files/routes.ts";
// @setup-endif
import healthRoutes from "./modules/health/routes.ts";
import meRoutes from "./modules/me/routes.ts";
import todoRoutes from "./modules/todos/routes.ts";

const DEV_ORIGINS = ["http://localhost:3000", "http://localhost:5173"];

const corsOrigins = (): string[] => {
  const origins = env.FRONTEND_URL ? [env.FRONTEND_URL] : [];
  // Localhost origins are only allowed outside production
  return env.NODE_ENV === "production" ? origins : [...origins, ...DEV_ORIGINS];
};

/**
 * Build a fully configured Fastify instance without listening.
 * Used by `src/index.ts` to start the server and by tests via `app.inject()`.
 * Pass `overrides` to replace real providers (database, auth, storage) with fakes.
 */
export const buildApp = async (overrides: Partial<AppDependencies> = {}) => {
  const app = Fastify({ logger: loggerOptions }).withTypeProvider<ZodTypeProvider>();
  const deps = createDependencies(overrides);

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler(notFoundHandler);
  app.decorate("auth", deps.auth);
  app.decorateRequest("user", null);

  app.addHook("onClose", async () => {
    await deps.auth.close?.();
    await deps.database.close();
  });

  await app.register(fastifyCors, {
    origin: corsOrigins(),
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    credentials: true,
  });
  await app.register(fastifySwagger, swaggerOptions);
  await app.register(fastifySwaggerUi, swaggerUiOptions);

  if (deps.auth.routes) {
    await app.register(deps.auth.routes, { prefix: "/api/auth" });
  }
  await app.register(healthRoutes, { prefix: "/api", database: deps.database });
  await app.register(meRoutes, { prefix: "/api" });
  await app.register(todoRoutes, { prefix: "/api", repository: deps.todos });
  // @setup-if storage=s3,local
  await app.register(fileRoutes, { prefix: "/api", storage: deps.storage });
  // @setup-endif

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
