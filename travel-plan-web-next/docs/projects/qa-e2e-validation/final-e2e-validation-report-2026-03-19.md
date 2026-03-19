# Final E2E Validation Report - 2026-03-19

## Scope
- Repository: `travel-plan-web-next`
- Feature: `qa-e2e-validation`
- Validation type: full Playwright E2E regression
- Execution time: `2026-03-19 19:15:15 CST`

## Command
```bash
npm run test:e2e
```

## Result
- Status: **FAIL**
- Total specs: **155**
- Passed: **153**
- Failed: **2**
- Skipped: **0**

## Remaining Failures
1. `[chromium] › __tests__/e2e/stay-edit.spec.ts:304:7`
   - Test: `Stay edit — shrink and extend (primary Itinerary tab) › AC-3: shrink persists after page reload`
   - Assertion: expected `stay-edit-input-0` value `2`, received `6`
2. `[chromium] › __tests__/e2e/train-timetable.spec.ts:144:7`
   - Test: `Timetable tab — French and Eurostar GTFS queries › all dropdown items contain the search term when typing "8088"`
   - Assertion: expected dropdown item count `> 0`, received `0`

## Artifacts
- Playwright HTML report: `travel-plan-web-next/playwright-report/index.html`
- Failure artifacts root: `travel-plan-web-next/test-results/`
- Failure 1 screenshot: `travel-plan-web-next/test-results/stay-edit-Stay-edit-—-shri-6f498--persists-after-page-reload-chromium/test-failed-1.png`
- Failure 1 error context: `travel-plan-web-next/test-results/stay-edit-Stay-edit-—-shri-6f498--persists-after-page-reload-chromium/error-context.md`
- Failure 2 screenshot: `travel-plan-web-next/test-results/train-timetable-Timetable--c6ea4-arch-term-when-typing-8088--chromium/test-failed-1.png`
- Failure 2 error context: `travel-plan-web-next/test-results/train-timetable-Timetable--c6ea4-arch-term-when-typing-8088--chromium/error-context.md`

## Minimal Repro
1. From `travel-plan-web-next/`, run `npm run test:e2e`.
2. Observe failure in `__tests__/e2e/stay-edit.spec.ts:304` where persisted stay value after reload is `6` instead of expected `2`.
3. Observe failure in `__tests__/e2e/train-timetable.spec.ts:144` where search term `8088` yields zero dropdown items.
