# QA E2E Report (Local)

Date: 2026-02-12

## 2026-02-12: One-Stop Local Dev Scripts (DB + API + Web)

Result: PASS

Goal:

- Validate `blog-website/scripts/dev/up` + `blog-website/scripts/dev/down` can bring up/tear down the local dev stack without manual port/process hunting and are idempotent.
- Explicitly validate behavior when host port `5432` is already occupied.

Exact commands run + results:

Simulate `5432` being occupied (dummy Postgres):

```bash
docker rm -f bw-qa-dummy-pg >/dev/null 2>&1 || true
docker run -d --name bw-qa-dummy-pg -e POSTGRES_PASSWORD=dummy -p 127.0.0.1:5432:5432 postgres:16 >/dev/null
```

Bring up stack (one-shot):

```bash
blog-website/scripts/dev/up
```

Observed from `dev/up` output:

```text
Host port 5432 is busy; using DEV_DB_PORT=5433
READY: dev stack is up
DB  DEV_DB_PORT=5433
API http://127.0.0.1:3000/v1/auth/session
WEB port=3001
```

Verify API readiness + web reachability + register + create post:

```bash
code_api="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 5 http://127.0.0.1:3000/v1/auth/session)"; test "$code_api" = 200
code_web="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 5 -I http://127.0.0.1:3001/)"; case "$code_web" in 200|301|302|303|307|308) : ;; *) exit 1 ;; esac

USER="qa_dev_$(date +%s)"; PASS='password123!'; COOKIE_JAR=/tmp/bw-dev.cookies
curl -sS -c "$COOKIE_JAR" -H 'content-type: application/json' -d "{\"username\":\"$USER\",\"password\":\"$PASS\"}" http://127.0.0.1:3000/v1/auth/register >/tmp/bw-dev-register.json
curl -sS -b "$COOKIE_JAR" -c "$COOKIE_JAR" http://127.0.0.1:3000/v1/auth/session >/tmp/bw-dev-session.json
TOKEN="$(node -e "const fs=require('fs'); const j=JSON.parse(fs.readFileSync('/tmp/bw-dev-session.json','utf8')); process.stdout.write(j.csrfToken)")"
NOW="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
curl -sS -b "$COOKIE_JAR" -H "X-CSRF-Token: $TOKEN" -H 'content-type: application/json' -d "{\"title\":\"QA one-shot post\",\"body\":\"created at $NOW\"}" http://127.0.0.1:3000/v1/posts >/tmp/bw-dev-create-post.json
node -e "const fs=require('fs'); const j=JSON.parse(fs.readFileSync('/tmp/bw-dev-create-post.json','utf8')); console.log(j.post.id)"
```

Result observed:

```text
api_http=200
web_http=307
created_post_id=40fc655e-0f79-49a8-8770-09c16b84d474
```

Bring down stack (one-shot):

```bash
blog-website/scripts/dev/down
```

Cleanup dummy `5432` Postgres:

```bash
docker rm -f bw-qa-dummy-pg >/dev/null
```

Scope (final validation):

1) No hard-coded loopback URLs in implementation/tests (config-driven endpoints)
2) Separate DB deployments for local dev vs E2E; verify E2E uses E2E DB and does not alter dev DB

Runbooks followed:

- `blog-website/docs/runbook-dev.md`
- `blog-website/docs/runbook-e2e.md`
- `blog-website/docs/runbook-frontend.md` (for dev web server)

## Result

PASS

## Loopback URL Sanity Scan (implementation/tests)

Command:

```bash
rg -n "(http://)?(localhost|127\\.0\\.0\\.1)" blog-website -g'!blog-website/docs/**' -S || true
```

Matches observed (non-implementation config/examples only):

```text
blog-website/web/.env.local.example:2:# This file may contain localhost/127.0.0.1 values.
blog-website/web/.env.local.example:3:API_ORIGIN=http://127.0.0.1:3000
blog-website/web/package.json:9:    "guard:no-localhost": "node ./scripts/guard-no-localhost.mjs",
blog-website/web/.env.e2e.example:2:# This file may contain localhost/127.0.0.1 values.
blog-website/web/.env.e2e.example:5:E2E_BASE_URL=http://127.0.0.1:3001
blog-website/web/.env.e2e.example:8:E2E_API_ORIGIN=http://127.0.0.1:3000
blog-website/api/src/config.rs:19:        // Do not hard-code a localhost bind by default; keep it env-driven.
```

