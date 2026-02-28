# E2E Runbook — JSON Diff Checker

> **Last updated:** 2026-02-27 (AC-9/AC-10 inline diff tests added)

## Prerequisites

- Node.js ≥ 18
- npm ≥ 9
- Playwright browsers installed (see setup below)

## One-Time Setup

```bash
# From the json-diff/ directory
cd json-diff

# Install project dependencies
npm install

# Install Playwright and browsers
npm install -D @playwright/test
npx playwright install chromium
```

## Running E2E Tests

### Quick Run (Chromium only, headless)

```bash
cd json-diff
npx playwright test
```

This will:
1. Auto-start the Vite dev server on `http://localhost:5173`
2. Run all E2E tests in `tests/e2e/` against Chromium
3. Print results to stdout

### Run with Headed Browser (debug)

```bash
npx playwright test --headed
```

### Run a Single Test File

```bash
npx playwright test tests/e2e/compare.spec.ts
npx playwright test tests/e2e/errors.spec.ts
npx playwright test tests/e2e/identical.spec.ts
npx playwright test tests/e2e/clear.spec.ts
npx playwright test tests/e2e/inline-diff.spec.ts
```

### Run Tests Matching a Pattern

```bash
npx playwright test -g "AC-1"
npx playwright test -g "AC-9"
npx playwright test -g "AC-10"
```

### View HTML Report (after a run)

```bash
npx playwright show-report
```

## Test Files and AC Coverage

| Test File | Acceptance Criteria | Tests |
|---|---|---|
| `tests/e2e/compare.spec.ts` | AC-1, AC-2, AC-7, AC-8 | 6 |
| `tests/e2e/errors.spec.ts` | AC-3, AC-4 | 8 |
| `tests/e2e/identical.spec.ts` | AC-5 | 4 |
| `tests/e2e/clear.spec.ts` | AC-6 | 4 |
| `tests/e2e/inline-diff.spec.ts` | AC-9, AC-10 | 8 |
| **Total** | **AC-1 through AC-10** | **30** |

## Starting the Dev Server Manually

If you want to run the dev server independently (e.g., for manual testing):

```bash
cd json-diff
npm run dev
```

The app will be available at `http://localhost:5173`.

## Troubleshooting

| Issue | Resolution |
|---|---|
| `Error: browserType.launch: Executable doesn't exist` | Run `npx playwright install chromium` |
| Port 5173 already in use | Kill the existing process or let Playwright reuse it (`reuseExistingServer: true` in config) |
| Tests timeout waiting for dev server | Ensure `npm run dev` works standalone; check `vite.config.ts` |
