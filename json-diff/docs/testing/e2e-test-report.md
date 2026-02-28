# E2E Test Report — JSON Diff Checker

> **Date:** 2026-02-27  
> **Browser:** Chromium (Desktop Chrome)  
> **Framework:** Playwright  
> **Total tests:** 22  
> **Passed:** 22  
> **Failed:** 0  
> **Duration:** ~5.3s

---

## Summary

All 22 E2E tests covering acceptance criteria AC-1 through AC-8 pass against the JSON Diff Checker frontend app. The app correctly implements:

- Valid JSON comparison with auto-formatting and key sorting
- Key-order normalization eliminating false positives
- Invalid JSON error handling with inline messages
- Empty input validation
- Identical-JSON detection with "No differences found" message
- Clear/reset functionality
- Colour-coded diff highlights (green added, red removed, white unchanged)
- Accessible text markers (`+`/`-`) supplementing colour indicators

---

## Detailed Results by Acceptance Criteria

### AC-1: Valid JSON Compare — PASS (2/2)

| Test | Result |
|---|---|
| Display diff with additions, removals, unchanged lines | PASS |
| Auto-format and key-sort both inputs on compare | PASS |

### AC-2: Key Sorting Normalizes Order Differences — PASS (2/2)

| Test | Result |
|---|---|
| `{"b":1,"a":2}` vs `{"a":2,"b":1}` → No differences found | PASS |
| Nested object key ordering normalized | PASS |

### AC-3: Invalid JSON Error Handling — PASS (4/4)

| Test | Result |
|---|---|
| Error near left panel for invalid left JSON | PASS |
| Error near right panel for invalid right JSON | PASS |
| Errors on both panels when both invalid | PASS |
| `aria-invalid` attribute set on error textarea | PASS |

### AC-4: Empty Input Validation — PASS (4/4)

| Test | Result |
|---|---|
| Validation error when left input is empty | PASS |
| Validation error when right input is empty | PASS |
| Validation errors on both panels when both empty | PASS |
| Validation error for whitespace-only input | PASS |

### AC-5: Identical JSON After Normalization — PASS (4/4)

| Test | Result |
|---|---|
| Identical JSON → No differences found | PASS |
| Whitespace/formatting differences only → No differences found | PASS |
| Identical arrays → No differences found | PASS |
| Identical primitives → No differences found | PASS |

### AC-6: Clear / Reset — PASS (4/4)

| Test | Result |
|---|---|
| Clear after diff → inputs empty, diff removed | PASS |
| Clear after identical → inputs empty, message removed | PASS |
| Clear after validation error → errors removed | PASS |
| Clear on empty state (safe no-op) | PASS |

### AC-7: Diff Highlights — PASS (1/1)

| Test | Result |
|---|---|
| Added rows green bg, removed rows red bg, equal rows neutral | PASS |

### AC-8: Accessibility — Color + Label — PASS (1/1)

| Test | Result |
|---|---|
| `+` marker on added lines, `-` marker on removed lines | PASS |

---

## Test Coverage Matrix

| AC | Description | # Tests | Status |
|---|---|---|---|
| AC-1 | Valid JSON Compare | 2 | PASS |
| AC-2 | Key Sorting Normalizes Order Differences | 2 | PASS |
| AC-3 | Invalid JSON Error Handling | 4 | PASS |
| AC-4 | Empty Input Validation | 4 | PASS |
| AC-5 | Identical JSON After Normalization | 4 | PASS |
| AC-6 | Clear / Reset | 4 | PASS |
| AC-7 | Diff Highlights | 1 | PASS |
| AC-8 | Accessibility — Color + Label | 1 | PASS |
| **Total** | | **22** | **ALL PASS** |
