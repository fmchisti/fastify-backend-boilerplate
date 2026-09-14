import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { text } from "node:stream/consumers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLocalStorage } from "../../src/storage/providers/local/index.ts";
import type { StorageProvider } from "../../src/storage/types.ts";

describe("local storage provider", () => {
  let dir: string;
  let storage: StorageProvider;

  beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "storage-test-"));
    storage = createLocalStorage(dir);
  });

  afterAll(() => rm(dir, { recursive: true, force: true }));

  it("stores, reads, and deletes objects with content type", async () => {
    await storage.put({
      key: "u1/a.txt",
      body: Readable.from(["hello ", "world"]),
      contentType: "text/plain",
    });

    const object = await storage.get("u1/a.txt");
    expect(object?.contentType).toBe("text/plain");
    expect(object?.contentLength).toBe(11);
    expect(object && (await text(object.body))).toBe("hello world");

    await storage.delete("u1/a.txt");
    expect(await storage.get("u1/a.txt")).toBeNull();
  });

  it("returns null for missing objects and ignores deleting them", async () => {
    expect(await storage.get("u1/missing.txt")).toBeNull();
    await expect(storage.delete("u1/missing.txt")).resolves.toBeUndefined();
  });

  it.each(["../escape.txt", "u1/../../escape.txt", "/etc/passwd"])(
    "rejects keys that escape the root: %s",
    async (key) => {
      await expect(storage.put({ key, body: Buffer.from("x"), contentType: "text/plain" })).rejects.toThrow(
        "Invalid storage key",
      );
    },
  );

  it("does not support presigned uploads", () => {
    expect(storage.createUploadUrl).toBeUndefined();
  });
});
