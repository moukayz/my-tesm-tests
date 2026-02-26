import { FastifyPluginAsync } from 'fastify'

const modelRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/models', async () => {
    const result = await fastify.modelCatalog.listModels()
    return {
      models: result.models,
      updated_at: result.updated_at
    }
  })
}

export default modelRoutes
