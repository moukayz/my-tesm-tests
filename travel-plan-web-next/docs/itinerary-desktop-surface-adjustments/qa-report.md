# QA Report - itinerary-desktop-surface-adjustments

**Date:** 2026-03-22  
**Status:** Fail - slice behaviors pass, but release readiness is blocked by existing itinerary workspace and build regressions

## Commands Run

```bash
npm test -- --runInBand __tests__/components/ItineraryCardsView.test.tsx __tests__/components/ItineraryPanel.test.tsx __tests__/components/ItineraryDetailShell.test.tsx __tests__/components/TravelPlan.test.tsx
ITINERARY_DATA_DIR="data/itineraries-qa-desktop-<timestamp>" npm run test:e2e:local -- __tests__/e2e/itinerary-cards-navigation.spec.ts
ITINERARY_DATA_DIR="data/itineraries-qa-desktop-surface-<timestamp>" npm run test:e2e:local -- __tests__/e2e/itinerary-desktop-surface-adjustments.spec.ts
ITINERARY_DATA_DIR="data/itineraries-qa-desktop-<timestamp>" npm run test:e2e:local -- __tests__/e2e/itinerary-creation-workspace.spec.ts
AUTH_SECRET="test-auth-secret-32chars!!!!!!!!" DATABASE_URL="postgresql://postgres:postgres@localhost:5432/railway" MOTHERDUCK_TOKEN= npm run build
```

## Results

| Scenario | Result | Likely ownership | Notes |
|---|---|---|---|
| Desktop cards render as larger left-aligned click targets | Pass | Frontend | New Playwright smoke confirms the starter card and saved itinerary card share the cards-rail left edge and render as wide desktop cards. |
| Main itinerary detail rail matches `Itinerary (Test)` desktop width | Pass | Frontend | Focused desktop smoke confirms populated main-itinerary detail width stays within 16 px of the `Itinerary (Test)` desktop rail. |
| Original seeded route appears as its own starter card and opens from cards view | Pass | Frontend + Backend | Cards view shows `Original seeded route`, and selecting it opens `/?tab=itinerary&legacyTabKey=route`. |
| Cards-first navigation remains intact | Pass | Frontend + Backend | Existing cards-navigation smoke still passes for cards-first entry, card open, and `Back to all itineraries`. |
| Current populated detail editing entry points remain intact | Pass | Frontend | Focused desktop smoke verifies `Add next stay` and `Edit stay for Paris` stay available after opening a saved itinerary from cards view. |
| Empty-workspace create/edit regression check | Fail | Frontend | `itinerary-creation-workspace.spec.ts` still fails because the workspace route crashes with `Runtime TypeError: frame.join is not a function` before `itinerary-empty-state` renders. |
| Production build gate | Fail | Frontend | `npm run build` fails in `app/api/trains/route.ts` because `__resetTrainsCacheForTests` is exported from a route module, which Next.js rejects for production build typing. |

## Failure Repro

- `itinerary-creation-workspace.spec.ts` failure:
  1. Run `ITINERARY_DATA_DIR="data/itineraries-qa-desktop-<timestamp>" npm run test:e2e:local -- __tests__/e2e/itinerary-creation-workspace.spec.ts`.
  2. The first test passes, but the second test navigates to a created itinerary workspace URL.
  3. The page shows the Next.js runtime overlay instead of the empty workspace.
  4. Actual error: `Runtime TypeError: frame.join is not a function`.
  5. Likely ownership: Frontend.

- `npm run build` failure:
  1. Run `AUTH_SECRET="test-auth-secret-32chars!!!!!!!!" DATABASE_URL="postgresql://postgres:postgres@localhost:5432/railway" MOTHERDUCK_TOKEN= npm run build`.
  2. Build stops during route type validation.
  3. Actual error: `app/api/trains/route.ts` exports `__resetTrainsCacheForTests`, which is not a valid App Router route export.
  4. Likely ownership: Frontend.

## Artifacts

- QA report: `docs/itinerary-desktop-surface-adjustments/qa-report.md`
- E2E runbook update: `docs/e2e-test-runbook.md`
- Focused desktop smoke: `__tests__/e2e/itinerary-desktop-surface-adjustments.spec.ts`
- Existing cards smoke: `__tests__/e2e/itinerary-cards-navigation.spec.ts`
- Existing workspace regression smoke: `__tests__/e2e/itinerary-creation-workspace.spec.ts`
- Focused Jest coverage: `__tests__/components/ItineraryCardsView.test.tsx`, `__tests__/components/ItineraryPanel.test.tsx`, `__tests__/components/ItineraryDetailShell.test.tsx`, `__tests__/components/TravelPlan.test.tsx`
- Playwright failure artifact: `test-results/itinerary-creation-workspa-d74be-uick-inline-edit-and-reload-chromium/`
- Playwright HTML report: `playwright-report/index.html`
- Playwright JSON results: `test-results.json`
