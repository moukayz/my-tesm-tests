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

// .env.local provides developer credentials; .env.test overrides test defaults.
const localEnv = loadEnvFile('.env.local')
const testEnv = { ...localEnv, ...loadEnvFile('.env.test') }

// Ensure test processes use the same env vars as the server (e.g. AUTH_SECRET for JWT signing)
Object.assign(process.env, testEnv)

const webServerUrl = 'http://localhost:3001'
const webServerTimeout = 180_000

export default defineConfig({
  testDir: './__tests__/e2e',
  fullyParallel: true,
  retries: 0,
  timeout: 30_000,
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
    // Always run e2e against production output for stability and parity.
    // Build time is included in webServerTimeout.
    command: 'npm run build && npm start -- -p 3001',
    url: webServerUrl,
    timeout: webServerTimeout,
    env: testEnv,
  },
})
