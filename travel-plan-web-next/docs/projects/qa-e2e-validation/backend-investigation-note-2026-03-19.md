# Backend Investigation Note - 2026-03-19

## Scope
- Investigated remaining 2 E2E failures after frontend locator fixes.
- Backend/data changes only.

## Failure 1: `stay-edit.spec.ts:304` (shrink persists after page reload)
- Backend finding: no backend persistence defect reproduced.
- Evidence:
  - `POST /api/stay-update` already performs read -> domain validate -> `updateDays` atomic write in a single request path.
  - Added integration regression test proving sequential edits depend on persisted state between requests (not just in-memory response mutation).
  - This rules out a backend store write-drop on the `stay-update` path for this scenario.
- Likely contributor outside backend: client timing/test synchronization around reload relative to async save completion.

## Failure 2: `train-timetable.spec.ts:50` (autocomplete dropdown visibility timeout)
- Backend finding: `/api/trains` could return an empty list when data sources were transiently unavailable/cold, because source failures were handled as graceful empty fallbacks.
- Backend fix implemented:
  - Added bounded retry for each train source query in `GET /api/trains` (german/french/eurostar) before falling back.
  - This reduces transient empty responses that cause no autocomplete options and dropdown visibility timeout.

## Backend files changed
- `app/api/trains/route.ts`
- `__tests__/integration/api-trains.test.ts`
- `__tests__/integration/api-stay-update.test.ts`
