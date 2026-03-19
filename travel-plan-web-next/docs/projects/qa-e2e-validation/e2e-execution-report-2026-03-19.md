# E2E Execution Report - 2026-03-19

## Scope
- Repository: `travel-plan-web-next`
- Suite: Full Playwright E2E suite (`npm run test:e2e`)
- Execution time: `2026-03-19 18:56:44 CST`

## Commands Run
```bash
npm run test:e2e
```

## Overall Result
- Status: **FAIL**
- Total specs: **155**
- Passed: **83**
- Failed: **72**
- Skipped: **0**

## Failure Classification
- Primary classification: **frontend**
- Signal: all failing specs repeatedly time out on missing UI locator
  - `getByTestId('itinerary-tab').getByRole('columnheader', { name: /^date$/i })`
- Minimal repro:
  1. From `travel-plan-web-next/`, run `npm run test:e2e`
  2. Observe failures in multiple specs waiting for the Date header under `data-testid="itinerary-tab"`
  3. Open any failed artifact under `test-results/*/error-context.md` and screenshot to confirm missing expected table header

## Failed Specs by File
- `__tests__/e2e/itinerary-export.spec.ts`: 26 failed
- `__tests__/e2e/itinerary.spec.ts`: 6 failed
- `__tests__/e2e/stay-edit.spec.ts`: 32 failed
- `__tests__/e2e/train-schedule-json-editor.spec.ts`: 8 failed

