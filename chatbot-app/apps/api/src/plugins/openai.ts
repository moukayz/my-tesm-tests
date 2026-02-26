import fp from 'fastify-plugin'
import OpenAI from 'openai'

type MockStreamChunk = {
  id?: string
  choices: Array<{
    delta: {
      content?: string
      reasoning?: string
    }
    finish_reason?: string | null
  }>
}

const buildMockStream = async function* (
  thinkingTokens: string[],
  answerTokens: string[],
  completionId: string
): AsyncIterable<MockStreamChunk> {
  for (const token of thinkingTokens) {
    yield { id: completionId, choices: [{ delta: { reasoning: token } }] }
  }
  for (const token of answerTokens) {
    yield { id: completionId, choices: [{ delta: { content: token } }] }
  }
  yield { id: completionId, choices: [{ delta: {}, finish_reason: 'stop' }] }
}

export default fp(async (fastify) => {
  const client = fastify.config.mockOpenAI
    ? (({
        chat: {
          completions: {
            create: async (payload: { messages?: Array<{ role: string; content: string }> }) => {
              const messages = payload.messages ?? []
              const lastMessage = messages[messages.length - 1]
              if (lastMessage?.content?.includes(fastify.config.mockOpenAIErrorTrigger)) {
                throw new Error('Mock stream failure')
              }

              const thinkingTokens = ['Thinking', ' about', ' your', ' request.']
              const answerTokens = ['Here is', ' a mock', ' streaming', ' response.']
              return buildMockStream(thinkingTokens, answerTokens, 'mock-completion-1')
            }
          }
        }
      }) as unknown as OpenAI)
    : new OpenAI({
        apiKey: fastify.config.openaiApiKey ?? '',
        baseURL: fastify.config.openaiBaseUrl,
        timeout: fastify.config.openaiTimeoutMs,
        maxRetries: fastify.config.openaiMaxRetries
      })

  fastify.decorate('openai', client)
})

declare module 'fastify' {
  interface FastifyInstance {
    openai: OpenAI
  }
}
