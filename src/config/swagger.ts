import type { FastifyDynamicSwaggerOptions } from "@fastify/swagger";
import type { FastifySwaggerUiOptions } from "@fastify/swagger-ui";
import { jsonSchemaTransform } from "fastify-type-provider-zod";
import { env } from "./env";

export const swaggerOptions: FastifyDynamicSwaggerOptions = {
  transform: jsonSchemaTransform,
  openapi: {
    openapi: "3.1.0",
    info: {
      title: "Fastify API",
      description: "A type-safe Fastify backend API. Add your own routes and modules under `src/modules`.",
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
        url: `${env.BACKEND_URL}`,
        description: "Production server",
      },
    ],
    tags: [
      { name: "Health", description: "Health check endpoints" },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http" as const,
          scheme: "bearer" as const,
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
  transformStaticCSP: (header) => header,
  transformSpecification: (swaggerObject, request, reply) => {
    return swaggerObject;
  },
  transformSpecificationClone: true,
  uiHooks: {
    onRequest: function (request, reply, next) {
      const username = env.DOCS_USERNAME;
      const password = env.DOCS_PASSWORD;
      if (!username || !password) {
        next();
        return;
      }
      const authHeader = request.headers.authorization;
      if (!authHeader?.startsWith("Basic ")) {
        reply
          .status(401)
          .header("WWW-Authenticate", 'Basic realm="API Docs"')
          .send({ error: "Unauthorized", message: "Username and password required" });
        return;
      }
      try {
        const encoded = authHeader.slice(6);
        const decoded = Buffer.from(encoded, "base64").toString("utf8");
        const [user, pass] = decoded.split(":", 2);
        if (user === username && pass === password) {
          next();
          return;
        }
      } catch {
        // ignore decode errors
      }
      reply
        .status(401)
        .header("WWW-Authenticate", 'Basic realm="API Docs"')
        .send({ error: "Unauthorized", message: "Invalid username or password" });
    },
    preHandler: function (request, reply, next) {
      next();
    },
  },
  theme: {
    title: "API Documentation",
  },
};
