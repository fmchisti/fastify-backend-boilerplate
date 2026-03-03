// Type for Fastify JSON schema
export type FastifyJsonSchema = {
  body?: unknown;
  querystring?: unknown;
  params?: unknown;
  headers?: unknown;
  response?: {
    [statusCode: number]: unknown;
  };
};
