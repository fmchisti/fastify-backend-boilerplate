import type { FastifyBaseLogger } from "fastify";

export interface ShutdownOptions {
  /** Stops accepting connections and runs onClose hooks (Fastify's `app.close`). */
  close: () => Promise<void>;
  logger: FastifyBaseLogger;
  timeoutMs: number;
  exit?: (code: number) => void;
}

/**
 * Returns a handler that shuts down once:
 * - first call: close the app, exit 0 (or 1 if closing fails or takes longer than timeoutMs)
 * - further calls (e.g. a second Ctrl+C): exit 1 immediately
 *
 * During close Fastify answers new requests with 503 so load balancers stop routing here.
 */
export const createShutdownHandler = ({
  close,
  logger,
  timeoutMs,
  exit = (code) => process.exit(code),
}: ShutdownOptions) => {
  let shuttingDown = false;

  return async (reason: string, error?: unknown): Promise<void> => {
    if (shuttingDown) {
      logger.warn({ reason }, "Forced exit during shutdown");
      exit(1);
      return;
    }
    shuttingDown = true;

    if (error) {
      logger.fatal({ err: error, reason }, "Shutting down after fatal error");
    } else {
      logger.info({ reason }, "Shutting down gracefully");
    }

    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<"timeout">((resolve) => {
      timer = setTimeout(() => resolve("timeout"), timeoutMs);
      timer.unref();
    });

    try {
      const result = await Promise.race([close().then(() => "closed" as const), timeout]);
      if (result === "timeout") {
        logger.error({ timeoutMs }, "Shutdown timed out, forcing exit");
        exit(1);
        return;
      }
      exit(error ? 1 : 0);
    } catch (closeError) {
      logger.error({ err: closeError }, "Error during shutdown");
      exit(1);
    } finally {
      clearTimeout(timer);
    }
  };
};
