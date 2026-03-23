# QA Report - itinerary-creation-and-stay-planning

**Date:** 2026-03-22  
**Status:** Fail - not release-ready

## Commands Run

```bash
npm test -- CreateItineraryModal.test.tsx ItineraryWorkspace.test.tsx TravelPlan.test.tsx ItineraryTab.test.tsx api-itineraries.test.ts
ITINERARY_DATA_DIR=data/itineraries-qa npm run test:e2e -- itinerary-creation-workspace.spec.ts
ITINERARY_DATA_DIR=data/itineraries-qa npm run test:e2e -- itinerary-creation-workspace.spec.ts --grep "empty workspace supports progressive"
npm run build
```

## Results

| Scenario | Result | Likely ownership | Notes |
|---|---|---|---|
| Create itinerary shell from **New itinerary** and auto-land on empty workspace | Fail | Frontend | URL updates to `/?tab=itinerary&itineraryId=<id>`, but workspace remains stuck on `Loading itinerary workspace...` and never renders **Add first stay** within 15s. |
| Add stays progressively, edit stay city+nights, keep quick inline nights edit, reload same workspace | Pass | Frontend + Backend | Verified via `__tests__/e2e/itinerary-creation-workspace.spec.ts` using an API-created shell and full UI interactions afterward. |
| Feature-focused component/integration regression set | Pass | Frontend + Backend | `CreateItineraryModal`, `ItineraryWorkspace`, `TravelPlan`, `ItineraryTab`, and `api-itineraries` checks passed. |
| Production build | Fail | Backend/build infra (unrelated to MVP path) | `app/api/trains/route.ts` exports `__resetTrainsCacheForTests`, which Next.js rejects in production route builds. |

## Failing Scenario Repro

### 1. Create flow does not reach the empty workspace

1. Start the app with test auth enabled.
2. Sign in (or inject the local test session used by Playwright).
3. Open `/` and stay on the **Itinerary** tab.
4. Click **New itinerary**.
5. Enter any valid name and a valid start date, for example `2026-10-01`.
6. Click **Create itinerary**.

Expected:

- URL changes to `/?tab=itinerary&itineraryId=<id>`.
- Empty workspace renders with the itinerary name, start date, and **Add first stay**.

Actual:

- URL changes correctly.
- Workspace remains on `Loading itinerary workspace...` for at least 15 seconds and never shows **Add first stay**.

## Artifacts

- Playwright spec: `__tests__/e2e/itinerary-creation-workspace.spec.ts`
- Failure snapshot: `test-results/itinerary-creation-workspa-502a9-land-on-the-empty-workspace-chromium/`
- HTML report: `playwright-report/index.html`
