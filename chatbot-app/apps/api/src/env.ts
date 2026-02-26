import path from 'node:path'
import { existsSync, readFileSync } from 'node:fs'
import dotenv from 'dotenv'

const defaultEnvPath = path.join(__dirname, '..', '.env')
const envPath = process.env.API_ENV_PATH ?? defaultEnvPath
const overridePath = process.env.API_ENV_OVERRIDE_PATH

const loadEnvFile = (filePath: string) => {
  if (!existsSync(filePath)) {
    throw new Error(`API env file not found at ${filePath}.`)
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
