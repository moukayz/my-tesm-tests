import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { streamCompletion } from '../../services/streaming-service'

const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1)
})

const chatCompletionSchema = z.object({
  model_id: z.string().min(1),
  messages: z.array(chatMessageSchema).min(1),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().positive().optional()
})

const streamRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/chat/completions:stream', async (request, reply) => {
    const payload = chatCompletionSchema.parse(request.body)

    await streamCompletion({
      openai: fastify.openai,
      modelCatalog: fastify.modelCatalog,
      config: {
        maxMessageChars: fastify.config.maxMessageChars,
        maxPromptChars: fastify.config.maxPromptChars,
        maxHistoryMessages: fastify.config.maxHistoryMessages,
        openaiTimeoutMs: fastify.config.openaiTimeoutMs,
        openaiBaseUrl: fastify.config.openaiBaseUrl,
        openaiApiKey: fastify.config.openaiApiKey,
        mockOpenAI: fastify.config.mockOpenAI
      },
      payload,
      request,
      reply
    })
  })
}

export default streamRoutes
