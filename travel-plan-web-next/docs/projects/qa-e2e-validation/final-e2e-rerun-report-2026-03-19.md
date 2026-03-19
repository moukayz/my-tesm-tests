# Final E2E Rerun Report - 2026-03-19

## Scope
- Repository: `travel-plan-web-next`
- Feature: `qa-e2e-validation`
- Validation type: full Playwright E2E regression rerun after targeted fix cycle 2

## Command
```bash
npm run test:e2e
```

## Result Summary
- Status: **FAIL**
- Total specs: **155**
- Passed: **152**
- Failed: **3**
- Skipped: **0**

## Remaining Failures
1. `[chromium] › __tests__/e2e/stay-edit.spec.ts:186:7`
   - Test: `Stay edit affordance › AC-2: input is pre-filled with the current number of nights (4)`
   - Assertion: expected `stay-edit-input-0` value `4`, received `2`
2. `[chromium] › __tests__/e2e/stay-edit.spec.ts:304:7`
   - Test: `Stay edit — shrink and extend (primary Itinerary tab) › AC-3: shrink persists after page reload`
   - Assertion: expected `stay-edit-input-0` value `2`, received `4`
3. `[chromium] › __tests__/e2e/stay-edit.spec.ts:459:7`
   - Test: `API failure — revert and error toast › AC-8: stay edit reverts and shows error toast on 500 response`
   - Assertion: expected `stay-edit-error-toast` to be visible, element not found

## Artifacts
- Playwright HTML report: `travel-plan-web-next/playwright-report/index.html`
- Playwright JSON results: `travel-plan-web-next/test-results.json`
- Failure artifacts root: `travel-plan-web-next/test-results/`
- Failure 1 screenshot: `travel-plan-web-next/test-results/stay-edit-Stay-edit-afford-feaef-current-number-of-nights-4--chromium/test-failed-1.png`
- Failure 1 error context: `travel-plan-web-next/test-results/stay-edit-Stay-edit-afford-feaef-current-number-of-nights-4--chromium/error-context.md`
- Failure 2 screenshot: `travel-plan-web-next/test-results/stay-edit-Stay-edit-—-shri-6f498--persists-after-page-reload-chromium/test-failed-1.png`
- Failure 2 error context: `travel-plan-web-next/test-results/stay-edit-Stay-edit-—-shri-6f498--persists-after-page-reload-chromium/error-context.md`
- Failure 3 screenshot: `travel-plan-web-next/test-results/stay-edit-API-failure-—-re-fb516-error-toast-on-500-response-chromium/test-failed-1.png`
- Failure 3 error context: `travel-plan-web-next/test-results/stay-edit-API-failure-—-re-fb516-error-toast-on-500-response-chromium/error-context.md`

## Minimal Repro
1. From `travel-plan-web-next/`, run `npm run test:e2e`.
2. Observe the three failures listed in this report in `__tests__/e2e/stay-edit.spec.ts`.
