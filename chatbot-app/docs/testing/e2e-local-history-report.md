# E2E Report: Local-Only Chat History + Streaming

Date: 2026-02-13
Runner: `./scripts/e2e-run.sh`

## Scope
- No-login access
- Local history persistence across reload
- Local history loss after storage clear
- Model list fetch
- Streaming thinking/answer
- Streaming error handling

## Environment
- Config: `env/.env.e2e-test` (MOCK_OPENAI=true)
- Base URL: `http://localhost:3000`
- API URL: `http://localhost:3002`

## Results
- Status: Failed
- Tests executed: 7
- Tests passed: 0
- Tests failed: 7

## Failures
1) `tests/auth.spec.ts` - app is accessible without login
   - Failure: `new-chat-button` not visible after navigating to `/app`.
   - Console: Next.js proxy errors for `http://localhost:3002/api/v1/auth/session` with `ECONNREFUSED`.

2) `tests/chat.spec.ts` - streaming includes thinking and answer
   - Failure: `new-chat-button` not visible (same root cause as above).

3) `tests/chat.spec.ts` - edit and resubmit creates a new branch
   - Failure: `new-chat-button` not visible (same root cause as above).

4) `tests/chat.spec.ts` - model list loads from config
   - Failure: `new-chat-button` not visible (same root cause as above).

5) `tests/chat.spec.ts` - friendly error message on streaming failure
   - Failure: `new-chat-button` not visible (same root cause as above).

6) `tests/chat.spec.ts` - local chat history persists after reload
   - Failure: `new-chat-button` not visible (same root cause as above).

7) `tests/chat.spec.ts` - clearing storage removes local chat history
   - Failure: `new-chat-button` not visible (same root cause as above).

## Defects / Gaps
- App UI does not render at `/app` when the session API is unreachable. The auth gate returns null on missing session data, blocking no-login access.
- API server not reachable at `http://localhost:3002` during E2E run (ECONNREFUSED). This blocks all UI tests and indicates the backend did not start or was not listening on the expected port.

## Artifacts
- Playwright traces/screenshots are under `apps/e2e/test-results/`.

## Minimal Repro
1. `cd chatbot-app`
2. `./scripts/e2e-run.sh`
3. Observe `ECONNREFUSED` proxy errors to `http://localhost:3002/api/v1/auth/session` and tests failing due to missing `new-chat-button`.
