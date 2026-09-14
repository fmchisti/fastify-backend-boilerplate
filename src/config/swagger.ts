import type { FastifyDynamicSwaggerOptions } from "@fastify/swagger";
import type { FastifySwaggerUiOptions } from "@fastify/swagger-ui";
import { jsonSchemaTransform } from "fastify-type-provider-zod";
import { isValidBasicAuth } from "../lib/basic-auth";
import { HttpError } from "../lib/errors";
import { env } from "./env";

export const swaggerOptions: FastifyDynamicSwaggerOptions = {
  transform: jsonSchemaTransform,
  openapi: {
    openapi: "3.1.0",
    info: {
      title: "Fastify API",
      description:
        "A type-safe Fastify backend API. Add your own routes and modules under `src/modules`.",
      version: "1.0.0",
      contact: {
        name: "API Support",
      },
    },
    servers: [
      {
        url: `http://localhost:${env.PORT}`,
        description: "Local development server",
      },
      {
        url: env.BACKEND_URL,
        description: "Production server",
      },
    ],
    tags: [
      { name: "Health", description: "Health check endpoints" },
      { name: "Auth", description: "Authenticated user endpoints" },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "JWT token (e.g. from your auth provider)",
        },
      },
    },
  },
};

export const swaggerUiOptions: FastifySwaggerUiOptions = {
  routePrefix: "/api/docs",
  uiConfig: {
    docExpansion: "list",
    deepLinking: true,
    defaultModelsExpandDepth: 2,
    defaultModelExpandDepth: 2,
  },
  staticCSP: true,
  uiHooks: {
    onRequest: (request, reply, done) => {
      const { DOCS_USERNAME: username, DOCS_PASSWORD: password } = env;
      if (!username || !password) {
        done();
        return;
      }
      if (isValidBasicAuth(request.headers.authorization, username, password)) {
        done();
        return;
      }
      reply.header("WWW-Authenticate", 'Basic realm="API Docs"');
      done(new HttpError(401, "Invalid or missing docs credentials"));
    },
  },
  theme: {
    title: "API Documentation",
  },
};
