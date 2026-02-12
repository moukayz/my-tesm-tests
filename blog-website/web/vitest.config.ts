import { defineConfig, configDefaults } from "vitest/config";
import path from "node:path";

const vitestOrigin = process.env.VITEST_ORIGIN ?? "http://example.test";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    environmentOptions: {
      url: vitestOrigin,
    },
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
    clearMocks: true,
    exclude: [...configDefaults.exclude, "e2e/**"],
  },
});
