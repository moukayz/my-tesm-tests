# QA Report - itinerary-cards-navigation

**Date:** 2026-03-22  
**Status:** Pass - release-ready

## Commands Run

```bash
npm test -- TravelPlan.test.tsx ItineraryPanel.test.tsx CreateItineraryModal.test.tsx ItineraryWorkspace.test.tsx api-itineraries.test.ts
ITINERARY_DATA_DIR="data/itineraries-qa-cards-<timestamp>" npm run test:e2e:local -- itinerary-cards-navigation.spec.ts itinerary-creation-workspace.spec.ts
```

## Results

| Scenario | Result | Likely ownership | Notes |
|---|---|---|---|
| Cards-first default entry shows all recoverable itineraries | Pass | Frontend + Backend | `/?tab=itinerary` stayed in cards view and exposed multiple saved itineraries as clickable cards. |
| Card click opens existing detail/editor workspace and in-app back returns to cards | Pass | Frontend | Detail mode opened at `/?tab=itinerary&itineraryId=<id>` and `Back to all itineraries` returned to cards without browser-history reliance. |
| Create flow still lands in empty workspace from the cards-first model | Pass | Frontend + Backend | `New itinerary` created a draft shell and rendered the empty workspace with `Add first stay`. |
| Recoverability of prior itineraries from cards view | Pass | Frontend + Backend | After returning from detail, the previously created itinerary cards remained visible and selectable. |
| Feature-focused Jest regression set | Pass | Frontend + Backend | Component and API coverage passed for cards/detail routing, create modal, workspace loading, and itinerary APIs. |

## Failure Repro

- None in this run.

## Artifacts

- QA report: `docs/itinerary-cards-navigation/qa-report.md`
- Playwright specs: `__tests__/e2e/itinerary-cards-navigation.spec.ts`, `__tests__/e2e/itinerary-creation-workspace.spec.ts`
- Jest coverage set: `__tests__/components/TravelPlan.test.tsx`, `__tests__/components/ItineraryPanel.test.tsx`, `__tests__/components/CreateItineraryModal.test.tsx`, `__tests__/components/ItineraryWorkspace.test.tsx`, `__tests__/integration/api-itineraries.test.ts`
- HTML report: `playwright-report/index.html`
- JSON results: `test-results.json`
