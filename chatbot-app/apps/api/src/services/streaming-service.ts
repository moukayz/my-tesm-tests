import { FastifyReply, FastifyRequest } from 'fastify'
import OpenAI from 'openai'
import { AppError, toErrorResponse } from '../domain/errors'
import { ModelCatalogService } from './model-catalog-service'
import { formatSseEvent } from '../utils/sse'

type ChatMessage = {
  role: 'user' | 'assistant' | 'system'
  content: string
}

type ChatCompletionPayload = {
  model_id: string
  messages: ChatMessage[]
  temperature?: number
  max_tokens?: number
}

type StreamConfig = {
  maxMessageChars: number
  maxPromptChars: number
  maxHistoryMessages: number
  openaiTimeoutMs: number
  openaiBaseUrl?: string
  openaiApiKey?: string
  mockOpenAI?: boolean
}

export function buildCompletionMessages(
  payload: ChatCompletionPayload,
  config: Pick<StreamConfig, 'maxMessageChars' | 'maxPromptChars' | 'maxHistoryMessages'>
): OpenAI.ChatCompletionMessageParam[] {
  if (payload.messages.length === 0) {
    throw new AppError('VALIDATION_ERROR', 400, 'Please provide at least one message.')
  }

  if (payload.messages.length > config.maxHistoryMessages) {
    throw new AppError('PAYLOAD_TOO_LARGE', 400, 'The conversation context is too long. Please shorten it.')
  }

  let totalChars = 0
  for (const message of payload.messages) {
    if (message.content.length > config.maxMessageChars) {
      throw new AppError('PAYLOAD_TOO_LARGE', 400, 'A message is too large. Please shorten it.')
    }
    totalChars += message.content.length
  }

  if (totalChars > config.maxPromptChars) {
    throw new AppError('PAYLOAD_TOO_LARGE', 400, 'The conversation context is too long. Please shorten it.')
  }

  return payload.messages.map((message) => ({
    role: message.role,
    content: message.content
  }))
}

export async function streamCompletion(params: {
  openai: OpenAI
  modelCatalog: ModelCatalogService
  config: StreamConfig
  payload: ChatCompletionPayload
  request: FastifyRequest
  reply: FastifyReply
}) {
  const { openai, modelCatalog, config, payload, request, reply } = params

  const model = await modelCatalog.getModel(payload.model_id)
  if (!model.supports_streaming) {
    throw new AppError('MODEL_NOT_FOUND', 422, 'That model does not support streaming responses.')
  }

  if (!config.mockOpenAI && (!config.openaiApiKey || !config.openaiBaseUrl)) {
    throw new AppError('MODEL_UNAVAILABLE', 503, 'The model service is not configured yet.')
  }
  console.warn('model', model)
  console.warn('base url', config.openaiBaseUrl)
  console.warn('api key', config.openaiApiKey)

  const messages = buildCompletionMessages(payload, config)

  reply.raw.setHeader('Content-Type', 'text/event-stream')
  reply.raw.setHeader('Cache-Control', 'no-cache')
  reply.raw.setHeader('Connection', 'keep-alive')
  reply.raw.flushHeaders()
  reply.hijack()

  const controller = new AbortController()
  let timedOut = false
  const timeout = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, config.openaiTimeoutMs)
  request.raw.on('close', () => {
    controller.abort()
  })

  let completionId = 'completion_unknown'
  let finishReason = 'stop'

  try {
    const stream = await openai.chat.completions.create(
      {
        model: payload.model_id,
        messages,
        temperature: payload.temperature,
        max_tokens: payload.max_tokens,
        stream: true,
        metadata: { request_id: request.id }
      },
      {
        signal: controller.signal
      }
    )

    for await (const chunk of stream) {
      if (chunk.id) {
        completionId = chunk.id
      }

      const choice = chunk.choices[0]
      if (!choice) {
        continue
      }

      if (choice.finish_reason) {
        finishReason = choice.finish_reason
      }

      const delta = choice.delta
      if (!delta) {
        continue
      }

      const reasoning = (delta as { reasoning?: string }).reasoning
      if (typeof reasoning === 'string' && reasoning.length > 0) {
        reply.raw.write(formatSseEvent('thinking', { token: reasoning }))
        continue
      }

      if (typeof delta.content === 'string' && delta.content.length > 0) {
        reply.raw.write(formatSseEvent('answer', { token: delta.content }))
      }
    }

    reply.raw.write(formatSseEvent('done', {
      completion_id: completionId,
      finish_reason: finishReason
    }))
    reply.raw.end()
  } catch (error) {
    if (controller.signal.aborted) {
      const appError = timedOut
        ? new AppError('STREAM_TIMEOUT', 503, 'The model took too long to respond. Please retry.')
        : new AppError('STREAM_INTERRUPTED', 503, 'The stream was interrupted. Please retry.')
      reply.raw.write(formatSseEvent('error', toErrorResponse(appError, request.id)))
      reply.raw.end()
      return
    }

    if (error instanceof AppError) {
      reply.raw.write(formatSseEvent('error', toErrorResponse(error, request.id)))
      reply.raw.end()
      return
    }

    const appError = new AppError('DEPENDENCY_ERROR', 503, 'The model service is unavailable. Please retry.')
    reply.raw.write(formatSseEvent('error', toErrorResponse(appError, request.id)))
    reply.raw.end()
  } finally {
    clearTimeout(timeout)
  }
}
