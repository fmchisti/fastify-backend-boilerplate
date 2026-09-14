import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { z } from "zod";
import { loadEnv } from "../../../config/env.ts";
import type { StorageProvider } from "../../types.ts";

const localEnvSchema = z.object({
  LOCAL_STORAGE_DIR: z.string().min(1).default("./uploads"),
});

const MetadataSchema = z.object({ contentType: z.string() });

const isMissingFile = (error: unknown): boolean =>
  error instanceof Error && "code" in error && error.code === "ENOENT";

/**
 * Stores files on local disk. Good for development and single-server deploys;
 * use S3 when running multiple instances or on ephemeral filesystems (Railway, containers).
 */
export const createLocalStorage = (rootDir: string): StorageProvider => {
  const root = path.resolve(rootDir);

  // Reject keys that would escape the storage root (e.g. "../../etc/passwd")
  const resolveKey = (key: string): string => {
    const filePath = path.resolve(root, key);
    if (!filePath.startsWith(root + path.sep)) {
      throw new Error(`Invalid storage key: ${key}`);
    }
    return filePath;
  };
  const metadataPath = (filePath: string) => `${filePath}.meta.json`;

  return {
    name: "local",

    put: async ({ key, body, contentType }) => {
      const filePath = resolveKey(key);
      await mkdir(path.dirname(filePath), { recursive: true });
      const source = Buffer.isBuffer(body) ? Readable.from(body) : body;
      await pipeline(source, createWriteStream(filePath));
      await writeFile(metadataPath(filePath), JSON.stringify({ contentType }));
    },

    get: async (key) => {
      const filePath = resolveKey(key);
      try {
        const [stats, rawMetadata] = await Promise.all([
          stat(filePath),
          readFile(metadataPath(filePath), "utf8").catch(() => null),
        ]);
        const metadata = rawMetadata ? MetadataSchema.safeParse(JSON.parse(rawMetadata)) : null;
        return {
          body: createReadStream(filePath),
          contentType: metadata?.success ? metadata.data.contentType : null,
          contentLength: stats.size,
        };
      } catch (error) {
        if (isMissingFile(error)) return null;
        throw error;
      }
    },

    delete: async (key) => {
      const filePath = resolveKey(key);
      await Promise.all([rm(filePath, { force: true }), rm(metadataPath(filePath), { force: true })]);
    },
  };
};

export const createStorage = (): StorageProvider => {
  const env = loadEnv(localEnvSchema, process.env, "Local storage env");
  return createLocalStorage(env.LOCAL_STORAGE_DIR);
};
