#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+############################################
# E2E Test Stability Contract (2026-02)

This document defines the minimal cross-end behavior contracts required for Playwright E2E stability (see `chatbot-app/docs/feature-brief.md`).

## Streaming Completion Contract

### Scope
- Endpoint: `POST /api/v1/chat/completions:stream` (SSE)
- UI observable: assistant message DOM node `[data-testid="message-item"][data-role="assistant"]` transitions `data-status` from `streaming` to a terminal state.

### Terminal State Definitions (UI)
- `data-status="streaming"`: the assistant message is still receiving tokens.
- `data-status="complete"`: the stream is finished successfully; no more tokens will be appended.
- `data-status="error"`: the stream ended with an error; partial output may be shown.
- `data-status="cancelled"` (optional): the user/navigation cancelled the stream.

### What Causes `complete`
The UI MUST set the assistant message to `data-status="complete"` when either condition occurs:

1) **Normative completion signal**: an SSE event `event: done` is received.
2) **Fallback completion signal**: the SSE response reaches a clean end-of-stream (EOF) after at least one SSE event has been processed and no `event: error` has been received.

Notes:
- The fallback exists specifically to prevent stuck `streaming` state if a mock/server closes the stream without a terminal `done` event.
- If the stream ends before any SSE event is processed, the UI SHOULD treat it as `error` (maps to `STREAM_INTERRUPTED`).

### SSE Event Invariants (Server + Mocks)
For every successful `200 text/event-stream` response:
- The stream MUST contain exactly one terminal event, either `event: done` or `event: error`.
- A `done` terminal event MUST be the last event and MUST be followed by closing the HTTP response.
- After `event: error`, the server MUST close the response (no additional events).
- Non-terminal events MAY be emitted zero or more times before the terminal event:
  - `event: thinking` with `data: {"token": string}`
  - `event: answer` with `data: {"token": string}`

### `done` Payload Contract
`event: done` MUST include:
```json
{ "completion_id": "string", "finish_reason": "string" }
```

Additional rules:
- `completion_id` MUST be stable for the stream.
- `finish_reason` MUST be a non-empty string (typical values: `stop`, `length`).

### Error Event Contract (E2E-Relevant)
`event: error` MUST contain an `ErrorResponse` as defined in `chatbot-app/docs/api/error-model.md`.

For the E2E error trigger path:
- When the last user message includes the configured trigger (default `__E2E_STREAM_ERROR__`), the mock/provider MUST cause the stream to emit `event: error` such that the UI renders an error notice containing the exact text:
  - `The model service is unavailable. Please retry.`

## Model List Contract (E2E Environment)

### Source of Truth
- E2E config file: `chatbot-app/apps/e2e/fixtures/models.e2e.json`
- E2E env wiring: `chatbot-app/env/.env.e2e-test` sets `MODEL_CONFIG_PATH=../e2e/fixtures/models.e2e.json`.

In E2E runs, `GET /api/v1/models` MUST reflect the contents of `models.e2e.json` (subject only to schema validation).

### Schema Expectations
The file at `chatbot-app/apps/e2e/fixtures/models.e2e.json` MUST be a JSON object:
```json
{
  "models": [
    {
      "id": "string",
      "label": "string",
      "supports_streaming": true,
      "description": "string?",
      "context_length": 128000,
      "default_temperature": 0.7
    }
  ]
}
```

Validation requirements:
- `models` MUST be present and be an array.
- Each model MUST have unique `id`.
- Each model MUST have `supports_streaming: true` for use in streaming tests.

### What “2 Models” Means
To satisfy the Playwright test `chat-model-list-loads-from-config`, the E2E model list MUST contain exactly two user-visible model options.

Required semantics:
- `models.length == 2`.
- The two models MUST have labels that render as:
  - `E2E Alpha`
  - `E2E Beta`

Order for determinism:
- The fixture SHOULD list Alpha then Beta, and `GET /models` SHOULD preserve that order.

If additional models are desired for E2E in the future, the Playwright assertion must be updated in the same change.
