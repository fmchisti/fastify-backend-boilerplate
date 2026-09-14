import { readFileSync } from "node:fs";
import { z } from "zod";

// src/config and dist/config are both two levels below package.json
const packageJson = z
  .object({ name: z.string(), version: z.string() })
  .parse(JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")));

export const APP_NAME = packageJson.name;
export const APP_VERSION = packageJson.version;
