import fp from 'fastify-plugin'
import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.string().optional(),
  MODEL_CONFIG_PATH: z.string().min(1),
  MODEL_CONFIG_FORMAT: z.enum(['json', 'yaml']).default('json'),
  base_url: z.string().min(1).optional(),
  api_key: z.string().min(1).optional(),
  MOCK_OPENAI: z.enum(['true', 'false']).optional(),
  MOCK_OPENAI_ERROR_TRIGGER: z.string().optional(),
  BODY_LIMIT_BYTES: z.coerce.number().int().positive().default(1024 * 1024),
  MAX_MESSAGE_CHARS: z.coerce.number().int().positive().default(8000),
  MAX_PROMPT_CHARS: z.coerce.number().int().positive().default(20000),
  MAX_HISTORY_MESSAGES: z.coerce.number().int().positive().default(60),
  OPENAI_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  OPENAI_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2)
})

export type AppConfig = {
  nodeEnv: string
  modelConfigPath: string
  modelConfigFormat: 'json' | 'yaml'
  openaiBaseUrl?: string
  openaiApiKey?: string
  mockOpenAI: boolean
  mockOpenAIErrorTrigger: string
  bodyLimitBytes: number
  maxMessageChars: number
  maxPromptChars: number
  maxHistoryMessages: number
  openaiTimeoutMs: number
  openaiMaxRetries: number
}

export default fp(async (fastify) => {
  const parsed = envSchema.safeParse(process.env)
  if (!parsed.success) {
    const message = parsed.error.errors.map((err) => `${err.path.join('.')}: ${err.message}`).join(', ')
    throw new Error(`Invalid environment configuration: ${message}`)
  }

  const env = parsed.data

  const config: AppConfig = {
    nodeEnv: env.NODE_ENV ?? 'development',
    modelConfigPath: env.MODEL_CONFIG_PATH,
    modelConfigFormat: env.MODEL_CONFIG_FORMAT,
    openaiBaseUrl: env.base_url,
    openaiApiKey: env.api_key,
    mockOpenAI: env.MOCK_OPENAI === 'true',
    mockOpenAIErrorTrigger: env.MOCK_OPENAI_ERROR_TRIGGER ?? '__E2E_STREAM_ERROR__',
    bodyLimitBytes: env.BODY_LIMIT_BYTES,
    maxMessageChars: env.MAX_MESSAGE_CHARS,
    maxPromptChars: env.MAX_PROMPT_CHARS,
    maxHistoryMessages: env.MAX_HISTORY_MESSAGES,
    openaiTimeoutMs: env.OPENAI_TIMEOUT_MS,
    openaiMaxRetries: env.OPENAI_MAX_RETRIES
  }

  fastify.decorate('config', config)
})

declare module 'fastify' {
  interface FastifyInstance {
    config: AppConfig
  }
}
