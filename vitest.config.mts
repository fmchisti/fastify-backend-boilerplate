import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts", "packages/*/test/**/*.test.ts"],
    setupFiles: ["test/setup.ts"],
    restoreMocks: true,
    typecheck: {
      enabled: true,
      include: ["test/**/*.test-d.ts"],
    },
  },
});
