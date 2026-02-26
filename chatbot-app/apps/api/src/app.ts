import './env'
import { FastifyPluginAsync, FastifyServerOptions } from 'fastify'
import configPlugin from './plugins/config'
import errorHandlerPlugin from './plugins/error-handler'
import modelCatalogPlugin from './plugins/model-catalog'
import openaiPlugin from './plugins/openai'
import apiRoutes from './routes/api'
import healthRoutes from './routes/health'

export interface AppOptions extends FastifyServerOptions {

}
// Pass --options via CLI arguments in command to enable these options.
const rawBodyLimit = process.env.BODY_LIMIT_BYTES ? Number(process.env.BODY_LIMIT_BYTES) : undefined
const options: AppOptions = {
  bodyLimit: rawBodyLimit && Number.isFinite(rawBodyLimit) ? rawBodyLimit : undefined
}

const app: FastifyPluginAsync<AppOptions> = async (
  fastify,
  opts
): Promise<void> => {
  await fastify.register(configPlugin)
  await fastify.register(modelCatalogPlugin)
  await fastify.register(openaiPlugin)
  await fastify.register(errorHandlerPlugin)

  // Do not touch the following lines

  await fastify.register(apiRoutes, { prefix: '/api/v1' })
  await fastify.register(healthRoutes)
}

export default app
export { app, options }
