/**
 * app/lib/itineraryExport.ts
 *
 * Pure transform functions for the "Export to files…" feature.
 * All functions are synchronous except buildPdfBlob (dynamic import).
 */

import { normalizeTrainId, type RouteDay, type PlanSections, type TrainRoute } from './itinerary'

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalised row ready for serialisation into a Markdown or PDF table.
 * One ExportRow is produced per RouteDay.
 */
export interface ExportRow {
  /** e.g. "2026/9/25" — copied verbatim from RouteDay.date */
  date: string
  /** e.g. "1" — String(RouteDay.dayNum) */
  day: string
  /** e.g. "巴黎" | "—" — copied verbatim from RouteDay.overnight */
  overnight: string
  /**
   * Combined plan text. Built by buildPlanCell().
   * For Markdown export: raw Markdown syntax preserved.
   * For PDF export: Markdown syntax stripped via stripMarkdown().
   */
  plan: string
  /**
   * Normalised train number(s), one per line, or "—" if no trains.
   * Built by buildTrainCell(). Never contains station names or times.
   */
  trainSchedule: string
}

// ─────────────────────────────────────────────────────────────────────────────
// buildPlanCell
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Combines morning/afternoon/evening sections into a single export cell string.
 *
 * Rules:
 * - Each non-empty (after trim) section is included as "Label: value".
 * - Empty/whitespace sections are omitted entirely.
 * - Sections are joined with "\n".
 * - If all sections are empty, returns "—".
 *
 * Note: does NOT strip Markdown syntax — call stripMarkdown() on the result
 * before passing to buildPdfBlob() if you need plain text.
 */
export function buildPlanCell(plan: PlanSections): string {
  const sections = [
    { label: 'Morning', value: plan.morning },
    { label: 'Afternoon', value: plan.afternoon },
    { label: 'Evening', value: plan.evening },
  ]

  const parts = sections
    .map(({ label, value }) => ({ label, trimmed: value.trim() }))
    .filter(({ trimmed }) => trimmed.length > 0)
    .map(({ label, trimmed }) => `${label}: ${trimmed}`)

  return parts.length > 0 ? parts.join('\n') : '—'
}

// ─────────────────────────────────────────────────────────────────────────────
// buildTrainCell
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Produces the Train Schedule export cell from an array of TrainRoute.
 *
 * Rules:
 * - Each entry's train_id is normalised via normalizeTrainId().
 * - Multiple entries are joined with "\n".
 * - If the array is empty, returns "—".
 * - Station names (start/end) and timetable times are NEVER included.
 */
export function buildTrainCell(trains: TrainRoute[]): string {
  if (trains.length === 0) return '—'

  const ids = trains.map((t) => normalizeTrainId(t.train_id))
  return ids.join('\n')
}

// ─────────────────────────────────────────────────────────────────────────────
// stripMarkdown
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Strips the inline Markdown tokens recognised by app/lib/markdown.tsx
 * so that PDF cells contain plain text only.
 *
 * Tokens stripped (in order):
 *   **bold**   → bold
 *   *italic*   → italic
 *   `code`     → code
 *   ~~del~~    → del
 *   - item     → item   (unordered list prefix)
 *   * item     → item   (unordered list prefix at line start)
 *   1. item    → item   (ordered list prefix)
 *
 * Plain text (no tokens) is returned unchanged.
 */
