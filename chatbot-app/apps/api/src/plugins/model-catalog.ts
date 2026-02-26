import fp from 'fastify-plugin'
import { ModelCatalogService } from '../services/model-catalog-service'

export default fp(async (fastify) => {
  const service = new ModelCatalogService(
    fastify.config.modelConfigPath,
    fastify.config.modelConfigFormat
  )

  fastify.decorate('modelCatalog', service)
})

declare module 'fastify' {
  interface FastifyInstance {
    modelCatalog: ModelCatalogService
  }
}
