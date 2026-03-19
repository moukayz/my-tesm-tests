# Frontend Runbook — Travel Plan Web (Next.js)

**Last updated:** 2026-03-19  
**Feature coverage:** core itinerary UI + `itinerary-export` feature + `itinerary-export-ux-pdf-fixes`

---

## 1. Local Frontend Dev

### Prerequisites

- Node.js 18+
- `npm install` completed

### Start dev server

```bash
# Local data sources (Docker + local parquets)
npm run dev:local

# Cloud data sources (MotherDuck + Neon)
npm run dev:cloud
```

App opens at [http://localhost:3000](http://localhost:3000).

### Environment variables (frontend-relevant)

| Variable | Purpose | Required |
|---|---|---|
| `GOOGLE_CLIENT_ID` | Google OAuth | Yes (auth) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth | Yes (auth) |
| `AUTH_SECRET` | NextAuth.js session signing | Yes |
| `ALLOWED_EMAIL` | Restrict login to one account | No |

---

## 2. Running Frontend Tests

### Unit + component + integration tests (Jest)

```bash
# All Jest tests (silent dot reporter)
npm test

# Verbose output (test names visible)
npm run test:verbose

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

**Expected output:** 355 tests, 25 suites, 0 failures.

### Run only export-feature tests

```bash
# Unit tests for transform logic
npm test -- "itineraryExport"

# Unit tests for fileSave utility
npm test -- "fileSave"

# Component tests for ExportToolbar
npm test -- "ExportToolbar"

# Component tests for ExportFormatPicker
npm test -- "ExportFormatPicker"

# Integration tests (export flows inside ItineraryTab)
npm test -- "ItineraryTab"
```

### E2E tests (Playwright)

```bash
# Cloud mode (requires .env.local with MotherDuck + Neon creds)
npm run test:e2e

# Local mode (requires Docker + GTFS data loaded)
npm run test:e2e:local

# Interactive Playwright UI
npm run test:e2e:ui
```

---

## 3. Production Build

```bash
npm run build
```

Build must pass with zero TypeScript and lint errors before merging.

---

## 4. Export Feature (`itinerary-export`)

### How it works

The "Export to files…" button is rendered in a toolbar above the itinerary table (inside `ItineraryTab`). It is always present for authenticated users (the Itinerary tab is only rendered when authenticated).

**User flow:**
1. User clicks "Export to files…" → format picker opens.
2. User selects "Markdown (.md)" or "PDF (.pdf)".
3. File is saved via:
   - **Chrome/Edge**: File System Access API (`showSaveFilePicker`) — native save dialog with directory picker.
   - **Firefox/Safari**: Anchor `<a download>` fallback — triggers download to default Downloads folder.
4. Picker closes on success. PDF errors show an inline banner; Markdown option remains available.

### Key modules

| Module | Purpose |
|---|---|
| `app/lib/itineraryExport.ts` | Pure transform functions: `buildPlanCell`, `buildTrainCell`, `stripMarkdown`, `toExportRows`, `buildMarkdownTable`, `buildPdfBlob` |
| `app/lib/fileSave.ts` | `saveFile()`: File System Access API → anchor fallback |
| `components/ExportToolbar.tsx` | Presentational toolbar with the trigger button |
| `components/ExportFormatPicker.tsx` | Format picker popover (Markdown / PDF) |

### PDF library

- **Library:** `jsPDF` + `jspdf-autotable`
- **Loading:** dynamically imported in `buildPdfBlob()` — NOT on the initial bundle
- **CJK limitation (v1):** CJK characters in Overnight / Plan cells may render as `?` in the PDF (Helvetica only). This is a known v1 limitation (OQ-1 decision: accept for now).
- **Orientation:** landscape A4

### Data model

The export uses the **effective** `RouteDay[]` — i.e., `planOverrides` and `trainOverrides` applied on top of `initialData`. No extra API calls are made during export.

### Markdown format

```
| Date | Day | Overnight | Plan | Train Schedule |
|------|-----|-----------|------|----------------|
| 2026/9/25 | 1 | 巴黎 | Morning: Arrive\nAfternoon: Eiffel Tower | — |
```

- Weekday column is **not** included.
- Newlines inside cells are represented as literal `\n` (GFM pipe tables cannot contain real newlines in cells).

---

## 5. Troubleshooting

### Export button disabled
- Check that `initialData` is non-empty. The button is disabled (with tooltip) when there are zero rows.

### PDF shows `?` for CJK characters
- Known v1 limitation. jsPDF's built-in Helvetica font does not support CJK. A future version may embed a CJK font.

### PDF download doesn't start (no dialog, no file)
- Check browser console for errors from `buildPdfBlob`.
- Verify `jspdf` and `jspdf-autotable` are installed: `npm list jspdf jspdf-autotable`.

### Anchor fallback used instead of Save dialog
- Expected on Firefox and Safari — `showSaveFilePicker` is Chrome/Edge only. The anchor fallback saves to the browser's default downloads folder.

### `showSaveFilePicker` throws `AbortError`
- User cancelled the native dialog. This is silently swallowed — no error is shown. This is correct behaviour.

### Test mocking
- In Jest tests, `app/lib/fileSave` and `app/lib/itineraryExport` are mocked at the test file level using `jest.mock()`. Tests in `ItineraryTab.test.tsx` → `ItineraryTab - Export Feature` describe block use these mocks. If you add a new test that needs the real implementation, use `jest.unmock()` or create a separate test file.

---

## 6. Test Coverage Summary (itinerary-export)

| Test file | Tests | What it covers |
|---|---|---|
| `__tests__/unit/itineraryExport.test.ts` | 48 | `buildPlanCell`, `buildTrainCell`, `stripMarkdown`, `buildMarkdownTable`, `toExportRows`, `buildPdfBlob` CJK integration |
| `__tests__/unit/fileSave.test.ts` | 10 | `saveFile` — File System Access API path + anchor fallback path |
| `__tests__/unit/cjkFontLoader.test.ts` | 8 | `loadCjkFont` singleton, fetch, VFS registration, error propagation |
| `__tests__/components/ExportToolbar.test.tsx` | 10 | Legacy export button (component kept for reference) |
| `__tests__/components/ExportSuccessToast.test.tsx` | 10 | Toast render, auto-dismiss timer, manual dismiss, timer cleanup |
| `__tests__/components/FloatingExportButton.test.tsx` | 11 | FAB states (enabled/disabled), aria attributes, click handler |
| `__tests__/components/ExportFormatPicker.test.tsx` | 16 | Format buttons, Escape/outside-click dismiss, spinner, error banner |
| `__tests__/components/ItineraryTab.test.tsx` (export section) | 24 | Integration: FAB testid migration, open picker, Markdown/PDF export, toast states, error/abort cases |

### Running export-specific tests (copy-paste ready)

```bash
# Unit/component tests only
cd travel-plan-web-next && npm test -- --no-coverage --testPathPatterns="ExportSuccessToast|FloatingExportButton|cjkFontLoader|itineraryExport|ItineraryTab"

# Full Jest suite
cd travel-plan-web-next && npm test -- --no-coverage

# E2E itinerary-export tests (Chromium)
cd travel-plan-web-next && npm run test:e2e -- --project=chromium --grep="itinerary-export"
```

---

## 7. Troubleshooting — `itinerary-export-ux-pdf-fixes`

### CJK font (PDF): `export-pdf-error` shows "could not load font"
- Check that `public/fonts/NotoSansSC-subset.ttf` is present in the repository and served correctly.
- In development: navigate to `http://localhost:3000/fonts/NotoSansSC-subset.ttf` — expect a binary download, not a 404.
- The font is loaded lazily only when the user triggers PDF export. If the font file is missing, PDF generation will fail with a user-visible error banner.
- In tests: `cjkFontLoader.test.ts` mocks `fetch` — the actual file is not needed for unit tests to pass.

### Floating export button (FAB): not visible
- The FAB uses `position: fixed; top: 50%; right: 1rem; z-index: 40` via Tailwind CSS.
- It is rendered into `document.body` via `ReactDOM.createPortal`. If a CSS `transform`, `filter`, or `perspective` is applied to any ancestor above `document.body`, this will not cause issues (portal bypasses ancestor stacking contexts).
- If the FAB is missing, check that `ItineraryTab` is mounted (requires authenticated user) and that the SSR guard (`typeof document !== 'undefined'`) is not blocking render in a non-SSR context.

### Success toast: not appearing after export
- The toast is rendered conditionally when `exportSuccess === true` in `ItineraryTab`.
- `exportSuccess` is set to `true` ONLY in the success branch of `handleExportMarkdown` / `handleExportPdf` — AFTER `saveFile()` resolves without error.
- If the user cancels the native save dialog (`AbortError`) or if PDF generation fails, no toast is shown (by design).
- In tests: `ItineraryTab.test.tsx` → `ItineraryTab - Export Feature` mocks `saveFile` to resolve successfully by default.

### Font file size (deviation from LLD target)
- The LLD targets ≤200 KB for the font subset. The actual committed file (`NotoSansSC-subset.ttf`) is ~4.9 MB.
- This is because the CJK Unified Ideographs block (`U+4E00–U+9FFF`) contains ~20K glyphs; it cannot be compressed below ~3–5 MB in a standard TTF with full glyph coverage.
- Mitigation: the font is loaded lazily (only on PDF export, not on page load). The `E2E-S2-01` test confirms zero font requests on initial page load.
