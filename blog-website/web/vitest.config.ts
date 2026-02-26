import { defineConfig, configDefaults } from "vitest/config";
import path from "node:path";
import { loadEnvFiles, requireEnv } from "./scripts/env-loader";

loadEnvFiles([".env.local", ".env.app"], __dirname);

const vitestOrigin = requireEnv("VITEST_ORIGIN", "Set it in blog-website/web/.env.app or CI env.");

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
