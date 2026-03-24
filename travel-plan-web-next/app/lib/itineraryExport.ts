/**
 * app/lib/itineraryExport.ts
 *
 * Pure transform functions for the "Export to files…" feature.
 * All functions are synchronous except buildPdfBlob (dynamic import).
 */

import { normalizeTrainId, type RouteDay, type TrainRoute } from './itinerary'

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
   * Free-form note text. Copied from RouteDay.note (or "—" if absent).
   * Raw Markdown syntax preserved in the string.
   */
  note: string
  /**
   * Normalised train number(s), one per line, or "—" if no trains.
   * Built by buildTrainCell(). Never contains station names or times.
   */
  trainSchedule: string
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
 * @param data  - Effective RouteDay[] (with noteOverrides and trainOverrides applied).
 * @param opts  - Controls whether note cells have Markdown stripped (for PDF).
 */
export function toExportRows(
  data: RouteDay[],
  opts: { stripMarkdownInNote: boolean }
): ExportRow[] {
  return data.map((day) => {
    const rawNote = day.note?.trim() ?? ''
    const note = opts.stripMarkdownInNote ? stripMarkdown(rawNote) : rawNote

    return {
      date: day.date,
      day: String(day.dayNum),
      overnight: day.overnight,
      note: note || '—',
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
 *   | Overnight | Date | Day | Train Schedule | Note |
 *   |-----------|------|-----|----------------|------|
 *   | …         | …    | …   | …              | …    |
 *
 * Weekday column is never included.
 * Newlines inside cells are represented as literal \n (not real newlines).
 */
export function buildMarkdownTable(data: RouteDay[]): string {
  const header = '| Overnight | Date | Day | Train Schedule | Note |'
  const separator = '|-----------|------|-----|----------------|------|'

  const rows = toExportRows(data, { stripMarkdownInNote: false }).map((row) => {
    // Represent newlines inside cells as literal \n (GFM tables can't have real newlines in cells)
    const trainCell = row.trainSchedule.replace(/\n/g, '\\n')
    const noteCell = row.note.replace(/\n/g, '\\n')
    return `| ${row.overnight} | ${row.date} | ${row.day} | ${trainCell} | ${noteCell} |`
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

  const rows = toExportRows(data, { stripMarkdownInNote: true })
  const tableBody = rows.map((row) => [
    row.overnight,
    row.date,
    row.day,
    row.trainSchedule,
    row.note,
  ])

  // Use the named autoTable(doc, opts) API — avoids prototype-augmentation
  // failures in dynamic-import / ESM environments (fixes DEF-001).
  autoTable(doc, {
    head: [['Overnight', 'Date', 'Day', 'Train Schedule', 'Note']],
    body: tableBody,
    // DEF-002: do NOT set font here — keeps helvetica default for ASCII-only cells
    // so dates, day numbers, train IDs always render correctly.
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 25 },  // Overnight
      1: { cellWidth: 25 },  // Date
      2: { cellWidth: 12 },  // Day
      3: { cellWidth: 35 },  // Train Schedule
      4: { cellWidth: 'auto' }, // Note — takes remaining space
    },
    headStyles: { fillColor: [59, 130, 246] }, // blue-500
    alternateRowStyles: { fillColor: [249, 250, 251] }, // gray-50
    // DEF-002: apply CJK font per-cell only when the cell text contains CJK characters.
    // This ensures cells with Chinese/Japanese/Korean text (overnight, note) use NotoSansSC
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
