import pino, { type Logger, type LoggerOptions } from "pino";
import { env } from "./env.ts";

const isDevelopment = env.NODE_ENV === "development";

// Logger options for Fastify
export const loggerOptions: LoggerOptions = {
  level: env.LOG_LEVEL ?? (isDevelopment ? "debug" : "info"),
  ...(isDevelopment && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "HH:MM:ss Z",
        ignore: "pid,hostname",
      },
    },
  }),
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
};

// Standalone logger for code outside a request. Inside handlers, prefer `request.log`.
export const logger: Logger = pino(loggerOptions);
