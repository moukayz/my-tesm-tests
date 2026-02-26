import { test } from 'node:test'
import * as assert from 'node:assert'
import { writeFile, mkdtemp } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { ModelCatalogService } from '../../src/services/model-catalog-service'
import { AppError } from '../../src/domain/errors'

test('model catalog loads from json', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'models-'))
  const filePath = join(dir, 'models.json')
  await writeFile(filePath, JSON.stringify({ models: [{ id: 'a', label: 'A', supports_streaming: true }] }))

  const service = new ModelCatalogService(filePath, 'json')
  const result = await service.listModels()

  assert.equal(result.models.length, 1)
  assert.equal(result.models[0].id, 'a')
  assert.ok(result.updated_at)
})

test('model catalog rejects invalid data', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'models-'))
  const filePath = join(dir, 'models.json')
  await writeFile(filePath, '{"models": ["bad"]}')

  const service = new ModelCatalogService(filePath, 'json')

  await assert.rejects(async () => service.listModels(), (error) => {
    assert.ok(error instanceof AppError)
    return true
  })
})
