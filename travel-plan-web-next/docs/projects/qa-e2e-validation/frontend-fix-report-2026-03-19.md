# Frontend Fix Report - 2026-03-19

## Scope
- Project: `travel-plan-web-next`
- Feature: `qa-e2e-validation`
- Goal: restore shared Itinerary panel locator contract and unblock E2E suites that depended on `data-testid="itinerary-tab"` + Date column-header anchoring.

## Root Cause
- The primary itinerary panel locator contract was broken in UI markup: `ItineraryTab` did not expose `data-testid="itinerary-tab"` (or `itinerary-test-tab`) on the rendered panel container.
- E2E suites that scope from the panel (`getByTestId('itinerary-tab')`) could not find downstream targets, originally reported as Date header lookup failures.
- After restoring panel test IDs, Export E2E still failed because `export-fab` was rendered via portal outside the panel subtree, while the E2E contract scopes `export-fab` under the itinerary panel locator.

## Frontend Changes Applied
- Added panel-level test IDs directly on `ItineraryTab` root container based on `tabKey`:
  - `route` -> `data-testid="itinerary-tab"`
  - `route-test` -> `data-testid="itinerary-test-tab"`
- Kept floating export button fixed-positioned but rendered it inside the active panel subtree (instead of portal) so panel-scoped E2E locators resolve consistently.
- Added regression tests in component suite to enforce panel locator + Date header contract for both tabs.
- Updated frontend runbook notes for FAB location behavior and troubleshooting.

## Files Changed
- `components/ItineraryTab.tsx`
- `components/FloatingExportButton.tsx`
- `__tests__/components/ItineraryTab.test.tsx`
- `docs/frontend-runbook.md`

## Checks Run

```bash
cd travel-plan-web-next && npm test -- --no-coverage --testPathPatterns="ItineraryTab"
cd travel-plan-web-next && npm test
cd travel-plan-web-next && npm run test:e2e -- __tests__/e2e/itinerary-export.spec.ts
cd travel-plan-web-next && npm run test:e2e
```

## Post-Fix Results
- `npm test -- --no-coverage --testPathPatterns="ItineraryTab"`: PASS (97/97)
- `npm test`: PASS (33 suites, 541 tests)
- `npm run test:e2e -- __tests__/e2e/itinerary-export.spec.ts`: PASS (28/28)
- `npm run test:e2e` (full suite): **PARTIAL**
  - Passed: 153/155
  - Failed: 2/155

Remaining failures from latest full E2E run:
1. `__tests__/e2e/stay-edit.spec.ts:304:7` — `AC-3: shrink persists after page reload`
   - Observed persisted value mismatch (`expected 2`, received `4` in latest run)
2. `__tests__/e2e/train-timetable.spec.ts:50:7` — `train autocomplete lists real trains from parquet`
   - Timed out waiting for autocomplete dropdown visibility

## Next Frontend Actions (if assigned)
- Stabilize stay-edit persistence test by isolating route store state per test (explicit reset in `beforeEach`/`afterEach`, avoid cross-test leakage).
- Stabilize timetable autocomplete test by adding deterministic readiness wait for train data load before asserting dropdown content.
