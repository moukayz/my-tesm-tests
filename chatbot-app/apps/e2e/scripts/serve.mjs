import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import waitOn from "wait-on";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..", "..");
const apiDir = path.join(repoRoot, "apps", "api");
const webDir = path.join(repoRoot, "apps", "web");

const baseUrl = process.env.E2E_BASE_URL;
const apiUrl = process.env.E2E_API_URL;

if (!baseUrl) {
  throw new Error("E2E_BASE_URL must be set for the E2E server runner.");
}

if (!apiUrl) {
  throw new Error("E2E_API_URL must be set for the E2E server runner.");
}

const apiPort = new URL(apiUrl).port || process.env.E2E_API_PORT;
if (!apiPort) {
  throw new Error("E2E_API_PORT must be set when E2E_API_URL has no port.");
}

console.log('api port', apiPort);

const apiProcess = spawn("npm", ["--prefix", apiDir, "run", "dev"], {
  stdio: "inherit",
  env: {
    ...process.env,
    PORT: apiPort,
    FASTIFY_PORT: apiPort,
  },
});

const webPort = new URL(baseUrl).port || process.env.E2E_WEB_PORT;
if (!webPort) {
  throw new Error("E2E_WEB_PORT must be set when E2E_BASE_URL has no port.");
}

console.log('web port', webPort);

const webProcess = spawn("npm", ["--prefix", webDir, "run", "dev"], {
  stdio: "inherit",
  env: {
    ...process.env,
    PORT: webPort,
  },
});

const shutdown = () => {
  apiProcess.kill("SIGTERM");
  webProcess.kill("SIGTERM");
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
process.on("exit", shutdown);

await waitOn({
  resources: [baseUrl, new URL("/health", apiUrl).toString()],
  timeout: 120000,
});

await new Promise(() => {});
