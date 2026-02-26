import { FastifyPluginAsync } from 'fastify'
import modelRoutes from './api/models'
import streamRoutes from './api/stream'

const api: FastifyPluginAsync = async (fastify) => {
  await fastify.register(modelRoutes)
  await fastify.register(streamRoutes)
}

export default api
