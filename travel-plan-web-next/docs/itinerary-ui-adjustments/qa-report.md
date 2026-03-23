# QA Report - itinerary-ui-adjustments

**Date:** 2026-03-23  
**Status:** Pass - focused validation confirms both requested UI adjustments are working as intended

## Commands Run

```bash
npm test -- --runInBand __tests__/components/ItineraryDetailShell.test.tsx __tests__/components/ItineraryTab.test.tsx
ITINERARY_DATA_DIR="data/itineraries-qa-ui-adjustments-<timestamp>" npm run test:e2e:local -- __tests__/e2e/itinerary-ui-adjustments.spec.ts
```

## Results

| Scenario | Result | Likely ownership | Notes |
|---|---|---|---|
| Detail view uses a simple icon-only back action | Pass | Frontend | Focused Playwright smoke confirms the return affordance is exposed through the icon button only, with no visible `Back to all itineraries` label rendered in the shell. |
| Back action preserves existing cards navigation | Pass | Frontend + Backend | Activating the icon returns to `/?tab=itinerary` and the created itinerary card remains visible in the cards rail. |
| Overnight pencil opens the full stay edit flow | Pass | Frontend + Backend | The pencil action opens the `Edit stay` dialog with the current city and nights prefilled, then saves through the itinerary-scoped stay PATCH path. |
| Separate `Edit stay` button removed from Overnight column | Pass | Frontend | Focused Playwright coverage confirms no exact-label `Edit stay` button remains in the itinerary table before or after editing. |
| Component-level regression coverage for icon back shell + itinerary-scoped stay trigger | Pass | Frontend | Focused Jest coverage passed for `ItineraryDetailShell` and `ItineraryTab`. |

## Failure Repro

- No product defects found for this slice.
- No follow-up fix is required based on this focused QA pass.

## Artifacts

- QA report: `docs/itinerary-ui-adjustments/qa-report.md`
- Focused Playwright smoke: `__tests__/e2e/itinerary-ui-adjustments.spec.ts`
- Focused component coverage: `__tests__/components/ItineraryDetailShell.test.tsx`, `__tests__/components/ItineraryTab.test.tsx`
- E2E runbook update: `docs/e2e-test-runbook.md`
- HTML report: `playwright-report/index.html`
- JSON results: `test-results.json`
