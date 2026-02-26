import { test } from 'node:test'
import * as assert from 'node:assert'
import { build } from '../helper'

test('list models returns catalog', async (t) => {
  const app = await build(t)

  const modelsRes = await app.inject({
    method: 'GET',
    url: '/api/v1/models'
  })

  assert.equal(modelsRes.statusCode, 200)
  const modelsBody = modelsRes.json()
  assert.ok(Array.isArray(modelsBody.models))
  assert.ok(modelsBody.models.some((model: { id: string }) => model.id === 'gpt-4o-mini'))
})
