import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const defaultEnvPath = path.join(__dirname, '..', '.env')
const envPath = process.env.API_ENV_PATH ?? defaultEnvPath
const overridePath = process.env.API_ENV_OVERRIDE_PATH

const loadEnvFile = (filePath) => {
  if (!existsSync(filePath)) {
    console.error(`API env file not found at ${filePath}.`)
    process.exit(1)
  }
  return dotenv.parse(readFileSync(filePath))
}

const baseEnv = loadEnvFile(envPath)
const overrideEnv = overridePath ? loadEnvFile(overridePath) : {}
const mergedEnv = { ...baseEnv, ...overrideEnv, ...process.env }

for (const [key, value] of Object.entries(mergedEnv)) {
  if (typeof value === 'string') {
    process.env[key] = value
  }
}

if (!process.env.PORT && process.env.API_PORT) {
  process.env.PORT = process.env.API_PORT
}

const port = process.env.PORT ?? process.env.API_PORT ?? process.env.FASTIFY_PORT
if (!port) {
  console.error('API_PORT or PORT must be set in the API env file or the process environment.')
  process.exit(1)
}

const args = process.argv.slice(2)
const hasPortArg = args.some((arg) => arg === '-p' || arg === '--port' || arg.startsWith('--port='))
const finalArgs = hasPortArg ? args : [...args, '-p', port]

const child = spawn('fastify', finalArgs, {
  stdio: 'inherit',
  env: process.env
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 1)
})
