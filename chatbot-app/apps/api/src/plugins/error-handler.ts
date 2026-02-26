import fp from 'fastify-plugin'
import { ZodError } from 'zod'
import { AppError, toErrorResponse } from '../domain/errors'

export default fp(async (fastify) => {
  fastify.setErrorHandler((error, request, reply) => {
    const requestId = request.id

    if (error instanceof AppError) {
      reply.status(error.status).send(toErrorResponse(error, requestId))
      return
    }

    if (error instanceof ZodError) {
      const details = error.errors.map((err) => ({
        path: err.path.join('.'),
        message: err.message
      }))
      const appError = new AppError('VALIDATION_ERROR', 400, 'Please check the request and try again.', {
        issues: details
      })
      reply.status(appError.status).send(toErrorResponse(appError, requestId))
      return
    }

    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'FST_ERR_CTP_BODY_TOO_LARGE'
    ) {
      const appError = new AppError('PAYLOAD_TOO_LARGE', 400, 'That message is too large. Please shorten it.')
      reply.status(appError.status).send(toErrorResponse(appError, requestId))
      return
    }

    request.log.error({ err: error }, 'Unhandled error')
    const appError = new AppError('INTERNAL_ERROR', 500, 'Something went wrong. Please try again.')
    reply.status(appError.status).send(toErrorResponse(appError, requestId))
  })
})
