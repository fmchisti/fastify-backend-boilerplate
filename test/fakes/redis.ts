import type { Redis } from "ioredis";
import RedisMock from "ioredis-mock";

let nextPort = 50_000;

/**
 * In-memory Redis. ioredis-mock shares data between instances with the same host/port,
 * so each instance gets its own port to keep tests isolated.
 */
export const createRedisMock = (): Redis => new RedisMock({ port: nextPort++ });
