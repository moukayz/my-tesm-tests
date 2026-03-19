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

## 5. E2E Test Suites

### 5.1 Auth (`auth.spec.ts`)

| Test | What it validates |
|------|-------------------|
| Login icon visible when logged out | AC-02 |
| Itinerary tab hidden when logged out | Auth guard |
| Login page renders Sign in with Google | Login flow |
| POST /api/plan-update returns 401 without auth | API auth guard |
| Injected session: Itinerary tab visible | Session injection |
| Injected session: POST returns 200 | Authenticated API |
| Auth error page countdown redirect | /auth-error flow |

### 5.2 Navigation (`navigation.spec.ts`)

| Test | What it validates |
|------|-------------------|
| Heading visible | Page renders |
| Train Delays / Timetable tabs visible | Tab structure |
| Itinerary tab hidden when logged out | Auth guard |
| Logged in: Itinerary tab visible + active by default | Default tab |

### 5.3 Itinerary Tab (`itinerary.spec.ts`)

| Test | What it validates |
|------|-------------------|
| Date renders | Data load |
| Plan text renders | Plan display |
| 16 days shown | Row count |
| Double-click to edit | Inline edit UX |
| Blur saves edit | Edit persistence |
| Drag-drop swaps sections | DnD reorder |

### 5.4 Itinerary Export (`itinerary-export.spec.ts`)

27 tests covering AC-01 through AC-14, AC-F01 through AC-F14 (UX fixes).

| Test | AC / FR covered |
|------|----------------|
| Export FAB visible (auth, data present) | AC-01, FR-01 |
| Export FAB absent (not authenticated) | AC-02, AC-F12 |
| E2E-S3-03: `export-button` NOT in DOM | AC-F13 |
| Format picker opens with Markdown + PDF options | AC-03, FR-02 |
| Markdown download: `showSaveFilePicker` called with `itinerary.md` | AC-05, FR-04 |
| PDF download: `showSaveFilePicker` called with `itinerary.pdf` (DEF-001 fixed) | AC-09, FR-05 |
| Escape closes picker — no download | AC-04, FR-03 |
| Outside click closes picker — no download | AC-04, FR-03 |
| × button closes picker — no download | AC-04, FR-03 |
| Markdown export: no extra /api/* requests | AC-14, FR-15 |
| PDF export: no extra /api/* requests | AC-14, FR-15 |
| Markdown headers correct, no Weekday column | AC-05, FR-06, FR-07 |
| Markdown Plan cell: sections combined, empty omitted | AC-06, FR-08 |
| Markdown Train Schedule: DB trains show IDs only (no stations/times) | AC-07, FR-09 |
| Anchor fallback: works without `showSaveFilePicker` | AC-12, FR-13 |
| Export FAB aria attributes (haspopup + expanded) | NFR-03 |
| **E2E-S1-01** Toast appears after Markdown export | AC-F01 |
| **E2E-S1-02** Toast auto-disappears within 4 s | AC-F01 |
| **E2E-S1-03** Toast appears after PDF export | AC-F02 |
| **E2E-S1-04** Dismiss button removes toast | AC-F05 |
| **E2E-S1-05** No toast on AbortError | AC-F03 |
| **E2E-S2-01** 0 `/fonts/` requests at page load | AC-F07 |
| **E2E-S2-02** Exactly 1 font request on first PDF export | AC-F07 |
| **E2E-S3-01** FAB visible after scrolling to bottom | AC-F09 |
| **E2E-S3-02** FAB → picker → MD download → toast | AC-F10 |
| **E2E-S3-04** FAB `aria-label` correct when data present | NFR-03, AC-F11 |
| **E2E-S3-05** FAB absent for unauthenticated users | AC-F12 |

**DEF-001 resolved:** PDF export fully functional — see §6.

### 5.5 Train Schedule JSON Editor (`train-schedule-json-editor.spec.ts`)

8 tests covering the pencil icon modal: open, edit, save, cancel, Escape, invalid JSON error.

### 5.6 Train Delays (`train-delays.spec.ts`, `train-delay.spec.ts`)

UI flow + API contract tests for delay stats, station dropdown, chart rendering.

### 5.7 Timetable (`timetable.spec.ts`, `train-timetable.spec.ts`)

UI flow + API contract tests for German, French, Eurostar timetable data.

---

## 6. Known Defects

### DEF-001 — PDF export: `n.autoTable is not a function` — ✅ RESOLVED (2026-03-19)

| Field | Detail |
|-------|--------|
| **ID** | DEF-001 |
| **Status** | ✅ **RESOLVED** |
| **Root cause** | `jspdf-autotable` dynamic side-effect import did not register `autoTable` on the `jsPDF` prototype due to ESM/bundler scope isolation in Next.js. |
| **Fix** | `buildPdfBlob()` in `app/lib/itineraryExport.ts` now uses `const { autoTable } = await import('jspdf-autotable')` and calls `autoTable(doc, opts)` directly. |
| **Verified by** | `itinerary-export.spec.ts` › `clicking PDF option calls showSaveFilePicker with suggestedName "itinerary.pdf" (DEF-001 fixed)` — passes ✅ |

### DEF-002 — `ExportToolbar.tsx` and `ExportToolbar.test.tsx` not deleted — ⚠️ NON-BLOCKING

| Field | Detail |
|-------|--------|
| **ID** | DEF-002 |
| **Status** | ⚠️ Open (non-blocking cleanup) |
| **Severity** | Low |
| **Root cause** | `ExportToolbar.tsx` was not deleted from the filesystem as part of `itinerary-export-ux-pdf-fixes`. It is no longer imported by `ItineraryTab.tsx` so it is dead code and does not affect the running app. |
| **User impact** | None — `data-testid="export-button"` is confirmed absent from the DOM (E2E-S3-03 ✅). |
| **Fix** | Delete `components/ExportToolbar.tsx` and `__tests__/components/ExportToolbar.test.tsx` in a follow-up commit. |

### DEF-003 — CJK font 4.9 MB vs. 200 KB spec target — ⚠️ NON-BLOCKING (known, accepted)

| Field | Detail |
|-------|--------|
| **ID** | DEF-003 |
| **Status** | ⚠️ Accepted for v1 |
| **Severity** | Low |
| **Root cause** | Subsetted `NotoSansSC-subset.ttf` is 4.9 MB; full BMP CJK block (~20,902 glyphs) cannot fit in ≤200 KB with standard TrueType subsetting. |
| **User impact** | ~490 ms additional delay on first PDF export (lazy-loaded, cached for session). Zero impact to initial page load (0 font requests confirmed by E2E-S2-01). |
| **Fix** | Future optimization: per-trip character-list subsetting to produce <200 KB font. |

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
