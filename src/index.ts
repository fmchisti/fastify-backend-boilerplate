import { buildApp } from "./app.ts";
import { env } from "./config/env.ts";
import { logger } from "./config/logger.ts";
import { createShutdownHandler } from "./lib/shutdown.ts";

const main = async (): Promise<void> => {
  const app = await buildApp();

  const shutdown = createShutdownHandler({
    close: () => app.close(),
    logger: app.log,
    timeoutMs: env.SHUTDOWN_TIMEOUT_SECONDS * 1000,
  });

  // SIGTERM: sent by Docker, Kubernetes, Railway on deploy/stop. SIGINT: Ctrl+C.
  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.on(signal, () => void shutdown(signal));
  }
  process.on("uncaughtException", (error) => void shutdown("uncaughtException", error));
  process.on("unhandledRejection", (error) => void shutdown("unhandledRejection", error));

  await app.listen({ port: env.PORT, host: env.HOST });
};

main().catch((err: unknown) => {
  logger.fatal({ err }, "Failed to start server");
  process.exit(1);
});
