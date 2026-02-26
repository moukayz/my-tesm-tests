import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..", "..", "..");
const defaultEnvPath = resolve(repoRoot, "apps", "web", ".env");

const basePath = process.env.WEB_ENV_PATH ?? defaultEnvPath;
const overridePath = process.env.WEB_ENV_OVERRIDE_PATH;

console.log("base env path", basePath);
console.log("override env path", overridePath);

const loadEnvFile = (filePath) => {
  if (!existsSync(filePath)) {
    throw new Error(`Env file not found at ${filePath}.`);
  }

  return dotenv.parse(readFileSync(filePath));
};

const baseEnv = loadEnvFile(basePath);
const overrideEnv = overridePath ? loadEnvFile(overridePath) : {};
const mergedEnv = { ...baseEnv, ...overrideEnv, ...process.env };

for (const [key, value] of Object.entries(mergedEnv)) {
  if (typeof value === "string") {
    process.env[key] = value;
  }
}

console.log("web port", process.env.WEB_PORT);
console.log("api proxy target", process.env.API_PROXY_TARGET);
console.log("next public api base url", process.env.NEXT_PUBLIC_API_BASE_URL);

if (!process.env.PORT && process.env.WEB_PORT) {
  process.env.PORT = process.env.WEB_PORT;
}

const nextArgs = process.argv.slice(2);
if (nextArgs.length === 0) {
  throw new Error("Missing Next.js command arguments.");
}

const child = spawn("next", nextArgs, {
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
