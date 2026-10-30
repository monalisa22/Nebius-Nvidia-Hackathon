import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    pool: "threads",
    maxWorkers: 1,
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
