# Contracts — Itinerary Export

**Status:** Updated | **Date:** 2026-03-19 | **Author:** Frontend Tech Lead  
**Change:** Updated for `itinerary-export-ux-pdf-fixes` — adds `FloatingExportButton`, `ExportSuccessToast`, `loadCjkFont`; removes `ExportToolbar`; adds new state slices to `ItineraryTab`.  
All types are TypeScript strict-mode, compile-time only.

---

## 1. Shared Types (re-used, do not redefine)

```ts
import type { RouteDay, TrainRoute, PlanSections } from '../app/lib/itinerary'
```

---

## 2. Data Models (`app/lib/itineraryExport.ts`)

```ts
/** Normalised intermediate row for Markdown and PDF renderers. One per RouteDay. */
export interface ExportRow {
  date: string          // e.g. "2026/9/25" — verbatim from RouteDay.date
  day: string           // e.g. "1"          — String(RouteDay.dayNum)
  overnight: string     // e.g. "巴黎" | "—"
  plan: string          // buildPlanCell() output; Markdown preserved (MD) or stripped (PDF)
  trainSchedule: string // buildTrainCell() output; train IDs only, never station/times
}

/** Options for saveFile() in app/lib/fileSave.ts */
export interface SaveFileOptions {
  content: string | Blob
  filename: string  // e.g. "itinerary.md"
  mimeType: string  // e.g. "text/markdown" | "application/pdf"
}
```

---

## 2a. ItineraryTab Internal State (post-fix)

```ts
// Export state in ItineraryTab.tsx (itinerary-export-ux-pdf-fixes)
const [floatingPickerOpen, setFloatingPickerOpen] = useState(false)
  // Was: exportPickerOpen. Controls the format picker opened by FloatingExportButton.

const [exportError, setExportError] = useState<string | null>(null)
  // Unchanged. Error message for PDF generation failures; shown inline in picker.

const [isPdfGenerating, setIsPdfGenerating] = useState(false)
  // Unchanged. True while buildPdfBlob is running; triggers spinner in picker.

const [exportSuccess, setExportSuccess] = useState(false)
  // NEW. True after saveFile() resolves successfully (Markdown or PDF).
  // Drives rendering of ExportSuccessToast. Reset to false by onDismiss.

const floatingButtonRef = useRef<HTMLButtonElement>(null)
  // Was: exportButtonRef. Forwarded to FloatingExportButton for focus-return after picker closes.
```

---

## 3. Transform Functions (`app/lib/itineraryExport.ts`)

```ts
// Joins non-empty morning/afternoon/evening as "Label: value\n…"; "—" if all empty. No Markdown stripping.
export function buildPlanCell(plan: PlanSections): string

// Normalised train IDs one per line (via normalizeTrainId()); "—" for empty. No station names/times.
export function buildTrainCell(trains: TrainRoute[]): string

// Strips **bold**, *italic*, `code`, ~~del~~, list prefixes. Headings/links untouched.
export function stripMarkdown(text: string): string

// RouteDay[] → ExportRow[] (1:1, same order). stripMarkdownInPlan=true for PDF path.
export function toExportRows(data: RouteDay[], opts: { stripMarkdownInPlan: boolean }): ExportRow[]

// GFM pipe table: Date | Day | Overnight | Plan | Train Schedule ("Weekday" excluded).
export function buildMarkdownTable(data: RouteDay[]): string

// PDF Blob via jsPDF + jspdf-autotable, landscape A4, dynamic import (no SSR).
// MODIFIED: now calls loadCjkFont(doc) before autoTable(). Throws on failure.
export async function buildPdfBlob(data: RouteDay[]): Promise<Blob>
```

---

## 4. File Save Utility (`app/lib/fileSave.ts`)

```ts
// 1. File System Access API (Chrome/Edge) — native "Save As". 2. Anchor download fallback (Safari/Firefox).
// AbortError silently swallowed; all other errors re-thrown.
export async function saveFile(opts: SaveFileOptions): Promise<void>
```

---

## 4a. CJK Font Loader (`app/lib/cjkFontLoader.ts`) — NEW

