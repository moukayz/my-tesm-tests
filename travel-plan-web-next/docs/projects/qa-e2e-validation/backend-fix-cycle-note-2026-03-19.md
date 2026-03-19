# Backend Fix Cycle Note - 2026-03-19

## Scope
- Targeted backend/data investigation for 2 remaining E2E failures:
  - `__tests__/e2e/stay-edit.spec.ts:304` (`AC-3: shrink persists after page reload`)
  - `__tests__/e2e/train-timetable.spec.ts:144` (`all dropdown items contain "8088"`)

## Root Cause and Outcome

### 1) Stay edit reload case (`stay-edit.spec.ts:304`)
- Outcome: **backend not identified as root cause**.
- Evidence:
  - `POST /api/stay-update` writes the full updated `RouteDay[]` via `store.updateDays(...)` before returning `200`.
  - Existing backend integration coverage (`__tests__/integration/api-stay-update.test.ts`) confirms persisted state is used by subsequent stay updates (not response-only mutation).
  - No backend contract/storage defect was reproduced in this cycle for the reload mismatch (`expected 2`, `got 6`).

### 2) Timetable dropdown filter case (`train-timetable.spec.ts:144`)
- Root cause (backend/data-side contributor): `/api/trains` always hit live DB/GTFS sources; under transient latency/fail-retry windows, the client can temporarily render a visible-but-empty dropdown while user input filtering is already active.
- Fix implemented:
  - Added short-lived in-memory caching for `/api/trains` responses (combined and `?railway=german` paths).
  - Cache is populated only on healthy successful responses (combined cache requires all three sources fulfilled and non-empty result), preventing stale empty/partial cache poisoning.
  - Added cache reset helper for deterministic integration tests.

## Changed Files
- `app/api/trains/route.ts`
- `__tests__/integration/api-trains.test.ts`

## Commands Run (targeted backend/integration only)
- `npm test -- __tests__/integration/api-trains.test.ts __tests__/integration/api-stay-update.test.ts`

## Results
- PASS: `__tests__/integration/api-trains.test.ts`
- PASS: `__tests__/integration/api-stay-update.test.ts`
- Aggregate: **2 suites passed, 40 tests passed, 0 failed**.
