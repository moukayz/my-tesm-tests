# Frontend Targeted Fix Note - Cycle 2 (2026-03-19)

## Scope
- Targeted frontend fixes for:
  1. `__tests__/e2e/stay-edit.spec.ts:304` (`AC-3: shrink persists after page reload`)
  2. `__tests__/e2e/train-timetable.spec.ts:144` (`all dropdown items contain the search term when typing "8088"`)

## Root Cause

### 1) Stay shrink persistence after reload
- Frontend root cause confirmed: the home route could serve stale initial itinerary data after mutation/reload because the page was not explicitly marked dynamic.
- Result: after a successful stay edit, immediate reload could re-render with pre-edit nights.

### 2) Timetable autocomplete filtered-item assertion
- Frontend root cause confirmed: the dropdown container was rendered for typed input even when filtered matches were empty.
- Result: E2E could observe a visible dropdown with `0` items and fail `count > 0` before filtered data populated.

## Changes Implemented
- `app/page.tsx`
  - Added `export const dynamic = 'force-dynamic'` so authenticated `/` requests always read fresh route-store data.
- `components/AutocompleteInput.tsx`
  - Restored dropdown render guard to show the list only when `filtered.length > 0`.
- `__tests__/components/AutocompleteInput.test.tsx`
  - Updated regression expectation for empty filtered results (typed input + no options) to assert dropdown is not rendered.

## Commands Run
```bash
npm test -- --no-coverage --testPathPatterns="AutocompleteInput.test.tsx|TravelPlan.test.tsx|ItineraryTab.test.tsx"
npm run test:e2e -- __tests__/e2e/stay-edit.spec.ts __tests__/e2e/train-timetable.spec.ts
```

## Results
- Jest targeted component suites: PASS (3 suites, 130 tests).
- Targeted Playwright specs: PASS (69 tests, 0 failures).
- Both reported failing scenarios are fixed on the frontend side.
