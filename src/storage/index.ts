// The storage provider is chosen by `pnpm setup:project`.
export { createStorage } from "./providers/local/index.ts"; // @setup-select storage
export type { PresignedUpload, PutObjectInput, StorageProvider, StoredObject } from "./types.ts";
