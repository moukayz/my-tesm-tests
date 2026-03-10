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
          return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()]
        })
        .filter(([key]) => key)
    )
  } catch {
    return {}
  }
}

const testEnv = loadEnvFile('.env.test')

export default defineConfig({
  testDir: './__tests__/e2e',
  fullyParallel: true,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3000',
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
    command: 'npm run build && npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: testEnv,
  },
})
