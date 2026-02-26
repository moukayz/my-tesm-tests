import path from "node:path";
import { defineConfig } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL;
if (!baseURL) {
  throw new Error("E2E_BASE_URL must be set to run Playwright.");
}

const shouldStartServers = process.env.E2E_SKIP_SERVERS !== "true";

console.log('env E2E_API_URL', process.env.E2E_API_URL);
console.log('env E2E_API_PORT', process.env.E2E_API_PORT);
console.log('env E2E_BASE_URL', process.env.E2E_BASE_URL);
console.log('env E2E_WEB_PORT', process.env.E2E_WEB_PORT);

export default defineConfig({
  testDir: path.join(__dirname, "tests"),
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: shouldStartServers
    ? {
        command: "npm run e2e:servers",
        cwd: __dirname,
        url: baseURL,
        reuseExistingServer: process.env.E2E_REUSE_SERVERS === "true",
        timeout: 120000,
      }
    : undefined,
});
