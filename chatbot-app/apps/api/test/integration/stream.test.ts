import { test } from 'node:test'
import * as assert from 'node:assert'
import { build } from '../helper'

test('stream completion returns SSE events', async (t) => {
  process.env.MOCK_OPENAI = 'true'
  const app = await build(t)

  const streamRes = await app.inject({
    method: 'POST',
    url: '/api/v1/chat/completions:stream',
    payload: {
      model_id: 'gpt-4o-mini',
      messages: [
        { role: 'user', content: 'Stream this response' }
      ]
    }
  })

  assert.equal(streamRes.statusCode, 200)
  assert.ok(streamRes.headers['content-type']?.includes('text/event-stream'))
  const streamBody = streamRes.payload
  assert.ok(streamBody.includes('event: thinking'))
  assert.ok(streamBody.includes('event: answer'))
  assert.ok(streamBody.includes('event: done'))
})

test('stream rejects oversized message list', async (t) => {
  const app = await build(t)

  const messages = Array.from({ length: 61 }, (_, index) => ({
    role: 'user' as const,
    content: `message-${index}`
  }))

  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/chat/completions:stream',
    payload: {
      model_id: 'gpt-4o-mini',
      messages
    }
  })

  assert.equal(res.statusCode, 400)
  const body = res.json()
  assert.equal(body.error.code, 'PAYLOAD_TOO_LARGE')
})
