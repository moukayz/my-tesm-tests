import { defineConfig, devices } from '@playwright/test'
import fs from 'fs'
import path from 'path'

function loadEnvFile(file: string): Record<string, string> {
  try {
    const content = fs.readFileSync(path.join(__dirname, file), 'utf-8')
    return Object.fromEntries(
      content
        .split('\n')
        .filter(line => line.trim() && !line.trim().startsWith('#'))
        .map(line => {
          const idx = line.indexOf('=')
          const key = line.slice(0, idx).trim()
          // Strip inline comments (space + #) but preserve # inside quoted values
          const raw = line.slice(idx + 1).trim()
          const value = raw.startsWith('"') || raw.startsWith("'")
            ? raw.slice(1, raw.lastIndexOf(raw[0]))
            : raw.replace(/\s+#.*$/, '')
          return [key, value]
        })
        .filter(([key]) => key)
    )
  } catch {
    return {}
  }
}

// .env.local provides local credentials (MotherDuck, DB, etc.); .env.test overrides auth settings
const localEnv = loadEnvFile('.env.local')
const testEnv = { ...localEnv, ...loadEnvFile('.env.test') }

// Ensure test processes use the same env vars as the server (e.g. AUTH_SECRET for JWT signing)
Object.assign(process.env, testEnv)

// When MotherDuck is configured, wait for the first API call to complete (absorbs ~80s cold start)
// so all tests start with a warm connection. Without MotherDuck, standard Next.js readiness check.
const hasMotherduck = !!testEnv.MOTHERDUCK_TOKEN
// /api/warmup blocks until the first DuckDB query completes, absorbing the MotherDuck cold start.
// /api/trains uses Promise.allSettled and returns 200 immediately even when DuckDB is still cold.
const webServerUrl = hasMotherduck ? 'http://localhost:3001/api/warmup' : 'http://localhost:3001'
// build (~60s) + MotherDuck warmup (~80s) + buffer = 300s
const webServerTimeout = hasMotherduck ? 300_000 : 120_000

export default defineConfig({
  testDir: './__tests__/e2e',
  // MotherDuck: run tests serially (workers=1) to prevent concurrent DuckDB
  // queries from piling up and hitting per-test timeouts.
  fullyParallel: !hasMotherduck,
  workers: hasMotherduck ? 1 : undefined,
  retries: 0,
  // MotherDuck queries on the 584MB delay parquet take 10-30s per call.
  timeout: hasMotherduck ? 120_000 : 30_000,
  reporter: [['list'], ['html', { open: 'never' }],    ['json', { outputFile: 'test-results.json' }]],
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // Production build avoids per-route JIT compilation overhead on first hit.
    // Build time is included in webServerTimeout.
    command: hasMotherduck ? 'npm run build && npm start -- -p 3001' : 'npm run dev -- -p 3001',
    url: webServerUrl,
    timeout: webServerTimeout,
    env: testEnv,
  },
})