## Failing Test Names
1. `[chromium] › __tests__/e2e/itinerary-export.spec.ts:117:7 › Itinerary Export — "Export to files…" › export FAB (export-fab) is visible on Itinerary tab when data exists (authenticated)`
2. `[chromium] › __tests__/e2e/itinerary-export.spec.ts:131:7 › Itinerary Export — "Export to files…" › E2E-S3-03: data-testid="export-button" is NOT in DOM (inline toolbar removed)`
3. `[chromium] › __tests__/e2e/itinerary-export.spec.ts:138:7 › Itinerary Export — "Export to files…" › clicking export FAB opens the format picker with Markdown option; PDF option is present but disabled (temporarily unavailable)`
4. `[chromium] › __tests__/e2e/itinerary-export.spec.ts:154:7 › Itinerary Export — "Export to files…" › clicking Markdown option calls showSaveFilePicker with suggestedName "itinerary.md"`
5. `[chromium] › __tests__/e2e/itinerary-export.spec.ts:176:7 › Itinerary Export — "Export to files…" › PDF button is disabled in the picker (PDF export temporarily unavailable)`
6. `[chromium] › __tests__/e2e/itinerary-export.spec.ts:191:7 › Itinerary Export — "Export to files…" › clicking disabled PDF button does NOT trigger showSaveFilePicker (PDF temporarily disabled)`
7. `[chromium] › __tests__/e2e/itinerary-export.spec.ts:213:7 › Itinerary Export — "Export to files…" › pressing Escape closes the picker without triggering a download`
8. `[chromium] › __tests__/e2e/itinerary-export.spec.ts:230:7 › Itinerary Export — "Export to files…" › clicking outside the picker closes it without triggering a download`
9. `[chromium] › __tests__/e2e/itinerary-export.spec.ts:247:7 › Itinerary Export — "Export to files…" › clicking the × button closes the picker without triggering a download`
10. `[chromium] › __tests__/e2e/itinerary-export.spec.ts:273:7 › Itinerary Export — "Export to files…" › Markdown export generates no additional /api/* network requests beyond page load`
11. `[chromium] › __tests__/e2e/itinerary-export.spec.ts:306:7 › Itinerary Export — "Export to files…" › clicking disabled PDF button generates no /api/* network requests (PDF temporarily disabled)`
12. `[chromium] › __tests__/e2e/itinerary-export.spec.ts:335:7 › Itinerary Export — "Export to files…" › exported Markdown has correct headers and NO Weekday column`
13. `[chromium] › __tests__/e2e/itinerary-export.spec.ts:373:7 › Itinerary Export — "Export to files…" › exported Markdown Plan cell combines morning/afternoon/evening, omits empty sections`
14. `[chromium] › __tests__/e2e/itinerary-export.spec.ts:413:7 › Itinerary Export — "Export to files…" › exported Markdown Train Schedule cell: DB trains show normalised ID only (no station names or times)`
15. `[chromium] › __tests__/e2e/itinerary-export.spec.ts:466:7 › Itinerary Export — "Export to files…" › anchor fallback is used and no error shown when showSaveFilePicker is unsupported`
16. `[chromium] › __tests__/e2e/itinerary-export.spec.ts:511:7 › Itinerary Export — "Export to files…" › export FAB has correct aria attributes (haspopup + expanded state)`
17. `[chromium] › __tests__/e2e/itinerary-export.spec.ts:530:7 › Itinerary Export — "Export to files…" › E2E-S1-01: after Markdown export, export-success-toast appears`
18. `[chromium] › __tests__/e2e/itinerary-export.spec.ts:541:7 › Itinerary Export — "Export to files…" › E2E-S1-02: success toast auto-disappears within 4s of appearing`
19. `[chromium] › __tests__/e2e/itinerary-export.spec.ts:553:7 › Itinerary Export — "Export to files…" › E2E-S1-03: clicking disabled PDF button does NOT show success toast (PDF temporarily disabled)`
20. `[chromium] › __tests__/e2e/itinerary-export.spec.ts:566:7 › Itinerary Export — "Export to files…" › E2E-S1-04: clicking export-toast-dismiss removes toast immediately`
21. `[chromium] › __tests__/e2e/itinerary-export.spec.ts:579:7 › Itinerary Export — "Export to files…" › E2E-S1-05: no toast shown when user cancels native save dialog (AbortError mock)`
22. `[chromium] › __tests__/e2e/itinerary-export.spec.ts:606:7 › Itinerary Export — "Export to files…" › E2E-S2-01: initial page load makes 0 requests to /fonts/ (lazy font loading)`
23. `[chromium] › __tests__/e2e/itinerary-export.spec.ts:619:7 › Itinerary Export — "Export to files…" › E2E-S2-02: clicking disabled PDF button makes 0 font requests to /fonts/ (PDF temporarily disabled)`
24. `[chromium] › __tests__/e2e/itinerary-export.spec.ts:644:7 › Itinerary Export — "Export to files…" › E2E-S3-01: export-fab is visible after scrolling to bottom of itinerary`
25. `[chromium] › __tests__/e2e/itinerary-export.spec.ts:656:7 › Itinerary Export — "Export to files…" › E2E-S3-02: clicking export-fab opens picker; export-md triggers download; toast appears`
26. `[chromium] › __tests__/e2e/itinerary-export.spec.ts:678:7 › Itinerary Export — "Export to files…" › E2E-S3-04: export-fab has correct aria-label when data exists`
27. `[chromium] › __tests__/e2e/itinerary.spec.ts:50:7 › Itinerary Tab › itinerary table renders with date "2026/9/25"`
28. `[chromium] › __tests__/e2e/itinerary.spec.ts:55:7 › Itinerary Tab › plan section "e2e-morning" is visible`
29. `[chromium] › __tests__/e2e/itinerary.spec.ts:60:7 › Itinerary Tab › all 16 days are shown (16 date cells matching date pattern)`
30. `[chromium] › __tests__/e2e/itinerary.spec.ts:67:7 › Itinerary Tab › double-clicking the morning plan row of day 1 shows a textarea pre-filled with "e2e-morning"`
31. `[chromium] › __tests__/e2e/itinerary.spec.ts:78:7 › Itinerary Tab › editing the textarea and blurring saves the new value (verify new text appears in cell)`
32. `[chromium] › __tests__/e2e/itinerary.spec.ts:99:7 › Itinerary Tab › drag-dropping morning to evening within day 1 swaps the values`
33. `[chromium] › __tests__/e2e/stay-edit.spec.ts:113:7 › Tab visibility › AC-1: authenticated — Itinerary panel shows table on default tab`
34. `[chromium] › __tests__/e2e/stay-edit.spec.ts:121:7 › Tab visibility › AC-1: clicking "Itinerary (Test)" tab shows test panel, hides primary`
35. `[chromium] › __tests__/e2e/stay-edit.spec.ts:131:7 › Tab visibility › AC-1: switching back from test tab to primary itinerary works`
36. `[chromium] › __tests__/e2e/stay-edit.spec.ts:140:7 › Tab visibility › AC-1: Itinerary (Test) tab also shows table when active`
37. `[chromium] › __tests__/e2e/stay-edit.spec.ts:164:7 › Stay edit affordance › AC-2: pencil edit button visible on a non-last overnight cell (stayIndex=0)`
38. `[chromium] › __tests__/e2e/stay-edit.spec.ts:169:7 › Stay edit affordance › AC-2: pencil edit button visible on stayIndex=1 (Augsburg)`
39. `[chromium] › __tests__/e2e/stay-edit.spec.ts:180:7 › Stay edit affordance › AC-2: clicking pencil opens the edit input for that stay`
40. `[chromium] › __tests__/e2e/stay-edit.spec.ts:186:7 › Stay edit affordance › AC-2: input is pre-filled with the current number of nights (4)`
41. `[chromium] › __tests__/e2e/stay-edit.spec.ts:194:7 › Stay edit affordance › AC-2: confirm and cancel buttons appear when editing`
42. `[chromium] › __tests__/e2e/stay-edit.spec.ts:201:7 › Stay edit affordance › AC-2: cancel closes the edit without submitting`
43. `[chromium] › __tests__/e2e/stay-edit.spec.ts:210:7 › Stay edit affordance › AC-2: Escape key cancels the edit`
44. `[chromium] › __tests__/e2e/stay-edit.spec.ts:219:7 › Stay edit affordance › AC-2: edit controls appear on Itinerary (Test) tab too`
45. `[chromium] › __tests__/e2e/stay-edit.spec.ts:242:7 › Stay edit — shrink and extend (primary Itinerary tab) › AC-3: shrink stay 0 from 4 to 2 — API confirms overnight reassignment`
46. `[chromium] › __tests__/e2e/stay-edit.spec.ts:263:7 › Stay edit — shrink and extend (primary Itinerary tab) › AC-3: shrink — no error toast shown`
47. `[chromium] › __tests__/e2e/stay-edit.spec.ts:271:7 › Stay edit — shrink and extend (primary Itinerary tab) › AC-4: extend stay 0 from 4 to 6 — no error toast shown`
48. `[chromium] › __tests__/e2e/stay-edit.spec.ts:279:7 › Stay edit — shrink and extend (primary Itinerary tab) › AC-4: extend — API confirms overnight reassignment (Paris goes to 6)`
49. `[chromium] › __tests__/e2e/stay-edit.spec.ts:296:7 › Stay edit — shrink and extend (primary Itinerary tab) › no-op confirm (same value) does not show error`
50. `[chromium] › __tests__/e2e/stay-edit.spec.ts:304:7 › Stay edit — shrink and extend (primary Itinerary tab) › AC-3: shrink persists after page reload`
51. `[chromium] › __tests__/e2e/stay-edit.spec.ts:323:7 › Stay edit — shrink and extend (primary Itinerary tab) › 16 date rows still present after a stay edit`
52. `[chromium] › __tests__/e2e/stay-edit.spec.ts:352:7 › Stay edit — Itinerary (Test) tab › AC-3: shrink on Test tab does NOT affect primary Itinerary tab store`
53. `[chromium] › __tests__/e2e/stay-edit.spec.ts:369:7 › Stay edit — Itinerary (Test) tab › AC-1: edits on Test tab go to route-test store (total stays 16)`
54. `[chromium] › __tests__/e2e/stay-edit.spec.ts:384:7 › Stay edit — Itinerary (Test) tab › AC-4: extend on Test tab — total days invariant preserved`
55. `[chromium] › __tests__/e2e/stay-edit.spec.ts:411:7 › Client-side validation › AC-5: entering 0 nights shows "at least 1 night" validation error`
56. `[chromium] › __tests__/e2e/stay-edit.spec.ts:419:7 › Client-side validation › AC-5: entering 0 nights does NOT call the API (no API error toast)`
57. `[chromium] › __tests__/e2e/stay-edit.spec.ts:426:7 › Client-side validation › AC-6: exceeding max nights shows "no nights left to borrow" error`
58. `[chromium] › __tests__/e2e/stay-edit.spec.ts:435:7 › Client-side validation › AC-6: inline error disappears when user corrects the input`
59. `[chromium] › __tests__/e2e/stay-edit.spec.ts:444:7 › Client-side validation › Enter key confirms valid edit and closes input`
60. `[chromium] › __tests__/e2e/stay-edit.spec.ts:459:7 › API failure — revert and error toast › AC-8: stay edit reverts and shows error toast on 500 response`
61. `[chromium] › __tests__/e2e/stay-edit.spec.ts:481:7 › API failure — revert and error toast › AC-8: stay edit shows error toast on 400 response`
62. `[chromium] › __tests__/e2e/stay-edit.spec.ts:644:7 › Regression: adjacent itinerary flows › plan content is visible in the primary Itinerary panel`
63. `[chromium] › __tests__/e2e/stay-edit.spec.ts:677:7 › Regression: adjacent itinerary flows › switching to Test tab and back does not lose primary data`
64. `[chromium] › __tests__/e2e/stay-edit.spec.ts:696:7 › Regression: adjacent itinerary flows › primary itinerary has exactly 16 date cells (scoped to panel)`
65. `[chromium] › __tests__/e2e/train-schedule-json-editor.spec.ts:41:7 › Train Schedule JSON Editor › pencil button is visible for a day that has train data`
66. `[chromium] › __tests__/e2e/train-schedule-json-editor.spec.ts:47:7 › Train Schedule JSON Editor › modal opens on pencil button click`
67. `[chromium] › __tests__/e2e/train-schedule-json-editor.spec.ts:59:7 › Train Schedule JSON Editor › modal textarea contains valid JSON of train data`
68. `[chromium] › __tests__/e2e/train-schedule-json-editor.spec.ts:77:7 › Train Schedule JSON Editor › textarea is editable — user can clear and type new content`
69. `[chromium] › __tests__/e2e/train-schedule-json-editor.spec.ts:89:7 › Train Schedule JSON Editor › cancel button closes modal without saving`
70. `[chromium] › __tests__/e2e/train-schedule-json-editor.spec.ts:101:7 › Train Schedule JSON Editor › escape key closes modal`
71. `[chromium] › __tests__/e2e/train-schedule-json-editor.spec.ts:113:7 › Train Schedule JSON Editor › valid edit saves and closes modal — no error shown`
72. `[chromium] › __tests__/e2e/train-schedule-json-editor.spec.ts:133:7 › Train Schedule JSON Editor › invalid JSON shows error message on save`

## Artifacts
- HTML report: `travel-plan-web-next/playwright-report/index.html`
- Per-test failure artifacts (screenshots + error contexts): `travel-plan-web-next/test-results/`
- Raw command output capture: `/Users/bytedance/.local/share/opencode/tool-output/tool_d05bcb432001wBFMH2GgmrWtbc`
- Trace artifacts: not generated (`trace: on-first-retry` and `retries: 0`)
