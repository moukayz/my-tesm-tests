export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'PAYLOAD_TOO_LARGE'
  | 'MODEL_NOT_FOUND'
  | 'MODEL_UNAVAILABLE'
  | 'MODEL_CONFIG_INVALID'
  | 'STREAM_INTERRUPTED'
  | 'STREAM_TIMEOUT'
  | 'INTERNAL_ERROR'
  | 'DEPENDENCY_ERROR'

export class AppError extends Error {
  readonly code: ErrorCode
  readonly status: number
  readonly details?: Record<string, unknown>

  constructor(code: ErrorCode, status: number, message: string, details?: Record<string, unknown>) {
    super(message)
    this.code = code
    this.status = status
    this.details = details
  }
}

export type ErrorResponse = {
  error: {
    code: ErrorCode
    message: string
    details?: Record<string, unknown>
    request_id: string
  }
}

export function toErrorResponse(error: AppError, requestId: string): ErrorResponse {
  return {
    error: {
      code: error.code,
      message: error.message,
      details: error.details,
      request_id: requestId
    }
  }
}
