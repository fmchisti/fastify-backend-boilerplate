import { STATUS_CODES } from "node:http";
import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { hasZodFastifySchemaValidationErrors, isResponseSerializationError } from "fastify-type-provider-zod";
import { z } from "zod";

/** Shape of every error response. Use in route `response` schemas for 4xx/5xx docs. */
export const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
  details: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

/**
 * Throw from handlers, services, or hooks to send a specific HTTP status.
 * The global error handler turns it into an ErrorResponse.
 */
export class HttpError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
  }
}

const statusText = (statusCode: number): string => STATUS_CODES[statusCode] ?? "Error";

const resolveStatusCode = (error: FastifyError): number => {
  const { statusCode } = error;
  return typeof statusCode === "number" && statusCode >= 400 && statusCode < 600 ? statusCode : 500;
};

export const errorHandler = (
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply,
): FastifyReply => {
  if (hasZodFastifySchemaValidationErrors(error)) {
    request.log.warn({ err: error }, "Request validation failed");
    const body: ErrorResponse = {
      error: statusText(400),
      message: "Request validation failed",
      details: error.validation.map((issue) => ({
        path: `${error.validationContext ?? "request"}${issue.instancePath}`,
        message: issue.message ?? "Invalid value",
      })),
    };
    return reply.status(400).send(body);
  }

  if (isResponseSerializationError(error)) {
    request.log.error({ err: error }, "Response did not match schema");
    return reply.status(500).send({ error: statusText(500), message: "An unexpected error occurred" });
  }

  const statusCode = resolveStatusCode(error);
  if (statusCode >= 500) {
    request.log.error({ err: error }, error.message);
  } else {
    request.log.warn({ err: error }, error.message);
  }

  const body: ErrorResponse = {
    error: statusText(statusCode),
    // Never leak internal error messages to clients
    message: statusCode >= 500 ? "An unexpected error occurred" : error.message,
  };
  return reply.status(statusCode).send(body);
};

export const notFoundHandler = (request: FastifyRequest, reply: FastifyReply): FastifyReply => {
  const body: ErrorResponse = {
    error: statusText(404),
    message: `Route ${request.method} ${request.url} not found`,
  };
  return reply.status(404).send(body);
};
