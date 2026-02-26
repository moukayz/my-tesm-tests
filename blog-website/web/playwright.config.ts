import { defineConfig, devices } from "@playwright/test";
import { loadEnvFiles, requireEnv } from "./scripts/env-loader";

loadEnvFiles([".env.e2e", ".env.app"], __dirname);

const baseURL = requireEnv("E2E_BASE_URL", "Set it in blog-website/web/.env.e2e or CI env.");

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    headless: true,
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
