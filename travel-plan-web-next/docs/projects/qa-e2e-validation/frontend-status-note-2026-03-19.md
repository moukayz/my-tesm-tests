# Frontend Status Note - Remaining 2 E2E Failures (2026-03-19)

## Scope
- Frontend-only investigation/fixes for:
  1. `__tests__/e2e/stay-edit.spec.ts:304` (`AC-3: shrink persists after page reload`)
  2. `__tests__/e2e/train-timetable.spec.ts:50` (`train autocomplete lists real trains from parquet`)

## Diagnosis

### 1) Stay edit persistence after reload
- Frontend contributing factor confirmed.
- `ItineraryTab` submits stay edits with `fetch('/api/stay-update')` and closes edit UI immediately after optimistic update.
- If a reload happens quickly after confirm, browser navigation can interrupt in-flight request delivery, making persisted store state lag behind optimistic UI state.

### 2) Timetable autocomplete dropdown visibility timeout
- Frontend contributing factor confirmed.
- `AutocompleteInput` previously rendered the dropdown container only when `filtered.length > 0`.
- During async train list hydration, user input can be present while `options` is temporarily empty, so no dropdown element exists yet and `getByRole('list')` visibility waits can time out.

## Frontend Fixes Implemented
- Added `keepalive: true` to stay-edit persistence request in `ItineraryTab` so a submit can complete more reliably across immediate reload/navigation.
- Updated `AutocompleteInput` to keep the dropdown container rendered while the field is open and user has typed (or `showAllWhenEmpty` is enabled), even when current filtered results are temporarily empty.

## Focused Test Updates
- Updated stay-edit component test to assert `keepalive: true` is included in the `/api/stay-update` request options.
- Added autocomplete component regression test ensuring dropdown container remains present for typed input when matches are not yet available.

## Files Changed
- `components/ItineraryTab.tsx`
- `components/AutocompleteInput.tsx`
- `__tests__/components/ItineraryTab.test.tsx`
- `__tests__/components/AutocompleteInput.test.tsx`

## Targeted Checks Run
```bash
npm test -- --no-coverage --testPathPatterns="ItineraryTab.test.tsx|TrainTimetableTab.test.tsx|AutocompleteInput.test.tsx"
```

Result: PASS (3 suites, 126 tests).
