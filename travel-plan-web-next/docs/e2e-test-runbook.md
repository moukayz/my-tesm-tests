# E2E Test Runbook — Travel Plan Web (Next.js)

**Last updated:** 2026-03-19 (QA pass — `itinerary-export-ux-pdf-fixes`)
**Coverage:** auth, navigation, itinerary, train delays, timetable, train schedule editor, itinerary export (UX + PDF fixes)

---

## 1. Quick Start

```bash
# Install dependencies (first time only)
npm install

# Run all E2E tests (local mode — no MotherDuck token required)
npm run test:e2e:local

# Run all E2E tests (cloud mode — requires .env.local with MotherDuck + Neon creds)
npm run test:e2e
```

---

## 2. Prerequisites

### 2.1 Node.js & npm

- Node.js 18+
- `npm install` completed (installs Playwright browsers automatically via `@playwright/test`)

### 2.2 Environment files

| File | Purpose |
|------|---------|
| `.env.test` | Auth secret, test route data path, test DB URL — **committed to repo** |
| `.env.local` | Local overrides (Google OAuth, MotherDuck token, Neon DB URL) — **gitignored** |

`.env.test` contents:
```
AUTH_SECRET=test-auth-secret-32chars!!!!!!!!
AUTH_TRUST_HOST=true
ROUTE_DATA_PATH=data/route.e2e.json
ROUTE_REDIS_KEY=route:e2e
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/railway
```

### 2.3 Local data sources (for `test:e2e:local`)

Docker + local GTFS parquet files:
```bash
# Start local PostgreSQL (for auth / plan persistence)
docker-compose up -d

# Initialise DB schema
npm run db:init

# Load German railway GTFS data (required for timetable / delay tests)
npm run db:german:load
```

The app will use local parquet files under `german-railway-timetable/`, `french-railway-timetable/`, and `eurostar-railway-timetable/`.

---

## 3. Running E2E Tests

### 3.1 All tests (dot reporter — CI-friendly)

```bash
npm run test:e2e         # cloud mode
npm run test:e2e:local   # local mode (no cloud credentials required)
```

### 3.2 All tests (verbose list output)

```bash
npm run test:e2e:verbose
```

### 3.3 Interactive Playwright UI (recommended for local debugging)

```bash
npm run test:e2e:ui
```

### 3.4 Run a specific spec file

```bash
# Run only itinerary export tests
npx playwright test __tests__/e2e/itinerary-export.spec.ts --reporter=list

# Run only auth tests
npx playwright test __tests__/e2e/auth.spec.ts --reporter=list
```

### 3.5 Run tests matching a grep pattern

```bash
# All export-related tests
npx playwright test --grep "Itinerary Export" --reporter=list

# All auth tests
npx playwright test --grep "Authentication" --reporter=list
```

---

## 4. One-Stop Local Dev Launch

To manually test the app locally with all features working:

```bash
# Terminal 1: Start Docker (PostgreSQL)
docker-compose up -d

# Terminal 2: Start the Next.js dev server (local data sources)
npm run dev:local
```

App opens at [http://localhost:3000](http://localhost:3000).

To log in during manual testing, either:
- Configure Google OAuth credentials in `.env.local` and use Sign in with Google.
- Or use the JWT session-injection technique from the E2E tests (browser DevTools → cookie injection).

---

## 7. Playwright Configuration

Config file: `playwright.config.ts`

Key settings:

| Setting | Value |
|---------|-------|
| `testDir` | `./__tests__/e2e` |
| `baseURL` | `http://localhost:3001` |
| `projects` | `chromium` only |
| `webServer.command` | `npm run dev -- -p 3001` (local) / `npm run build && npm start -- -p 3001` (cloud) |
| `timeout` | 30 000 ms (local) / 120 000 ms (MotherDuck) |
| `retries` | 0 |
| `fullyParallel` | `true` (local) / `false` (MotherDuck) |
| `reporter` | `list`, `html`, `json` |

HTML report is generated at `playwright-report/index.html`.  
JSON results at `test-results.json`.

---

## 8. Session Injection Helper

All E2E tests that require authentication use the `injectSession` helper to bypass Google OAuth:

```ts
import { encode } from 'next-auth/jwt'

const AUTH_SECRET = process.env.AUTH_SECRET || 'test-auth-secret-32chars!!!!!!!!'
const COOKIE_NAME = 'authjs.session-token'

async function injectSession(page: Page, user = { email: 'test@gmail.com', name: 'Test User' }) {
  const token = await encode({
    token: { email: user.email, name: user.name, sub: user.email },
    secret: AUTH_SECRET,
    salt: COOKIE_NAME,
  })
  await page.context().addCookies([{
    name: COOKIE_NAME, value: token, domain: 'localhost',
    path: '/', httpOnly: true, sameSite: 'Lax',
  }])
}
```

This must be called **before** `page.goto('/')` (or cookies must be set before navigation).

---

## 9. Export Feature Test Mocking

The export E2E tests mock `window.showSaveFilePicker` via `page.addInitScript()` to:
- Prevent actual file dialogs from blocking the test.
- Capture written file content for assertion.

```ts
const INJECT_SAVE_FILE_PICKER_MOCK = `
  (() => {
    const capture = { calls: [], chunks: [] }
    window.__exportCapture = capture
    window.showSaveFilePicker = (opts) => {
      capture.calls.push({ suggestedName: opts && opts.suggestedName })
      const writable = {
        write: (chunk) => { capture.chunks.push(chunk); return Promise.resolve() },
        close: () => Promise.resolve(),
      }
      return Promise.resolve({ createWritable: () => Promise.resolve(writable) })
    }
  })()
`
```

To read captured file content in a test:
```ts
const content = await page.evaluate(async () => {
  const cap = window.__exportCapture
  const parts = await Promise.all(cap.chunks.map(c =>
    c instanceof Blob ? c.text() : Promise.resolve(String(c))
  ))
  return parts.join('')
})
```

To test anchor fallback (no `showSaveFilePicker`):
```ts
await page.addInitScript(`
  delete window.showSaveFilePicker
  window.__anchorClicks = []
  const origCreate = document.createElement.bind(document)
  document.createElement = function(tag, ...args) {
    const el = origCreate(tag, ...args)
    if (tag.toLowerCase() === 'a') {
      el.click = function() { window.__anchorClicks.push({ download: el.download }) }
    }
    return el
  }
`)
```

---

## 10. CI Integration

The E2E tests are suitable for CI gating. Recommended CI command:

```bash
npm run test:e2e:local
```

This runs without any cloud credentials. Requires:
1. Docker PostgreSQL service running.
2. DB initialised (`npm run db:init`).
3. Railway data loaded (`npm run db:german:load`).

Set `DATABASE_URL` and `AUTH_SECRET` in CI environment variables (match `.env.test` values for the test-secret values).
