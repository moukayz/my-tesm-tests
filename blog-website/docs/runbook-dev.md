# Dev Runbook: Blog Website API (Local)

Last updated: 2026-02-12

This runbook describes how to run the backend locally with Postgres, apply migrations, and run backend tests.

It is written to match the backend LLD in `blog-website/docs/backend-lld.md`.

## One-stop launch (canonical DX interface)

Design-level requirement (see `blog-website/docs/hld.md`): backend must provide a one-stop command that starts the API with the correct env loaded.

Canonical entrypoint:

```bash
blog-website/scripts/dev/api
```

Full local dev stack (DB + API + Web): follow `blog-website/docs/runbook-one-command.md`.

Notes:

- This wrapper is responsible for loading `blog-website/api/.env` (created from `blog-website/api/.env.example`) and then running `cargo run`.
- The underlying "manual" commands in this runbook remain valid, but the wrapper is the supported interface for day-to-day use and for QA automation.

## Prerequisites
- Rust toolchain (stable)
- Docker Desktop (recommended for local Postgres)

## Environment Variables
Proposed environment variables for the API process:

- `DATABASE_URL` (required)
  - Example: `postgres://blog:blog@localhost:5432/blog_website`
- `RUST_LOG` (optional)
  - Example: `info,tower_http=info,sqlx=warn`
- `API_BIND` (optional)
  - Example: `127.0.0.1:3000`
- `SESSION_COOKIE_SECURE` (optional)
  - `false` for local http, `true` for production https
- `SESSION_ABSOLUTE_TTL_SECONDS` (optional)
  - Default recommendation: `604800` (7 days)
- `SESSION_IDLE_TTL_SECONDS` (optional)
  - Default recommendation: `86400` (24 hours)
- `CURSOR_HMAC_SECRET` (optional but recommended if cursor signing is implemented)
- `AUTH_RATE_LIMIT_PER_MINUTE` (optional)
  - Default: `20`
- `CSRF_TOKEN_BYTES` (optional)
  - Default recommendation: `32`

## Local Postgres (Docker)
If you do not already have Postgres running, start one via Docker.

Example command (no compose file required):

```bash
docker run --name blog-website-postgres-dev \
  -e POSTGRES_USER=blog \
  -e POSTGRES_PASSWORD=blog \
  -e POSTGRES_DB=blog_website \
  -v blog-website-postgres-dev-data:/var/lib/postgresql/data \
  -p 5432:5432 \
  -d postgres:16
```

Alternatively, from `blog-website/api/` you can use the included compose file:

```bash
docker compose -p blog-website-dev up -d
```

Canonical entrypoint (design-level):

```bash
blog-website/scripts/dev/db-up
```

Notes:

- Dev DB host port defaults to `5432` but can be overridden via `DEV_DB_PORT`.
- If `5432` is busy, `blog-website/scripts/dev/db-up` auto-picks the next free port and records it under `blog-website/.dev/` so `blog-website/scripts/dev/api` stays in sync without editing `.env`.

Notes:

- Use a dedicated Compose project name (`-p blog-website-dev`) so the dev DB can run concurrently with the E2E DB stack.
- The E2E stack must use a separate Docker deployment (containers + volumes) and a different database name; see `blog-website/docs/runbook-e2e.md`.

To stop/remove later:

```bash
docker stop blog-website-postgres-dev
docker rm blog-website-postgres-dev
```

## Migrations
The backend uses SQLx migrations (recommended location: `blog-website/api/migrations/`).

Install SQLx CLI (one-time):

```bash
cargo install sqlx-cli --no-default-features --features postgres
```

Run migrations:

```bash
export DATABASE_URL=postgres://blog:blog@localhost:5432/blog_website
sqlx migrate run --source blog-website/api/migrations
```

Create a new migration:

```bash
sqlx migrate add -r <name> --source blog-website/api/migrations
```

## Running the API
Run the API binary from the crate directory:

```bash
export DATABASE_URL=postgres://blog:blog@localhost:5432/blog_website
export SESSION_COOKIE_SECURE=false
cd blog-website/api
cargo run
```

Canonical entrypoint (design-level):

```bash
blog-website/scripts/dev/api
```

Verify quickly:

```bash
curl -sS http://127.0.0.1:3000/v1/auth/session
```

Expected response when unauthenticated:

```json
{ "authenticated": false }
```

## Running Backend Tests

### Tier 0 gates
Once implemented:

```bash
cargo fmt --check
cargo clippy -- -D warnings
cargo check
```

### Integration tests (real Postgres)
Preferred approaches:

1. Testcontainers (ephemeral Postgres per test run)
2. Local Postgres (this runbook) + a fresh database per run

Local Postgres example (fresh db per run):

```bash
createdb -h localhost -U blog blog_website_test || true
export TEST_DATABASE_URL=postgres://blog:blog@localhost:5432/blog_website_test
sqlx migrate run --source blog-website/api/migrations
cd blog-website/api
cargo test
```

If you use Testcontainers, tests should not require a pre-running DB.

## Notes for Frontend Local Dev
Because sessions use cookies, prefer same-origin calls from the browser:

- Frontend calls relative URLs like `/v1/posts`.
- Next.js rewrites `/v1/*` to the API origin in local dev.

This avoids CORS+credentials complexity.