export function stripMarkdown(text: string): string {
  return text
    // **bold**
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    // *italic* (must come after bold to avoid conflict)
    .replace(/\*([^*\n]+)\*/g, '$1')
    // `code`
    .replace(/`([^`\n]+)`/g, '$1')
    // ~~strikethrough~~
    .replace(/~~([^~\n]+)~~/g, '$1')
    // - item or * item (unordered list prefix at start of line)
    .replace(/^[-*] /gm, '')
    // 1. item (ordered list prefix at start of line)
    .replace(/^\d+\. /gm, '')
}

// ─────────────────────────────────────────────────────────────────────────────
// toExportRows
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converts an array of RouteDay into ExportRow[].
 * Used as the single entry point by both buildMarkdownTable and buildPdfBlob.
 *
 * @param data  - Effective RouteDay[] (with planOverrides and trainOverrides applied).
 * @param opts  - Controls whether plan cells have Markdown stripped (for PDF).
 */
export function toExportRows(
  data: RouteDay[],
  opts: { stripMarkdownInPlan: boolean }
): ExportRow[] {
  return data.map((day) => {
    const rawPlan = buildPlanCell(day.plan)
    const plan = opts.stripMarkdownInPlan ? stripMarkdown(rawPlan) : rawPlan

    return {
      date: day.date,
      day: String(day.dayNum),
      overnight: day.overnight,
      plan,
      trainSchedule: buildTrainCell(day.train),
    }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// buildMarkdownTable
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Serialises RouteDay[] into a GFM (GitHub Flavoured Markdown) pipe table.
 *
 * Output structure:
 *   | Date | Day | Overnight | Plan | Train Schedule |
 *   |------|-----|-----------|------|----------------|
 *   | …    | …   | …         | …    | …              |
 *
 * Weekday column is never included (FR-07).
 * Newlines inside cells are represented as literal \n (not real newlines).
 */
export function buildMarkdownTable(data: RouteDay[]): string {
  const header = '| Date | Day | Overnight | Plan | Train Schedule |'
  const separator = '|------|-----|-----------|------|----------------|'

  const rows = toExportRows(data, { stripMarkdownInPlan: false }).map((row) => {
    // Represent newlines inside cells as literal \n (GFM tables can't have real newlines in cells)
    const planCell = row.plan.replace(/\n/g, '\\n')
    const trainCell = row.trainSchedule.replace(/\n/g, '\\n')
    return `| ${row.date} | ${row.day} | ${row.overnight} | ${planCell} | ${trainCell} |`
  })

  return [header, separator, ...rows].join('\n')
}

// ─────────────────────────────────────────────────────────────────────────────
// hasCjkCharacters
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true if the string contains any CJK (Chinese, Japanese, Korean) characters.
 *
 * Unicode ranges covered:
 *   U+1100–U+11FF   Hangul Jamo
 *   U+3000–U+303F   CJK Symbols and Punctuation
 *   U+3040–U+30FF   Hiragana and Katakana
 *   U+3400–U+4DBF   CJK Unified Ideographs Extension A
 *   U+4E00–U+9FFF   CJK Unified Ideographs (core block — covers most Chinese/Japanese/Korean)
 *   U+A000–U+A48F   Yi Syllables
 *   U+A960–U+A97F   Hangul Jamo Extended-A
 *   U+AC00–U+D7FF   Hangul Syllables + Jamo Extended-B
 *   U+F900–U+FAFF   CJK Compatibility Ideographs
 *   U+FE30–U+FE4F   CJK Compatibility Forms
 *   U+FF00–U+FFEF   Halfwidth and Fullwidth Forms
 *   U+20000–U+2A6DF CJK Unified Ideographs Extension B (via surrogate pairs)
 */
export function hasCjkCharacters(text: string): boolean {
  return /[\u1100-\u11FF\u3000-\u303F\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uA000-\uA48F\uA960-\uA97F\uAC00-\uD7FF\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFFEF]/.test(text)
}

// ─────────────────────────────────────────────────────────────────────────────
// buildPdfBlob
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a PDF Blob from the itinerary data using jsPDF + jspdf-autotable.
 *
 * - Dynamically imports jsPDF and jspdf-autotable (no SSR impact).
 * - Uses landscape A4 orientation.
 * - Plan cells have Markdown syntax stripped to plain text.
 * - CJK font loaded lazily via cjkFontLoader (Slice 2 — F-02).
 * - Returns a Blob with MIME type "application/pdf".
 * - Throws on jsPDF failure or CJK font load failure.
 *
 * DEF-002 fix: global styles.font is NOT set to NotoSansSC.
 * Setting font:'NotoSansSC' globally caused all body cells to use the CJK
 * CFF font, whose glyph subsetting fails in jsPDF → body rows invisible.
 * Instead, a didParseCell hook applies NotoSansSC only to cells that actually
 * contain CJK characters, so ASCII cells always use the reliable helvetica default.
 */
export async function buildPdfBlob(data: RouteDay[]): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const { autoTable } = await import('jspdf-autotable')
  const { loadCjkFont } = await import('./cjkFontLoader')

  const doc = new jsPDF({ orientation: 'landscape' })

  // Load and register CJK font — must happen before autoTable renders cells
  const fontName = await loadCjkFont(doc)

  const rows = toExportRows(data, { stripMarkdownInPlan: true })
  const tableBody = rows.map((row) => [
    row.date,
    row.day,
    row.overnight,
    row.plan,
    row.trainSchedule,
  ])

  // Use the named autoTable(doc, opts) API — avoids prototype-augmentation
  // failures in dynamic-import / ESM environments (fixes DEF-001).
  autoTable(doc, {
    head: [['Date', 'Day', 'Overnight', 'Plan', 'Train Schedule']],
    body: tableBody,
    // DEF-002: do NOT set font here — keeps helvetica default for ASCII-only cells
    // so dates, day numbers, train IDs always render correctly.
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 25 },  // Date
      1: { cellWidth: 12 },  // Day
      2: { cellWidth: 25 },  // Overnight
      3: { cellWidth: 'auto' }, // Plan — takes remaining space
      4: { cellWidth: 35 },  // Train Schedule
    },
    headStyles: { fillColor: [59, 130, 246] }, // blue-500
    alternateRowStyles: { fillColor: [249, 250, 251] }, // gray-50
    // DEF-002: apply CJK font per-cell only when the cell text contains CJK characters.
    // This ensures cells with Chinese/Japanese/Korean text (overnight, plan) use NotoSansSC
    // while ASCII-only cells (date, day, train schedule) keep helvetica and always render.
    didParseCell: (hookData) => {
      const cellText = hookData.cell.text.join('')
      if (hasCjkCharacters(cellText)) {
        hookData.cell.styles.font = fontName
      }
    },
  })

  return doc.output('blob')
}
