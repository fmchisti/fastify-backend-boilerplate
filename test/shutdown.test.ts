import pino from "pino";
import { describe, expect, it, vi } from "vitest";
import { createShutdownHandler } from "../src/lib/shutdown.ts";

const logger = pino({ level: "silent" });

describe("createShutdownHandler", () => {
  it("closes the app and exits 0", async () => {
    const close = vi.fn(async () => undefined);
    const exit = vi.fn();

    await createShutdownHandler({ close, logger, timeoutMs: 1000, exit })("SIGTERM");

    expect(close).toHaveBeenCalledOnce();
    expect(exit).toHaveBeenCalledWith(0);
  });

  it("exits 1 after closing when shutting down because of a fatal error", async () => {
    const exit = vi.fn();

    await createShutdownHandler({ close: async () => undefined, logger, timeoutMs: 1000, exit })(
      "uncaughtException",
      new Error("boom"),
    );

    expect(exit).toHaveBeenCalledWith(1);
  });

  it("forces exit 1 when close takes longer than the timeout", async () => {
    const exit = vi.fn();
    const neverCloses = () => new Promise<void>(() => undefined);

    await createShutdownHandler({ close: neverCloses, logger, timeoutMs: 20, exit })("SIGTERM");

    expect(exit).toHaveBeenCalledWith(1);
  });

  it("exits 1 when close throws", async () => {
    const exit = vi.fn();

    await createShutdownHandler({
      close: async () => {
        throw new Error("pool already closed");
      },
      logger,
      timeoutMs: 1000,
      exit,
    })("SIGTERM");

    expect(exit).toHaveBeenCalledWith(1);
  });

  it("exits 1 immediately on a second signal", async () => {
    const exit = vi.fn();
    let finishClose: () => void = () => undefined;
    const close = () => new Promise<void>((resolve) => (finishClose = resolve));
    const shutdown = createShutdownHandler({ close, logger, timeoutMs: 1000, exit });

    const first = shutdown("SIGINT");
    await shutdown("SIGINT");
    expect(exit).toHaveBeenCalledWith(1);

    finishClose();
    await first;
    expect(exit).toHaveBeenLastCalledWith(0);
  });
});

describe("app.close() with in-flight requests", () => {
  it("lets in-flight requests finish and rejects new connections", async () => {
    const { buildApp } = await import("../src/app.ts");
    const { createTestDependencies, testEnv } = await import("./helpers.ts");
    const app = await buildApp(createTestDependencies(), { env: testEnv() });
    let release: () => void = () => undefined;
    let markEntered: () => void = () => undefined;
    const entered = new Promise<void>((resolve) => (markEntered = resolve));
    app.get("/slow", async () => {
      const released = new Promise<void>((resolve) => (release = resolve));
      markEntered();
      await released;
      return { done: true };
    });
    await app.listen({ port: 0, host: "127.0.0.1" });
    const address = app.server.address();
    if (!address || typeof address === "string") throw new Error("no port");
    const url = `http://127.0.0.1:${address.port}`;

    const inFlight = fetch(`${url}/slow`);
    // Close only once the request is inside the handler
    await entered;

    const closing = app.close();
    await expect(fetch(`${url}/api/health`)).rejects.toThrow();

    release();
    const response = await inFlight;
    expect(response.status).toBe(200);
    expect(response.headers.get("connection")).toBe("close");
    expect(await response.json()).toEqual({ done: true });

    // Resolves promptly instead of waiting for the keep-alive timeout
    const started = Date.now();
    await closing;
    expect(Date.now() - started).toBeLessThan(1000);
  });
});
