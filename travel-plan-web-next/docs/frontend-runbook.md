# Frontend Runbook — Travel Plan Web (Next.js)

**Last updated:** 2026-03-19  
**Feature coverage:** core itinerary UI + `itinerary-export` feature + `itinerary-export-ux-pdf-fixes` + `editable-itinerary-stays`

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

## 2. Frontend Validation

Use the standard project scripts to validate frontend changes before merge:

```bash
# Frontend unit, component, and integration validation
npm test

# Browser-level regression validation
npm run test:e2e
```

Targeted local debugging is acceptable, but this runbook intentionally avoids feature-specific commands and file-pattern guidance. Focus on validating the affected journey end to end, then finish with the standard full-suite scripts above.

---

## 3. Production Build

```bash
npm run build
```

Build must pass with zero TypeScript and lint errors before merging.

---

## 4. Export Feature (`itinerary-export`)

### How it works

The export affordance is rendered inside each authenticated itinerary panel as a floating action button managed by `ItineraryTab`.

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
| `app/lib/cjkFontLoader.ts` | Lazy font loading for PDF export |
| `components/FloatingExportButton.tsx` | Export trigger owned by each itinerary panel |
| `components/ExportFormatPicker.tsx` | Format picker popover (Markdown / PDF) |
| `components/ExportSuccessToast.tsx` | Success feedback after completed export |

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

---

## 6. Validation Focus (itinerary-export)

- Validate both export formats from the authenticated itinerary view.
- Confirm the picker opens, closes cleanly, and surfaces user-facing PDF errors without blocking Markdown export.
- Confirm browser-specific save behavior degrades gracefully when native save APIs are unavailable or cancelled.
- Confirm export remains client-side and does not regress itinerary editing, drag-and-drop, or train JSON editing flows.

---

## 7. Editable Itinerary Stays (`editable-itinerary-stays`)

### How it works

Two `ItineraryTab` instances are mounted simultaneously (keep-alive pattern). Each is isolated by its `tabKey` prop (`"route"` / `"route-test"`). Stay editing is an inline action on overnight merged cells.

**User flow:**
1. Authenticated user sees both **Itinerary** and **Itinerary (Test)** tabs.
2. On any non-last overnight cell, a pencil icon appears.
3. Clicking the pencil opens an inline number input pre-filled with current nights.
4. User edits the value → **Enter** or ✓ to confirm, **Escape** or ✕ to cancel.
5. On confirm: optimistic update is applied immediately; `POST /api/stay-update` is called.
6. On success: server `updatedDays` replaces local state.
7. On failure: local state reverts to pre-edit snapshot; error toast appears.

### Key components

| Component / module | Responsibility |
|---|---|
| `components/TravelPlan.tsx` | Mounts both `ItineraryTab` instances; manages tab switching; `itinerary-test` tab |
| `components/ItineraryTab.tsx` | Owns `days` state; optimistic update + snapshot-revert logic; `tabKey` forwarding |
| `components/StayEditControl.tsx` | Inline edit widget inside overnight cell; client-side validation; keyboard a11y |
| `app/lib/stayUtils.ts` | Pure functions: `getStays`, `getStaysWithMeta`, `applyStayEdit`, `applyStayEditOptimistic` |

### API contracts

```
POST /api/stay-update
{ tabKey: 'route' | 'route-test', stayIndex: number, newNights: number }
→ 200: { updatedDays: RouteDay[] }
→ 4xx/5xx: { error: string }

POST /api/plan-update (extended)
{ dayIndex: number, plan: PlanSections, tabKey: 'route' | 'route-test' }
```

### Validation focus for stay edits

- Confirm both itinerary tabs stay isolated and preserve their own edits.
- Confirm optimistic updates, server reconciliation, and revert-on-error behavior remain intact.
- Confirm keyboard editing and auth-gated tab visibility still behave correctly.

### Troubleshooting stay edits

#### Error toast appears after edit
- The error toast is shown when `POST /api/stay-update` returns a non-2xx or network error.
- The edit reverts to the pre-edit snapshot automatically.
- Dismiss the toast with the ✕ button; it clears `stayEditError` state.

#### Pencil button absent on overnight cell
- The pencil is hidden for the **last stay** by design — `StayEditControl` returns `null` when `isLast=true`.
- Verify the overnight cell is not the last distinct city in the itinerary.

#### `Itinerary (Test)` tab not visible
- Tab is only rendered for authenticated users (`isLoggedIn=true`).
- Check that `auth()` returns a valid session in `app/page.tsx`.

#### `tabKey` not forwarded in plan-update body
- The `handleEditBlur` and `autoSavePlan` functions both include `tabKey` in the request body.
- If this is missing in production, check that the `ItineraryTab` instance received its `tabKey` prop from `TravelPlan`.

#### Double edit prevention
- While `stayEditSaving=true`, the pencil button for all stays is disabled.
- This prevents concurrent overlapping edits.

---

## 8. Troubleshooting — `itinerary-export-ux-pdf-fixes`

### CJK font (PDF): inline export error shows "could not load font"
- Check that `public/fonts/NotoSansSC-subset.ttf` is present in the repository and served correctly.
- In development: navigate to `http://localhost:3000/fonts/NotoSansSC-subset.ttf` — expect a binary download, not a 404.
- The font is loaded lazily only when the user triggers PDF export. If the font file is missing, PDF generation will fail with a user-visible error banner.

### Floating export button (FAB): not visible
- The FAB uses `position: fixed; top: 50%; right: 1rem; z-index: 40` via Tailwind CSS.
- It is rendered inside each `ItineraryTab` subtree so the active itinerary panel owns its own export controls.
- If the FAB is missing, check that the expected itinerary panel is active and visible.

### Success toast: not appearing after export
- The toast is rendered conditionally when `exportSuccess === true` in `ItineraryTab`.
- `exportSuccess` is set to `true` ONLY in the success branch of `handleExportMarkdown` / `handleExportPdf` — AFTER `saveFile()` resolves without error.
- If the user cancels the native save dialog (`AbortError`) or if PDF generation fails, no toast is shown (by design).

### Font file size (deviation from LLD target)
- The LLD targets ≤200 KB for the font subset. The actual committed file (`NotoSansSC-subset.ttf`) is ~4.9 MB.
- This is because the CJK Unified Ideographs block (`U+4E00–U+9FFF`) contains ~20K glyphs; it cannot be compressed below ~3–5 MB in a standard TTF with full glyph coverage.
- Mitigation: the font is loaded lazily only when the user triggers PDF export, not on initial page load.
