// The storage provider is chosen by `pnpm setup:project`.
// @setup-select storage
export { createStorage } from "./providers/local/index.ts";
export type { PresignedUpload, PutObjectInput, StorageProvider, StoredObject } from "./types.ts";
