# Runbook: Playwright E2E (Local)

This runbook describes how to run the full local E2E stack (Postgres + API + Web) and execute the Playwright suite.

## One-shot launch (canonical QA interface)

Design-level requirement (see `blog-website/docs/hld.md`): QA must have one-shot commands to start the full stack locally with an isolated E2E database.

Canonical entrypoints:

```bash
blog-website/scripts/e2e/up
blog-website/scripts/e2e/test
blog-website/scripts/e2e/down
```

The step-by-step commands below are the underlying primitives.

## Prerequisites

- Docker Desktop (for Postgres)
- Rust toolchain (stable)
- Node.js 20+

## Ports (Defaults for This Runbook)

- Postgres: `127.0.0.1:5434`
- API: `127.0.0.1:3000`
- Web: `127.0.0.1:3001`

## 1) Start Postgres (Docker)

```bash
cd blog-website/api
docker compose -p blog-website-e2e -f docker-compose.e2e.yml down -v || true
docker compose -p blog-website-e2e -f docker-compose.e2e.yml up -d
docker compose -p blog-website-e2e -f docker-compose.e2e.yml exec postgres pg_isready -U blog -d blog_website_e2e
```

Canonical entrypoint (design-level):

```bash
blog-website/scripts/e2e/db-up
```

Invariants (why this exists):

- E2E uses a separate Docker deployment (distinct Compose project + volume) from local dev.
- E2E uses a different database name (`blog_website_e2e`) from dev to prevent accidental cross-targeting.

## 2) Start API

The API runs migrations automatically on startup.

```bash
cd blog-website/api
DATABASE_URL='postgres://blog:blog@127.0.0.1:5434/blog_website_e2e' \
API_BIND='127.0.0.1:3000' \
SESSION_COOKIE_SECURE=false \
RUST_LOG='info,tower_http=info,sqlx=warn' \
CURSOR_HMAC_SECRET='dev-insecure-change-me' \
cargo run
```

Canonical entrypoint (design-level):

```bash
blog-website/scripts/e2e/api
```

Quick check:

```bash
curl -sS http://127.0.0.1:3000/v1/auth/session
```

## 3) Start Web

The web app calls relative URLs like `/v1/posts`; in local dev, Next.js rewrites `/v1/*` to `API_ORIGIN`.

```bash
cd blog-website/web
npm install
npm run gen:openapi
API_ORIGIN='http://127.0.0.1:3000' npm run dev
```

Canonical entrypoint (design-level):

```bash
blog-website/scripts/e2e/web
```

Quick check:

```bash
curl -I http://127.0.0.1:3001/posts
```

## 4) Run Playwright E2E

```bash
cd blog-website/web
npm run e2e:install
E2E_BASE_URL='http://127.0.0.1:3001' \
E2E_API_ORIGIN='http://127.0.0.1:3000' \
npx playwright test --config playwright.config.ts
```

Canonical entrypoint (design-level):

```bash
blog-website/scripts/e2e/test
```

Artifacts:

- `blog-website/web/test-results/`
- `blog-website/web/playwright-report/`
