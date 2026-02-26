import { FastifyPluginAsync } from 'fastify'

const health: FastifyPluginAsync = async (fastify) => {
  fastify.get('/health', async () => {
    return { ok: true }
  })
}

export default health
