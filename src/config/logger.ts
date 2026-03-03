import pino, { Logger } from "pino";
import { env } from "./env";

// Logger options for Fastify
export const loggerOptions = {
  level: env.LOG_LEVEL || (env.NODE_ENV === "development" ? "debug" : "info"),
  transport:
    env.NODE_ENV === "development"
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss Z",
            ignore: "pid,hostname",
          },
        }
      : undefined,
  formatters: {
    level: (label: string) => {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
};

// Standalone logger instance for use outside of Fastify
export const logger: Logger = pino(loggerOptions);
