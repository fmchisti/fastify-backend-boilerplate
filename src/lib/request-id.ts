import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";

export const REQUEST_ID_HEADER = "x-request-id";

// Accept ids from an upstream proxy only if they are short and log-safe
const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/;

/** Fastify `genReqId`: reuse a safe incoming `x-request-id`, otherwise generate one. */
export const generateRequestId = (request: IncomingMessage): string => {
  const incoming = request.headers[REQUEST_ID_HEADER];
  return typeof incoming === "string" && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
};
