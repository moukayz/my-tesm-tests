# Dev Runbook: Blog Website Web (Local)

Last updated: 2026-02-12

This runbook describes how to run the frontend locally.

## One-stop launch (canonical DX interface)

Design-level requirement (see `blog-website/docs/hld.md`): frontend must provide a one-stop command that starts the web app with the correct env loaded.

Canonical entrypoint:

```bash
blog-website/scripts/dev/web
```

Notes:

- This wrapper is responsible for ensuring `blog-website/web/.env.local` exists (from `blog-website/web/.env.local.example`) and then running `npm run dev`.
- The underlying "manual" commands in this runbook remain valid.
- The wrapper prints machine-searchable lines:
  - `WEB_ENV envFile=... mode=dev apiOrigin=...`
  - `WEB_READY mode=dev`

### Port override (config-driven)

- Default dev port follows the current Next dev default in `blog-website/web/package.json`.
- To avoid port collisions, set `WEB_PORT` (or `PORT`) in your shell or in `blog-website/web/.env.local`.

## Prerequisites
- Node.js 20+

## Location
- Frontend app: `blog-website/web/`

## API Proxy / Same-Origin Cookies
The API uses cookie sessions + CSRF tokens, so the frontend is built to call relative paths like `/v1/posts`.

In local dev, Next.js rewrites `/v1/*` to your backend origin.

### Environment variables
- `API_ORIGIN` (optional)
  - Used by framework rewrites/proxy to route `/v1/*` to the API origin.
  - Set via `.env*` or your tool configuration (avoid in-code defaults).
  - Example (dev): `API_ORIGIN=http://127.0.0.1:3000`

## Install

```bash
cd blog-website/web
npm install
```

## Generate OpenAPI Types

```bash
cd blog-website/web
npm run gen:openapi
```

## Run Dev Server

```bash
cd blog-website/web
npm run dev
```

Canonical entrypoint (design-level):

```bash
blog-website/scripts/dev/web
```

- Default frontend URL: `http://127.0.0.1:3001`
- Expected backend origin (default rewrite): `http://127.0.0.1:3000`

## Tests

```bash
cd blog-website/web
npm test
```

Optional Tier 0 checks:

```bash
cd blog-website/web
npm run typecheck
npm run lint
```

## Troubleshooting
- If login/register requests succeed but the UI still looks logged out: verify the browser received the `bw_session` cookie from the API origin and that the API and frontend are using the same site via the `/v1/*` rewrite.
- If you see `403 forbidden` on `POST/PATCH/DELETE`: ensure `GET /v1/auth/session` is reachable (CSRF token bootstrap) and cookies are included.