```ts
/**
 * Lazily fetches the CJK font asset from /fonts/NotoSansSC-subset.ttf,
 * converts it to base64, and registers it with the given jsPDF instance.
 *
 * Singleton: font bytes are fetched at most once per browser session.
 * The jsPDF Virtual File System (VFS) registration is per-doc-instance.
 *
 * Font: Noto Sans SC subset covering:
 *   U+0020–00FF (Latin Basic + Latin-1), U+2000–206F (Punctuation),
 *   U+3000–303F (CJK Symbols), U+4E00–9FFF (CJK Unified Ideographs BMP),
 *   U+FF00–FFEF (Halfwidth/Fullwidth Forms)
 *
 * @param doc - The jsPDF instance to register the font on.
 * @returns   The font family name to use in autoTable styles ("NotoSansSC").
 * @throws    If the font fetch fails (network error or HTTP non-2xx).
 *            Caller (buildPdfBlob) propagates this as a PDF generation failure.
 *            Error message: "PDF generation failed: could not load font. Please try again."
 */
export async function loadCjkFont(doc: jsPDF): Promise<string>
```

---

## 5. Component Props

```ts
// components/FloatingExportButton.tsx — NEW (replaces ExportToolbar)
export interface FloatingExportButtonProps {
  /** Whether the itinerary has rows. Disables button and shows tooltip when false. */
  hasData: boolean
  /** Whether the picker opened by this button is currently visible. */
  isPickerOpen: boolean
  /** Called when the user clicks the enabled button. */
  onOpen: () => void
  /** Forwarded ref — ItineraryTab uses this for focus-return after picker closes. */
  buttonRef?: React.RefObject<HTMLButtonElement | null>
}

// components/ExportSuccessToast.tsx — NEW
export interface ExportSuccessToastProps {
  /** Human-readable message displayed in the toast body (e.g. "Itinerary exported!"). */
  message: string
  /** Called when the toast should be removed (auto-timer or manual dismiss click). */
  onDismiss: () => void
  /** Auto-dismiss delay in milliseconds. Defaults to 3000. */
  autoDismissMs?: number
}

// components/ExportFormatPicker.tsx — UNCHANGED
export interface ExportFormatPickerProps {
  onExportMarkdown: () => void
  onExportPdf: () => void
  onClose: () => void       // Escape, outside click, or Cancel
  exportError: string | null
  isPdfGenerating: boolean
}

// Existing — unchanged
interface ItineraryTabProps {
  initialData: RouteDay[]   // all export state is internal to ItineraryTab
}
```

> **Removed:** `ExportToolbarProps` (component deleted as part of `itinerary-export-ux-pdf-fixes`).

---

## 6. Internal Handlers (`ItineraryTab`)

```ts
function getEffectiveData(): RouteDay[]               // merges planOverrides + trainOverrides over initialData

async function handleExportMarkdown(): Promise<void>
  // On success: closeFloatingPicker() then setExportSuccess(true)
  // On AbortError: closeFloatingPicker() — no toast
  // (renamed from handleExportMarkdown; logic updated for floating picker + toast)

async function handleExportPdf(): Promise<void>
  // On success: closeFloatingPicker() then setExportSuccess(true)
  // On AbortError: closeFloatingPicker() — no toast
  // On non-Abort error: setExportError(msg); picker stays open — no toast
  // (renamed helper: closeFloatingPicker replaces closeExportPicker)

function openFloatingPicker(): void
  // Sets floatingPickerOpen=true; clears exportError
  // (renamed from openExportPicker)

function closeFloatingPicker(): void
  // Sets floatingPickerOpen=false; clears exportError and isPdfGenerating;
  // returns focus to floatingButtonRef via setTimeout
  // (renamed from closeExportPicker)
```

---

## 7. Error Messages (User-Facing)

| Condition | Message | Element |
|-----------|---------|---------|
| PDF generation failure (generic) | `"PDF generation failed. Please try again."` | `export-pdf-error` |
| CJK font load failure | `"PDF generation failed: could not load font. Please try again."` | `export-pdf-error` |
| No itinerary data (FAB tooltip) | `"Nothing to export"` | `title` attribute on disabled `export-fab` |
