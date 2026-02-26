# API Error Model

## Envelope
All error responses use a consistent envelope.

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request payload is invalid.",
    "details": {
      "retryable": true
    },
    "request_id": "req_01HZY9Q7GQW9H4C5F9E5"
  }
}
```

Fields:
- `code`: Stable, machine-readable error identifier.
- `message`: User-friendly message for UI display.
- `details`: Optional structured metadata.
- `request_id`: Correlates logs, traces, and client reports.

## Streaming (SSE) Errors
For `text/event-stream` endpoints, errors are delivered as an SSE terminal event:

```
event: error
data: {"error":{"code":"DEPENDENCY_ERROR","message":"...","request_id":"req_..."}}

```

Rules:
- `event: error` payload MUST be an `ErrorResponse` envelope.
- After `event: error`, the server MUST close the stream (no more events).

## HTTP Status Mapping
- 400: Validation errors, malformed requests, config errors.
- 404: Resource not found.
- 422: Semantic errors (unsupported model).
- 429: Rate limiting (if introduced later).
- 500: Unhandled server errors.
- 503: Upstream dependency failures.

## Error Codes

Validation:
- `VALIDATION_ERROR` (400)
- `PAYLOAD_TOO_LARGE` (400)

Models:
- `MODEL_NOT_FOUND` (422)
- `MODEL_UNAVAILABLE` (503)
- `MODEL_CONFIG_INVALID` (400)

Configuration and Env:
- `CONFIG_MISSING` (400)
- `CONFIG_CONFLICT` (400)
- `ENV_MISSING` (400)
- `ENV_INVALID` (400)

Streaming:
- `STREAM_INTERRUPTED` (503)
- `STREAM_TIMEOUT` (503)

System:
- `INTERNAL_ERROR` (500)
- `DEPENDENCY_ERROR` (503)

## Client Handling Guidance
- Show `message` directly to the user.
- For `MODEL_CONFIG_INVALID`, suggest refresh and retry.
- For `STREAM_INTERRUPTED`, allow retry from last user message.
- For `CONFIG_MISSING` or `ENV_MISSING`, surface a clear admin-facing hint in non-production environments.
- For `CONFIG_CONFLICT`, instruct developers to resolve the precedence order and duplicates.

## Error Details for Config and Env
When relevant, `details` should include:
- `missing_keys`: string[]
- `conflict_keys`: string[]
- `source`: one of `app`, `integrated`, `process`
- `effective_source`: the precedence tier that won
