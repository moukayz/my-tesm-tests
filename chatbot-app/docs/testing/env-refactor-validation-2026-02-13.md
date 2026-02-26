# Env Refactor Validation - 2026-02-13

## Scope
- Validate local-dev and E2E env precedence and startup behavior without manual env edits beyond initial setup.
- Run E2E startup + Playwright suite via `scripts/e2e-run.sh`.

## Env Precedence Review
- Web app env loader: `apps/web/.env` (base) -> optional override via `WEB_ENV_OVERRIDE_PATH` -> process env (see `apps/web/scripts/next-with-env.mjs`).
- API app env loader: `apps/api/.env` (base) -> optional override via `API_ENV_OVERRIDE_PATH` -> process env (see `apps/api/scripts/fastify-with-env.mjs`).
- Local-dev script: sources `apps/api/.env`, `apps/web/.env`, then `env/.env.local-dev`; exports `WEB_ENV_PATH` + `WEB_ENV_OVERRIDE_PATH` and runtime overrides (ports, API proxy).
- E2E script: sources `apps/api/.env`, `apps/web/.env`, then `env/.env.e2e-test`; exports `WEB_ENV_PATH` + `WEB_ENV_OVERRIDE_PATH` and runtime overrides (ports, API proxy, E2E URLs).

## Findings
- E2E model fixture contains 1 model, but the Playwright test expects 2 models (`E2E Alpha`, `E2E Beta`), causing a deterministic mismatch.
- E2E streaming tests time out waiting for message completion (assistant messages stay in `data-status="streaming"`). If `MOCK_OPENAI=false` in `env/.env.e2e-test`, the API uses real OpenAI calls; failures may be due to upstream latency or missing streaming completion events.

## E2E Execution
Command:
```bash
cd chatbot-app
./scripts/e2e-run.sh
```

Result: 1 passed, 6 failed.

### Failures
1. `tests/chat.spec.ts:9` - streaming includes thinking and answer
   - Timeout waiting for assistant message `data-status="complete"` (stuck at `streaming`).
2. `tests/chat.spec.ts:20` - edit and resubmit creates a new branch
   - Timeout waiting for assistant message `data-status="complete"` (stuck at `streaming`).
3. `tests/chat.spec.ts:47` - model list loads from config
   - Expected 2 model options, found 1.
4. `tests/chat.spec.ts:58` - friendly error message on streaming failure
   - Error banner not found; expected "The model service is unavailable. Please retry.".
5. `tests/chat.spec.ts:70` - local chat history persists after reload
   - Timeout waiting for assistant message `data-status="complete"`.
6. `tests/chat.spec.ts:84` - clearing storage removes local chat history
   - Timeout waiting for assistant message `data-status="complete"`.

Artifacts are under `chatbot-app/apps/e2e/test-results/*`.

## Notes
- E2E auto-selected ports were logged: API `3004`, Web `3000`, DB `5434`.
- Local-dev script not executed (long-running). Validation performed via script inspection and required env checks.
