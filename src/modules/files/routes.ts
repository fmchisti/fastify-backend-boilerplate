import fastifyMultipart from "@fastify/multipart";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { authenticate, getAuthUser } from "../../auth/middleware.ts";
import { loadEnv } from "../../config/env.ts";
import { HttpError } from "../../lib/errors.ts";
import type { StorageProvider } from "../../storage/index.ts";
import { CreateUploadUrlSchema, DeleteFileSchema, DownloadFileSchema, UploadFileSchema } from "./schema.ts";
import { createFilesService, type FilesConfig, isContentTypeAllowed } from "./service.ts";

const filesEnvSchema = z.object({
  UPLOAD_MAX_FILE_SIZE_MB: z.coerce.number<string>().positive().default(10),
  // SVG and HTML are excluded by default: they can run scripts when opened in a browser
  UPLOAD_ALLOWED_CONTENT_TYPES: z
    .string()
    .default("image/png,image/jpeg,image/webp,image/gif,application/pdf")
    .transform((value) =>
      value
        .split(",")
        .map((type) => type.trim().toLowerCase())
        .filter(Boolean),
    ),
  UPLOAD_URL_EXPIRES_IN_SECONDS: z.coerce.number<string>().int().positive().default(300),
});

export const loadFilesConfig = (source: NodeJS.ProcessEnv = process.env): FilesConfig => {
  const env = loadEnv(filesEnvSchema, source, "file upload env");
  return {
    maxFileSizeBytes: Math.floor(env.UPLOAD_MAX_FILE_SIZE_MB * 1024 * 1024),
    allowedContentTypes: env.UPLOAD_ALLOWED_CONTENT_TYPES,
    uploadUrlExpiresInSeconds: env.UPLOAD_URL_EXPIRES_IN_SECONDS,
  };
};

// Only these are rendered inline; everything else downloads, so it cannot execute in our origin
const INLINE_CONTENT_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export interface FileRoutesOptions {
  storage: StorageProvider;
  config?: FilesConfig;
}

const tags = { tags: ["Files"], security: [{ bearerAuth: [] }] };

const fileRoutes: FastifyPluginAsyncZod<FileRoutesOptions> = async (fastify, options) => {
  const config = options.config ?? loadFilesConfig();
  const service = createFilesService(options.storage, config);

  await fastify.register(fastifyMultipart, {
    limits: { fileSize: config.maxFileSizeBytes, files: 1 },
  });
  fastify.addHook("onRequest", authenticate);

  fastify.route({
    method: "POST",
    url: "/files",
    schema: {
      ...UploadFileSchema,
      ...tags,
      summary: "Upload a file",
      description: "multipart/form-data with a single `file` field.",
    },
    handler: async (request, reply) => {
      const file = await request.file();
      if (!file) throw new HttpError(400, "Missing file field");

      const uploaded = await service.upload(getAuthUser(request).id, {
        filename: file.filename,
        contentType: file.mimetype,
        stream: file.file,
      });
      // The stream is truncated (not errored) when it hits the size limit
      if (file.file.truncated) {
        await options.storage.delete(uploaded.key);
        throw new HttpError(413, `File exceeds ${config.maxFileSizeBytes} bytes`);
      }
      return reply.status(201).send(uploaded);
    },
  });

  fastify.route({
    method: "POST",
    url: "/files/upload-url",
    schema: {
      ...CreateUploadUrlSchema,
      ...tags,
      summary: "Create a presigned upload URL",
      description:
        "Upload directly to the bucket with the returned method and headers. Not supported by local storage.",
    },
    handler: async (request) => service.createUploadUrl(getAuthUser(request).id, request.body),
  });

  fastify.route({
    method: "GET",
    url: "/files/*",
    schema: { ...DownloadFileSchema, ...tags, summary: "Download a file" },
    handler: async (request, reply) => {
      const object = await service.download(getAuthUser(request).id, request.params["*"]);
      const contentType = object.contentType ?? "application/octet-stream";
      const inline = isContentTypeAllowed(contentType, INLINE_CONTENT_TYPES);

      reply
        .header("content-type", inline ? contentType : "application/octet-stream")
        .header("x-content-type-options", "nosniff")
        .header("content-disposition", inline ? "inline" : "attachment");
      if (object.contentLength !== null) reply.header("content-length", object.contentLength);
      return reply.send(object.body);
    },
  });

  fastify.route({
    method: "DELETE",
    url: "/files/*",
    schema: { ...DeleteFileSchema, ...tags, summary: "Delete a file" },
    handler: async (request, reply) => {
      await service.delete(getAuthUser(request).id, request.params["*"]);
      return reply.status(204).send(null);
    },
  });
};

export default fileRoutes;
