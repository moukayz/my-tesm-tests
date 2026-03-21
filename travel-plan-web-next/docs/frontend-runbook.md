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

Validate changes with the standard project checks before merge:

```bash
npm test
npm run test:e2e
```

For local verification, focus on the full user journey, visible loading and error states, and any browser-specific behaviour that affects saving, editing, or authentication.

---

## 3. Production Build

```bash
npm run build
```

Build must pass with zero TypeScript and lint errors before merging.

---

## 4. Export Feature (`itinerary-export`)

### How it works

Authenticated itinerary views expose an export action that lets users save the current itinerary as Markdown or PDF.

**User flow:**
1. User clicks "Export to files…" → format picker opens.
2. User selects "Markdown (.md)" or "PDF (.pdf)".
3. File is saved via:
   - **Chrome/Edge**: File System Access API (`showSaveFilePicker`) — native save dialog with directory picker.
   - **Firefox/Safari**: Anchor `<a download>` fallback — triggers download to default Downloads folder.
4. Picker closes on success. PDF errors show an inline banner; Markdown option remains available.

### PDF library

- **Library:** `jsPDF` + `jspdf-autotable`
- **Loading:** dynamically imported in `buildPdfBlob()` — NOT on the initial bundle
- **CJK limitation (v1):** CJK characters in Overnight / Plan cells may render as `?` in the PDF (Helvetica only). This is a known v1 limitation (OQ-1 decision: accept for now).
- **Orientation:** landscape A4

### Data source

Export uses the itinerary exactly as the user currently sees it, including in-session edits. No extra save step is required before exporting.

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
- Check that itinerary data is present. Export is unavailable when there is nothing to save.

### PDF shows `?` for CJK characters
- Known v1 limitation. jsPDF's built-in Helvetica font does not support CJK. A future version may embed a CJK font.

### PDF download doesn't start (no dialog, no file)
- Check the browser console for PDF generation errors.
- Confirm dependencies installed cleanly and rebuild if the issue appears after a fresh checkout.

### Anchor fallback used instead of Save dialog
- Expected on Firefox and Safari — `showSaveFilePicker` is Chrome/Edge only. The anchor fallback saves to the browser's default downloads folder.

### `showSaveFilePicker` throws `AbortError`
- User cancelled the native dialog. No error message should be shown.

---

## 6. Validation Focus (itinerary-export)

- Validate both export formats from the authenticated itinerary view.
- Confirm the picker opens, closes cleanly, and surfaces user-facing PDF errors without blocking Markdown export.
- Confirm browser-specific save behavior degrades gracefully when native save APIs are unavailable or cancelled.
- Confirm export does not regress itinerary editing or other core itinerary interactions.

---

## 7. Editable Itinerary Stays (`editable-itinerary-stays`)

### How it works

Authenticated users can edit stay duration directly in the itinerary. The main itinerary and the test itinerary stay isolated from each other.

**User flow:**
1. Authenticated user sees both **Itinerary** and **Itinerary (Test)** tabs.
2. On any non-last overnight cell, a pencil icon appears.
3. Clicking the pencil opens an inline number input pre-filled with current nights.
4. User edits the value → **Enter** or ✓ to confirm, **Escape** or ✕ to cancel.
5. On confirm, the UI updates immediately and then syncs with the server.
6. On success, the saved itinerary remains visible.
7. On failure, the edit reverts and an error message appears.

### Validation focus for stay edits

- Confirm both itinerary tabs stay isolated and preserve their own edits.
- Confirm optimistic updates, server reconciliation, and revert-on-error behavior remain intact.
- Confirm keyboard editing and auth-gated tab visibility still behave correctly.

### Troubleshooting stay edits

#### Error toast appears after edit
- The save request failed or could not reach the server.
- The itinerary should revert automatically to the last confirmed state.
- Retry after checking auth state, backend availability, and network connectivity.

#### Pencil button absent on overnight cell
- The final stay is not editable by design.
- Verify the selected overnight block is not the last distinct stop in the itinerary.

#### `Itinerary (Test)` tab not visible
- The test itinerary is only available to authenticated users.
- Re-authenticate if the tab disappears unexpectedly.

#### Double edit prevention
- Concurrent stay edits are intentionally blocked while a save is in progress.
- Wait for the current save to finish before retrying.

---

## 8. Troubleshooting — `itinerary-export-ux-pdf-fixes`

### CJK font (PDF): inline export error shows "could not load font"
- Check that the bundled PDF font asset is present and served correctly.
- If the asset cannot be loaded, PDF export will fail with a user-visible error while Markdown export should remain available.

### Floating export button (FAB): not visible
- Confirm the active itinerary view is visible and the user is authenticated.
- Check for viewport-specific layout issues if the control appears on some screen sizes but not others.

### Success toast: not appearing after export
- A success message appears only after the file save completes.
- If the user cancels the save dialog or PDF generation fails, no success toast should appear.

### Font file size (deviation from LLD target)
- The CJK font asset is intentionally loaded only when PDF export is used.
- Larger font payloads mainly affect the export action, not the initial page load.
