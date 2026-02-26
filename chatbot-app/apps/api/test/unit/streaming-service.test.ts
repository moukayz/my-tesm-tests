import { test } from 'node:test'
import * as assert from 'node:assert'
import { buildCompletionMessages } from '../../src/services/streaming-service'
import { AppError } from '../../src/domain/errors'

test('buildCompletionMessages accepts valid context', () => {
  const messages = buildCompletionMessages({
    model_id: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Hello' }
    ]
  }, {
    maxMessageChars: 100,
    maxPromptChars: 500,
    maxHistoryMessages: 10
  })

  assert.equal(messages.length, 2)
  assert.equal(messages[0].role, 'system')
})

test('buildCompletionMessages rejects oversized content', () => {
  assert.throws(() => {
    buildCompletionMessages({
      model_id: 'gpt-4o-mini',
      messages: [
        { role: 'user', content: 'a'.repeat(11) }
      ]
    }, {
      maxMessageChars: 10,
      maxPromptChars: 500,
      maxHistoryMessages: 10
    })
  }, (error) => {
    assert.ok(error instanceof AppError)
    return (error as AppError).code === 'PAYLOAD_TOO_LARGE'
  })
})
