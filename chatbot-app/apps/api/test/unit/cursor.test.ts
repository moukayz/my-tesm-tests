import { test } from 'node:test'
import * as assert from 'node:assert'
import { decodeCursor, encodeCursor } from '../../src/utils/cursor'

test('cursor encodes and decodes', () => {
  const now = new Date('2026-02-12T12:00:00.000Z')
  const encoded = encodeCursor({ createdAt: now, id: 'abc' })
  const decoded = decodeCursor(encoded)

  assert.ok(decoded)
  assert.equal(decoded?.id, 'abc')
  assert.equal(decoded?.createdAt.toISOString(), now.toISOString())
})

test('cursor decode fails for invalid string', () => {
  const decoded = decodeCursor('not-valid')
  assert.equal(decoded, null)
})
