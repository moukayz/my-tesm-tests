# Runbook: Chatbot App

## Overview
- Frontend app: `chatbot-app/apps/web`
- Stack: Next.js App Router, React, TypeScript, Tailwind, React Query, Zustand
- Backend app: `chatbot-app/apps/api`
- Stack: Fastify, TypeScript, SSE (stateless, no database)
- Chat history: stored locally in browser IndexedDB (`chatbot-app`), no login flow

## Local Development
```bash
cd chatbot-app/apps/web
npm install
# Edit chatbot-app/apps/web/.env for API routing
npm run dev
```

Open the web app at the configured host/port.

Backend (API):
```bash
cd chatbot-app/apps/api
npm install
# Edit apps/api/.env with your real values (base_url, api_key, API_PORT)
npm run dev
```

One-stop local dev (web + API):
```bash
cd chatbot-app
chmod +x scripts/dev-local.sh
./scripts/dev-local.sh
```

The dev script loads `apps/api/.env` and `apps/web/.env`, applies `env/.env.local-dev` overrides, auto-selects free ports by incrementing from configured values, and reports the chosen ports.

## Environment Variables
- `WEB_PORT` (required for local web dev)
  - Port for the Next.js dev server.
- `API_PROXY_TARGET` (optional)
  - Base URL for the API server used by Next.js rewrites.
- `NEXT_PUBLIC_API_BASE_URL` (optional)
  - Default: `/api/v1`.
  - Set this to point at a non-default API host (e.g. `https://api.example.com/api/v1`).
- `WEB_ENV_PATH` (optional)
  - Defaults to `chatbot-app/apps/web/.env` when using `npm run dev` in `apps/web`.
- `WEB_ENV_OVERRIDE_PATH` (optional)
  - Optional override file layered after `WEB_ENV_PATH` (e.g. `env/.env.local-dev`).

Env files and precedence (lowest to highest):
1. App-specific env files
   - `chatbot-app/apps/web/.env`
   - `chatbot-app/apps/api/.env`
2. Integrated override env files (one active per run mode)
   - `chatbot-app/env/.env.local-dev`
   - `chatbot-app/env/.env.e2e-test`
3. Process environment (CI/CD or shell overrides)

Backend:
- `API_PORT` (required for local API dev)
  - Port for the Fastify server (defaults via `apps/api/.env`).
- `chatbot-app/apps/api/.env`
  - Edit with `base_url`, `api_key`, and the default `API_PORT`.
- `API_ENV_PATH` (optional)
  - Defaults to `chatbot-app/apps/api/.env` when using `npm run dev` in `apps/api`.
- `API_ENV_OVERRIDE_PATH` (optional)
  - Optional override file layered after `API_ENV_PATH` (e.g. `env/.env.local-dev`).
- `MODEL_CONFIG_PATH` (required)
  - Path to model catalog file (JSON or YAML).
- `MODEL_CONFIG_FORMAT` (optional)
  - `json` (default) or `yaml`.
- `base_url` (required for streaming)
  - OpenAI-compatible base URL.
- `api_key` (required for streaming)
  - OpenAI-compatible API key.
- `MOCK_OPENAI` (optional)
  - `true` to use the mock streaming provider (skips external OpenAI calls).
- `MOCK_OPENAI_ERROR_TRIGGER` (optional)
  - Message substring that forces the mock streamer to fail.
- `BODY_LIMIT_BYTES` (optional)
  - Default: `1048576`.
- `MAX_MESSAGE_CHARS` (optional)
  - Default: `8000`.
- `MAX_PROMPT_CHARS` (optional)
  - Default: `20000`.
- `MAX_HISTORY_MESSAGES` (optional)
  - Default: `60`.
- `OPENAI_TIMEOUT_MS` (optional)
  - Default: `30000`.
- `OPENAI_MAX_RETRIES` (optional)
  - Default: `2`.

## Tests
Unit tests:
```bash
cd chatbot-app/apps/web
npm run test:unit
```

Integration tests:
```bash
cd chatbot-app/apps/web
npm run test:integration
```

Backend unit tests:
```bash
cd chatbot-app/apps/api
npm run test:unit
```

Backend integration tests:
```bash
cd chatbot-app/apps/api
npm run test:integration
```

E2E tests (Playwright):
```bash
cd chatbot-app/apps/e2e
npm install
npx playwright install
```

One-stop E2E run (launches web/API, runs tests):
```bash
cd chatbot-app
chmod +x scripts/e2e-run.sh
./scripts/e2e-run.sh
```

The E2E script loads `apps/api/.env` and `apps/web/.env`, applies `env/.env.e2e-test` overrides, auto-selects free ports, and reports the chosen ports.

## Troubleshooting
- For streaming issues, verify the API supports `text/event-stream` responses at `/chat/completions:stream`.
- If the model list fails, check that `MODEL_CONFIG_PATH` points to a readable file with unique model IDs.
- If SSE fails, verify `base_url` and `api_key` are set and the model supports streaming.
- If chat history looks stale, use the "Clear history" button in the sidebar or clear site data in the browser.
