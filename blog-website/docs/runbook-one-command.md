# Runbook: One-Command Local Dev (DB + API + Web)

Last updated: 2026-02-12

## One-time setup

```bash
cp blog-website/api/.env.example blog-website/api/.env
cp blog-website/web/.env.app.example blog-website/web/.env.app
cp blog-website/web/.env.local.example blog-website/web/.env.local

cd blog-website/web
npm install
```

## Start

```bash
blog-website/scripts/dev/up
```

Useful outputs:

- Logs: `blog-website/.dev/logs/api.log`, `blog-website/.dev/logs/web.log`
- PID files: `blog-website/.dev/pids/api.pid`, `blog-website/.dev/pids/web.pid`
- Web URL (default): derived from `WEB_PORT` in `blog-website/web/.env.app` (example: `http://127.0.0.1:3001`)
- API readiness: `http://127.0.0.1:3000/v1/auth/session`

## Stop

```bash
blog-website/scripts/dev/down
```

## Port conflicts (no manual hunting)

- Dev DB defaults to host port `5432`.
- If `5432` is busy, `blog-website/scripts/dev/up` auto-picks the next free port (starting at `DEV_DB_PORT`, default `5432`), records it in `blog-website/.dev/dev-db-port`, and the API process uses that port automatically.
- Force a starting port: `DEV_DB_PORT=5540 blog-website/scripts/dev/up`
