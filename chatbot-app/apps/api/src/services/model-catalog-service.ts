import { readFile, stat } from 'node:fs/promises'
import { z } from 'zod'
import yaml from 'yaml'
import { AppError } from '../domain/errors'

const ModelSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional(),
  context_length: z.number().int().positive().optional(),
  supports_streaming: z.boolean(),
  default_temperature: z.number().min(0).max(2).optional()
})

const ModelListSchema = z.union([
  z.array(ModelSchema),
  z.object({
    models: z.array(ModelSchema)
  })
])

export type ModelConfig = z.infer<typeof ModelSchema>

export type ModelListResult = {
  models: ModelConfig[]
  updated_at: string
}

export class ModelCatalogService {
  private cached: ModelListResult | null = null
  private cachedMtime: number | null = null
  private lastLoadedAt = 0

  constructor(private readonly path: string, private readonly format: 'json' | 'yaml') {}

  async listModels(): Promise<ModelListResult> {
    const now = Date.now()
    if (this.cached && this.lastLoadedAt + 5000 > now) {
      return this.cached
    }

    let fileContents: string
    let fileStat
    try {
      fileStat = await stat(this.path)
      fileContents = await readFile(this.path, 'utf-8')
    } catch (error) {
      throw new AppError('MODEL_CONFIG_INVALID', 400, 'The model catalog is unavailable. Please contact support.')
    }

    if (this.cached && this.cachedMtime === fileStat.mtimeMs) {
      this.lastLoadedAt = now
      return this.cached
    }

    let parsed: unknown
    try {
      parsed = this.format === 'yaml' ? yaml.parse(fileContents) : JSON.parse(fileContents)
    } catch (error) {
      throw new AppError('MODEL_CONFIG_INVALID', 400, 'The model catalog could not be loaded. Please try again.')
    }

    const validation = ModelListSchema.safeParse(parsed)
    if (!validation.success) {
      throw new AppError('MODEL_CONFIG_INVALID', 400, 'The model catalog is invalid. Please contact support.')
    }

    const models = Array.isArray(validation.data) ? validation.data : validation.data.models
    const ids = new Set<string>()
    for (const model of models) {
      if (ids.has(model.id)) {
        throw new AppError('MODEL_CONFIG_INVALID', 400, 'The model catalog contains duplicate IDs.')
      }
      ids.add(model.id)
    }

    const result: ModelListResult = {
      models,
      updated_at: fileStat.mtime.toISOString()
    }

    this.cached = result
    this.cachedMtime = fileStat.mtimeMs
    this.lastLoadedAt = now

    return result
  }

  async getModel(modelId: string): Promise<ModelConfig> {
    const { models } = await this.listModels()
    const model = models.find((item) => item.id === modelId)
    if (!model) {
      throw new AppError('MODEL_NOT_FOUND', 422, 'That model is not available right now.')
    }
    return model
  }
}
