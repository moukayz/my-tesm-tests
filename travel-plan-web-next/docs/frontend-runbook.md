# Frontend Runbook — Travel Plan Web (Next.js)

**Last updated:** 2026-03-23  
**Feature coverage:** core itinerary UI + `itinerary-export` feature + `itinerary-export-ux-pdf-fixes` + `editable-itinerary-stays` + `itinerary-creation-and-stay-planning` + `itinerary-cards-navigation` + `itinerary-detail-ux-cleanup` + `itinerary-desktop-adjustments` + `itinerary-location-autocomplete`

---

## 1. Local Frontend Dev

### Prerequisites

- Node.js 18+
- `npm install` completed

### Start dev server

```bash
# Local data sources (Docker + local parquets)
npm run dev:local

# Cloud PostgreSQL data source (Neon)
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

---

## 9. Itinerary Creation And Stay Planning (`itinerary-creation-and-stay-planning`)

### How it works

Authenticated users can create itinerary shells and then build stays progressively in an itinerary-scoped workspace.

**User flow:**
1. Open the **Itinerary** tab and click **New itinerary**.
2. Submit optional name + required start date.
3. App navigates to `/?tab=itinerary&itineraryId=<id>`.
4. Empty workspace appears with **Add first stay**.
5. Add first stay (city + nights) to mount the itinerary table.
6. Continue with **Add next stay**, quick inline nights edit, or full **Edit stay** (city + nights).

### Frontend checks for this feature

Run these checks in this workspace before handoff:

```bash
npm test -- CreateItineraryModal.test.tsx ItineraryWorkspace.test.tsx TravelPlan.test.tsx ItineraryTab.test.tsx
npm test
```

### Troubleshooting itinerary workspace

#### `Selected itinerary was not found` or `access denied`
- The `itineraryId` in URL is stale or belongs to another user.
- Use **Open latest itinerary** to recover to a valid workspace.

#### Stay edit shows `Workspace changed in another session`
- Another tab/session updated the same itinerary.
- Retry the action from the refreshed workspace state.

#### Can't start new itinerary while editing a day row
- Unsaved inline day edits intentionally block tab switching and new shell creation.
- Finish the inline edit (commit or cancel) and retry.

---

## 10. Itinerary Cards Navigation (`itinerary-cards-navigation`)

### How it works

Authenticated users now enter the **Itinerary** tab through a cards library view.

**User flow:**
1. Open `/?tab=itinerary`.
2. Cards view lists saved itineraries for the signed-in user.
3. Click a card to open `/?tab=itinerary&itineraryId=<id>` in the existing editor workspace.
4. Use **Back to all itineraries** to return to cards view.

### Frontend checks for this feature

Run these checks in this workspace before handoff:

```bash
npm test -- TravelPlan.test.tsx ItineraryPanel.test.tsx ItineraryWorkspace.test.tsx
npm run test:e2e -- itinerary-cards-navigation.spec.ts
```

### Troubleshooting cards navigation

#### Itinerary tab opens detail directly instead of cards
- Verify URL does not include `itineraryId`.
- Use `/?tab=itinerary` for cards-first entry.

#### Back action does not return to cards
- If unsaved inline edits exist, the discard dialog blocks immediate navigation.
- Choose **Leave without saving** to continue back navigation.

#### Selected itinerary cannot be opened
- Workspace error panel provides **Back to all itineraries** recovery.
- Retry from cards after verifying session ownership and itinerary availability.

---

## 11. Itinerary Detail UX Cleanup (`itinerary-detail-ux-cleanup`)

### Desktop behavior

- Detail shell keeps only **Back to all itineraries** (no duplicated title/date in shell chrome).
- Populated workspace shows one compact metadata header (title + start date once).
- Populated workspace exposes one **Add next stay** action.
- The above-table `Edit stay for {city}` action row is removed.
- Full **Edit stay** remains in overnight stay cells, with quick inline nights edit preserved for eligible non-last stays.

### Frontend checks for this feature

```bash
npm test -- __tests__/components/ItineraryDetailShell.test.tsx __tests__/components/ItineraryWorkspace.test.tsx __tests__/components/ItineraryTab.test.tsx
npm run test:e2e -- __tests__/e2e/itinerary-creation-workspace.spec.ts __tests__/e2e/itinerary-cards-navigation.spec.ts
```

### Troubleshooting detail cleanup

#### Duplicate `Add next stay` is visible
- Verify the action is rendered only in `ItineraryWorkspace` populated header.
- Confirm `ItineraryTab` does not render the legacy table-top utility strip.

#### `Edit stay for {city}` appears above table
- Verify workspace-level per-stay action chips are removed.
- Use the stay-cell **Edit stay** trigger inside the Overnight column.

---

## 12. Itinerary Desktop Adjustments (`itinerary-desktop-adjustments`)

### Desktop behavior

- Cards rail is left-aligned with larger card click targets.
- `Starter route` section shows `Original seeded route` as its own card.
- Selecting starter route opens seeded detail in the same shell using `legacyTabKey=route`.
- Main itinerary detail shell stays on a wide desktop rail aligned with `Itinerary (Test)`.

### Frontend checks for this feature

```bash
npm test -- __tests__/components/ItineraryCardsView.test.tsx __tests__/components/ItineraryPanel.test.tsx __tests__/components/ItineraryDetailShell.test.tsx __tests__/components/TravelPlan.test.tsx
npm run test:e2e -- __tests__/e2e/itinerary-cards-navigation.spec.ts
```

### Troubleshooting desktop adjustments

#### Starter route card is missing
- Verify authenticated entry is `/?tab=itinerary` and seeded route data loads.

#### Starter route opens but URL lacks `legacyTabKey=route`
- Confirm cards open handler writes `legacyTabKey` and clears `itineraryId`.

#### Main detail appears narrower than `Itinerary (Test)`
- Verify itinerary panel/detail wrappers keep `w-full` desktop rail classes.

---

## 13. Itinerary Location Autocomplete (`itinerary-location-autocomplete`)

### How it works

- Stay location input in **Add next stay** and **Edit stay** calls backend API `GET /api/locations/search` after 2+ non-space characters.
- Dropdown always shows a custom option first (`Use "<typed text>" as a custom location`) and up to 5 backend-normalized candidates.
- Selecting a candidate stores resolved metadata (coordinates + normalized place fields).
- Editing typed text after selection clears the resolved draft until a new candidate is selected.
- Saving custom text stores only custom location text and clears stale resolved metadata.

### Frontend checks for this feature

```bash
npm test -- StaySheet.test.tsx LocationAutocompleteField.test.tsx ItineraryWorkspace.test.tsx locationSearch.test.ts
```

### Troubleshooting location autocomplete

#### Suggestions never appear
- Verify backend location search route `GET /api/locations/search` is available for the signed-in session.
- Confirm typed query has at least 2 non-space characters.

#### Backend location search fails or returns no matches
- Expected fallback: user can still save custom text with no blocking error.
- Check browser network panel for `/api/locations/search` request status and response payload.