Behavior validation:

- Web uses `API_ORIGIN` (Next.js rewrite/proxy) so browser calls remain relative (`/v1/*`).
- Playwright requires `E2E_BASE_URL` (see `blog-website/web/playwright.config.ts`) and tests use env-driven endpoints.

## Separate DB Deployments (Dev vs E2E)

Invariants verified:

- Dev DB: Compose project `blog-website-dev`, DB name `blog_website`, host port `5432`, volume `postgres_dev_data`.
- E2E DB: Compose project `blog-website-e2e`, DB name `blog_website_e2e`, host port `5434`, volume `postgres_e2e_data`.
- E2E run did not change dev DB contents (see before/after snapshots).

## Exact Commands Run + Results

### Pre-clean (ports already in use)

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN || true
lsof -nP -iTCP:3001 -sTCP:LISTEN || true
kill 11994 42044 || true
```

### Dev: Bring Up DB + API + Web, Seed One Post

Dev DB:

```bash
cd blog-website/api
docker compose -p blog-website-dev up -d
docker compose -p blog-website-dev exec -T postgres pg_isready -U blog -d blog_website
```

Dev API (started in background + waited for readiness):

```bash
cd blog-website/api && (DATABASE_URL='postgres://blog:blog@127.0.0.1:5432/blog_website' API_BIND='127.0.0.1:3000' SESSION_COOKIE_SECURE=false RUST_LOG='info,tower_http=info,sqlx=warn' CURSOR_HMAC_SECRET='dev-insecure-change-me' cargo run > /tmp/blog-dev-api.log 2>&1 & echo $! > /tmp/blog-dev-api.pid) && for i in $(seq 1 60); do if curl -fsS http://127.0.0.1:3000/v1/auth/session >/dev/null; then echo 'api_ready'; exit 0; fi; sleep 1; done; echo 'api_not_ready'; exit 1
```

Dev web deps/types (one-time for this run):

```bash
cd blog-website/web && npm install && npm run gen:openapi
```

Dev web (started in background + waited for readiness):

```bash
cd blog-website/web && (API_ORIGIN='http://127.0.0.1:3000' npm run dev > /tmp/blog-dev-web.log 2>&1 & echo $! > /tmp/blog-dev-web.pid) && for i in $(seq 1 60); do if curl -fsSI http://127.0.0.1:3001/posts >/dev/null; then echo 'web_ready'; exit 0; fi; sleep 1; done; echo 'web_not_ready'; exit 1
```

Seed dev data (register + create post):

```bash
set -euo pipefail; USER="qa_dev_$(date +%s)"; PASS='password123!'; echo "$USER" > /tmp/blog-dev-username.txt; curl -sS -c /tmp/blog-dev.cookies -H 'content-type: application/json' -d "{\"username\":\"$USER\",\"password\":\"$PASS\"}" http://127.0.0.1:3000/v1/auth/register > /tmp/blog-dev-register.json; curl -sS -b /tmp/blog-dev.cookies -c /tmp/blog-dev.cookies http://127.0.0.1:3000/v1/auth/session > /tmp/blog-dev-session.json; TOKEN=$(node -e "const fs=require('fs'); console.log(JSON.parse(fs.readFileSync('/tmp/blog-dev-session.json','utf8')).csrfToken)"); echo "$TOKEN" > /tmp/blog-dev-csrf.txt; NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ"); curl -sS -b /tmp/blog-dev.cookies -H "X-CSRF-Token: $TOKEN" -H 'content-type: application/json' -d "{\"title\":\"QA dev seed\",\"body\":\"Seed post created $NOW\"}" http://127.0.0.1:3000/v1/posts > /tmp/blog-dev-create-post.json; node -e "const fs=require('fs'); const j=JSON.parse(fs.readFileSync('/tmp/blog-dev-create-post.json','utf8')); console.log(j.post.id);"
```

Observed values:

```text
dev_username: qa_dev_1770886097
created_dev_post_id: 10cb207d-4f04-43e3-9ad3-bdc5d1132a2f
```

Created dev post id:

```text
10cb207d-4f04-43e3-9ad3-bdc5d1132a2f
```

Dev DB snapshot (baseline before E2E):

```bash
cd blog-website/api
docker compose -p blog-website-dev exec -T postgres psql -U blog -d blog_website \
  -c "select count(*) as users_count from users;" \
  -c "select count(*) as posts_count from posts;" \
  -c "select id,title,created_at from posts order by created_at desc limit 5;"
