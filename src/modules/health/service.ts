import { env } from "../../config/env";
import { HealthCheckResponse } from "./schema";

const startTime = Date.now();

export const getHealthStatus = (): HealthCheckResponse => {
  const uptime = Math.floor((Date.now() - startTime) / 1000);

  return {
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime,
    environment: env.NODE_ENV,
  };
};
