import { buildApp } from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";

const main = async (): Promise<void> => {
  const app = await buildApp();
  await app.listen({ port: env.PORT, host: env.HOST });
};

main().catch((err: unknown) => {
  logger.fatal({ err }, "Failed to start server");
  process.exit(1);
});