```

Result:

```text
users_count: 1
posts_count: 1
latest_post_id: 10cb207d-4f04-43e3-9ad3-bdc5d1132a2f
```

Stop dev API + web (free ports for E2E):

```bash
kill $(cat /tmp/blog-dev-api.pid) $(cat /tmp/blog-dev-web.pid) || true
```

### E2E: Bring Up E2E DB + API + Web, Run Playwright Suite

E2E DB (fresh):

```bash
cd blog-website/api && docker compose -p blog-website-e2e -f docker-compose.e2e.yml down -v || true; docker compose -p blog-website-e2e -f docker-compose.e2e.yml up -d && for i in $(seq 1 30); do if docker compose -p blog-website-e2e -f docker-compose.e2e.yml exec -T postgres pg_isready -U blog -d blog_website_e2e; then exit 0; fi; sleep 1; done; exit 1
```

E2E API (started in background + waited for readiness):

```bash
cd blog-website/api && (DATABASE_URL='postgres://blog:blog@127.0.0.1:5434/blog_website_e2e' API_BIND='127.0.0.1:3000' SESSION_COOKIE_SECURE=false RUST_LOG='info,tower_http=info,sqlx=warn' CURSOR_HMAC_SECRET='dev-insecure-change-me' cargo run > /tmp/blog-e2e-api.log 2>&1 & echo $! > /tmp/blog-e2e-api.pid) && for i in $(seq 1 60); do if curl -fsS http://127.0.0.1:3000/v1/auth/session >/dev/null; then echo 'api_ready'; exit 0; fi; sleep 1; done; echo 'api_not_ready'; exit 1
```

E2E web (started in background + waited for readiness):

```bash
cd blog-website/web && (API_ORIGIN='http://127.0.0.1:3000' npm run dev > /tmp/blog-e2e-web.log 2>&1 & echo $! > /tmp/blog-e2e-web.pid) && for i in $(seq 1 60); do if curl -fsSI http://127.0.0.1:3001/posts >/dev/null; then echo 'web_ready'; exit 0; fi; sleep 1; done; echo 'web_not_ready'; exit 1
```

Playwright run:

```bash
cd blog-website/web && npm run e2e:install && E2E_BASE_URL='http://127.0.0.1:3001' E2E_API_ORIGIN='http://127.0.0.1:3000' npx playwright test --config playwright.config.ts
```

Result:

```text
Running 3 tests using 3 workers
3 passed (5.4s)
```

Executed tests:

```text
[chromium] e2e/forbidden-on-others.spec.ts:6:5
[chromium] e2e/public-browse.spec.ts:6:5
[chromium] e2e/post-management-ui.spec.ts:3:5
```

E2E DB snapshot (post-run):

```bash
cd blog-website/api
docker compose -p blog-website-e2e -f docker-compose.e2e.yml exec -T postgres psql -U blog -d blog_website_e2e \
  -c "select count(*) as users_count from users;" \
  -c "select count(*) as posts_count from posts;" \
  -c "select title,created_at from posts order by created_at desc limit 5;"
```

Result:

```text
users_count: 4
posts_count: 2
latest_posts:
- E2E public browse qa_pw_public_1770886253267
- E2E forbidden qa_pw_a_1770886253267
```

Stop E2E API + web:

```bash
kill $(cat /tmp/blog-e2e-api.pid) $(cat /tmp/blog-e2e-web.pid) || true
```

### Confirm Dev DB Unchanged After E2E

```bash
cd blog-website/api
docker compose -p blog-website-dev exec -T postgres psql -U blog -d blog_website \
  -c "select count(*) as users_count from users;" \
  -c "select count(*) as posts_count from posts;" \
  -c "select id,title,created_at from posts order by created_at desc limit 5;"
```

Result:

```text
users_count: 1
posts_count: 1
latest_post_id: 10cb207d-4f04-43e3-9ad3-bdc5d1132a2f
```

## Failures / Repro

None.

## Artifacts

- Playwright artifacts: `blog-website/web/test-results/`
- Playwright HTML report: `blog-website/web/playwright-report/`
