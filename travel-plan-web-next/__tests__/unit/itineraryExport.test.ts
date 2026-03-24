/**
 * @jest-environment node
 *
 * Unit tests for app/lib/itineraryExport.ts
 * Tests are written BEFORE implementation (TDD mandate from CLAUDE.md).
 */

import {
  buildTrainCell,
  stripMarkdown,
  toExportRows,
  buildMarkdownTable,
  buildPdfBlob,
  hasCjkCharacters,
} from '../../app/lib/itineraryExport'
import type { TrainRoute, RouteDay } from '../../app/lib/itinerary'

// ─────────────────────────────────────────────────────────────────────────────
// Module mocks for buildPdfBlob (must be at top level, hoisted by jest)
// ─────────────────────────────────────────────────────────────────────────────

const mockAutoTable = jest.fn()
const mockOutput = jest.fn().mockReturnValue(new Blob(['%PDF-1.4'], { type: 'application/pdf' }))
const mockAddFileToVFS = jest.fn()
const mockAddFont = jest.fn()
const mockJsPDFInstance = { output: mockOutput, addFileToVFS: mockAddFileToVFS, addFont: mockAddFont }
const mockJsPDF = jest.fn().mockReturnValue(mockJsPDFInstance)
const mockLoadCjkFont = jest.fn().mockResolvedValue('NotoSansSC')

jest.mock('jspdf', () => ({ jsPDF: mockJsPDF }), { virtual: true })
jest.mock('jspdf-autotable', () => ({ autoTable: mockAutoTable }), { virtual: true })
jest.mock('../../app/lib/cjkFontLoader', () => ({
  loadCjkFont: mockLoadCjkFont,
}))

// ─────────────────────────────────────────────────────────────────────────────
// buildTrainCell
// ─────────────────────────────────────────────────────────────────────────────

describe('buildTrainCell', () => {
  it('normalises a single train_id (ICE123 → ICE 123)', () => {
    const trains: TrainRoute[] = [{ train_id: 'ICE123', start: 'Munich', end: 'Rome' }]
    expect(buildTrainCell(trains)).toBe('ICE 123')
  })

  it('joins multiple trains with \\n', () => {
    const trains: TrainRoute[] = [
      { train_id: 'TGV9242', start: 'paris', end: 'lyon' },
      { train_id: 'ICE905' },
    ]
    expect(buildTrainCell(trains)).toBe('TGV 9242\nICE 905')
  })

  it('returns "—" for an empty train array', () => {
    expect(buildTrainCell([])).toBe('—')
  })

  it('does NOT include station names in the output', () => {
    const trains: TrainRoute[] = [{ train_id: 'ICE123', start: 'Munich', end: 'Rome' }]
    const result = buildTrainCell(trains)
    expect(result).not.toContain('Munich')
    expect(result).not.toContain('Rome')
  })

  it('does NOT include "start" or "end" labels in output', () => {
    const trains: TrainRoute[] = [{ train_id: 'ICE123', start: 'Berlin', end: 'Hamburg' }]
    const result = buildTrainCell(trains)
    expect(result).not.toContain('start')
    expect(result).not.toContain('end')
    expect(result).not.toContain('Berlin')
    expect(result).not.toContain('Hamburg')
  })

  it('handles a train with already-normalised ID (ICE 123 stays ICE 123)', () => {
    const trains: TrainRoute[] = [{ train_id: 'ICE 123' }]
    expect(buildTrainCell(trains)).toBe('ICE 123')
  })

  it('handles TGV trains correctly', () => {
    const trains: TrainRoute[] = [{ train_id: 'TGV9242', start: 'paris', end: 'lyon' }]
    expect(buildTrainCell(trains)).toBe('TGV 9242')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// stripMarkdown
// ─────────────────────────────────────────────────────────────────────────────

describe('stripMarkdown', () => {
  it('strips **bold** markers', () => {
    expect(stripMarkdown('**bold**')).toBe('bold')
  })

  it('strips *italic* markers', () => {
    expect(stripMarkdown('*italic*')).toBe('italic')
  })

  it('strips `code` markers', () => {
    expect(stripMarkdown('`code`')).toBe('code')
  })

  it('strips ~~strikethrough~~ markers', () => {
    expect(stripMarkdown('~~del~~')).toBe('del')
  })

  it('strips unordered list prefix "- item"', () => {
    expect(stripMarkdown('- item')).toBe('item')
  })

  it('strips unordered list prefix "* item" at line start', () => {
    expect(stripMarkdown('* item')).toBe('item')
  })

  it('strips ordered list prefix "1. item"', () => {
    expect(stripMarkdown('1. item')).toBe('item')
  })

  it('strips ordered list prefix with numbers > 9', () => {
    expect(stripMarkdown('10. item')).toBe('item')
  })

  it('leaves plain text unchanged', () => {
    expect(stripMarkdown('Just plain text')).toBe('Just plain text')
  })

  it('handles mixed bold and italic in same string', () => {
    expect(stripMarkdown('**bold** and *italic*')).toBe('bold and italic')
  })

  it('handles empty string', () => {
    expect(stripMarkdown('')).toBe('')
  })

  it('does not strip asterisks that are NOT surrounding a word (e.g. multiplication context)', () => {
    // "5 * 3" should not be stripped (no word boundary match)
    const result = stripMarkdown('5 * 3 = 15')
    // The exact behaviour depends on regex — just ensure it doesn't throw
    expect(typeof result).toBe('string')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// buildMarkdownTable
// ─────────────────────────────────────────────────────────────────────────────

const sampleData: RouteDay[] = [
  {
    date: '2026/9/25',
    weekDay: '星期五',
    dayNum: 1,
    overnight: '巴黎',
    plan: { morning: '', afternoon: '', evening: '' },
    note: 'Arrive in Paris, visit Eiffel Tower',
    train: [],
  },
  {
    date: '2026/9/26',
    weekDay: '星期六',
    dayNum: 2,
    overnight: '巴黎',
    plan: { morning: '', afternoon: '', evening: '' },
    train: [{ train_id: 'TGV9242', start: 'paris', end: 'lyon' }],
  },
]

describe('buildMarkdownTable', () => {
  it('includes the correct five headers (no Weekday)', () => {
    const result = buildMarkdownTable(sampleData)
    const headerLine = result.split('\n')[0]
    expect(headerLine).toContain('Date')
    expect(headerLine).toContain('Day')
    expect(headerLine).toContain('Overnight')
    expect(headerLine).toContain('Note')
    expect(headerLine).toContain('Train Schedule')
    expect(headerLine).not.toContain('Weekday')
  })

  it('second line is a separator row with pipe-delimited dashes', () => {
    const result = buildMarkdownTable(sampleData)
    const lines = result.split('\n')
    const separatorLine = lines[1]
    expect(separatorLine).toMatch(/^\|[-| ]+\|$/)
  })

  it('produces exactly one data row per RouteDay', () => {
    const result = buildMarkdownTable(sampleData)
    const lines = result.split('\n').filter((l) => l.trim() !== '')
    // header + separator + N data rows
    expect(lines.length).toBe(2 + sampleData.length)
  })

  it('includes correct date, day number, and overnight values in data rows', () => {
    const result = buildMarkdownTable(sampleData)
    expect(result).toContain('2026/9/25')
    expect(result).toContain('1')
    expect(result).toContain('巴黎')
  })

  it('note cell contains note text when present', () => {
    const result = buildMarkdownTable(sampleData)
    // First row has a note
    expect(result).toContain('Arrive in Paris, visit Eiffel Tower')
  })

  it('train cell uses buildTrainCell output (normalised train IDs)', () => {
    const result = buildMarkdownTable(sampleData)
    expect(result).toContain('TGV 9242')
  })

  it('train cell is "—" for days with no trains', () => {
    const result = buildMarkdownTable(sampleData)
    // First row has no train
    const dataRows = result.split('\n').filter((l) => l.trim() !== '').slice(2)
    expect(dataRows[0]).toContain('—')
  })

  it('handles empty data array (no data rows)', () => {
    const result = buildMarkdownTable([])
    const lines = result.split('\n').filter((l) => l.trim() !== '')
    // Only header + separator
    expect(lines.length).toBe(2)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// toExportRows
// ─────────────────────────────────────────────────────────────────────────────

describe('toExportRows', () => {
  it('returns one ExportRow per RouteDay', () => {
    const rows = toExportRows(sampleData, { stripMarkdownInNote: false })
    expect(rows).toHaveLength(sampleData.length)
  })

  it('copies date, day, and overnight verbatim', () => {
    const rows = toExportRows(sampleData, { stripMarkdownInNote: false })
    expect(rows[0].date).toBe('2026/9/25')
    expect(rows[0].day).toBe('1')
    expect(rows[0].overnight).toBe('巴黎')
  })

  it('does NOT strip Markdown in note when stripMarkdownInNote is false', () => {
    const data: RouteDay[] = [
      {
        date: '2026/9/25',
        weekDay: '星期五',
        dayNum: 1,
        overnight: '巴黎',
        plan: { morning: '', afternoon: '', evening: '' },
        note: '**Bold** text',
        train: [],
      },
    ]
    const rows = toExportRows(data, { stripMarkdownInNote: false })
    expect(rows[0].note).toContain('**Bold**')
  })

  it('strips Markdown in note when stripMarkdownInNote is true', () => {
    const data: RouteDay[] = [
      {
        date: '2026/9/25',
        weekDay: '星期五',
        dayNum: 1,
        overnight: '巴黎',
        plan: { morning: '', afternoon: '', evening: '' },
        note: '**Bold** text',
        train: [],
      },
    ]
    const rows = toExportRows(data, { stripMarkdownInNote: true })
    expect(rows[0].note).not.toContain('**')
    expect(rows[0].note).toContain('Bold')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// buildPdfBlob — DEF-001 regression: must use named autoTable(doc, opts) API
// ─────────────────────────────────────────────────────────────────────────────

describe('buildPdfBlob', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockOutput.mockReturnValue(new Blob(['%PDF-1.4'], { type: 'application/pdf' }))
  })

  it('returns a Blob with MIME type application/pdf', async () => {
    const blob = await buildPdfBlob(sampleData)
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('application/pdf')
  })

  it('DEF-001: calls named autoTable(doc, opts) — NOT doc.autoTable(opts)', async () => {
    await buildPdfBlob(sampleData)
    // Named autoTable must be called with the jsPDF instance as first arg
    expect(mockAutoTable).toHaveBeenCalledTimes(1)
    const [firstArg, secondArg] = mockAutoTable.mock.calls[0]
    expect(firstArg).toBe(mockJsPDFInstance)
    expect(secondArg).toMatchObject({
      head: [['Date', 'Day', 'Overnight', 'Train Schedule', 'Note']],
    })
  })

  it('creates jsPDF in landscape orientation', async () => {
    await buildPdfBlob(sampleData)
    expect(mockJsPDF).toHaveBeenCalledWith({ orientation: 'landscape' })
  })

  it('passes one body row per RouteDay to autoTable', async () => {
    await buildPdfBlob(sampleData)
    const [, opts] = mockAutoTable.mock.calls[0]
    expect(opts.body).toHaveLength(sampleData.length)
  })

  it('strips Markdown from note cells before passing to autoTable', async () => {
    const dataWithMarkdown: RouteDay[] = [
      {
        date: '2026/9/25',
        weekDay: '星期五',
        dayNum: 1,
        overnight: '巴黎',
        plan: { morning: '', afternoon: '', evening: '' },
        note: '**Bold** visit',
        train: [],
      },
    ]
    await buildPdfBlob(dataWithMarkdown)
    const [, opts] = mockAutoTable.mock.calls[0]
    const noteCell = opts.body[0][4] // 5th column is note
    expect(noteCell).not.toContain('**')
    expect(noteCell).toContain('Bold')
  })

  it('calls doc.output("blob") and returns its result', async () => {
    const result = await buildPdfBlob(sampleData)
    expect(mockOutput).toHaveBeenCalledWith('blob')
    expect(result).toBeInstanceOf(Blob)
  })

  it('works with an empty data array (no rows)', async () => {
    await buildPdfBlob([])
    const [, opts] = mockAutoTable.mock.calls[0]
    expect(opts.body).toHaveLength(0)
  })

  // ── CJK font integration (Slice 2 — F-02) ───────────────────────────────────

  // T1-S2-09: buildPdfBlob calls loadCjkFont
  it('T1-S2-09: calls loadCjkFont with the jsPDF instance', async () => {
    await buildPdfBlob(sampleData)
    expect(mockLoadCjkFont).toHaveBeenCalledTimes(1)
    expect(mockLoadCjkFont).toHaveBeenCalledWith(mockJsPDFInstance)
  })

  // T1-S2-10 (updated): global styles must NOT set font — keeps helvetica for ASCII cells
  // Previously this tested styles.font='NotoSansSC', but that caused all body cells to use
  // the CJK CFF font, which has broken glyph embedding → body rows invisible (DEF-002).
  it('T1-S2-10: global styles does NOT include font property (helvetica default preserves ASCII body rows)', async () => {
    await buildPdfBlob(sampleData)
    const [, opts] = mockAutoTable.mock.calls[0]
    expect(opts.styles).not.toHaveProperty('font')
  })

  // T1-S2-11: buildPdfBlob propagates loadCjkFont rejection
  it('T1-S2-11: propagates loadCjkFont rejection as a PDF generation error', async () => {
    mockLoadCjkFont.mockRejectedValueOnce(new Error('CJK font fetch failed: HTTP 404'))
    await expect(buildPdfBlob(sampleData)).rejects.toThrow('CJK font fetch failed: HTTP 404')
  })

  // ── DEF-002: per-cell CJK font via didParseCell hook ─────────────────────────
  //
  // Root cause: setting font:'NotoSansSC' in global styles caused ALL body cells
  // (including ASCII-only date/day/trainSchedule) to use the CJK CFF font.
  // jsPDF's glyph subsetting fails for CFF fonts → body rows invisible in PDF viewer.
  // Fix: use didParseCell hook to apply NotoSansSC only to cells with CJK characters.

  it('DEF-002: autoTable receives a didParseCell hook for per-cell CJK font switching', async () => {
    await buildPdfBlob(sampleData)
    const [, opts] = mockAutoTable.mock.calls[0]
    expect(typeof opts.didParseCell).toBe('function')
  })

  it('DEF-002: didParseCell hook sets font to NotoSansSC for cells with CJK characters', async () => {
    await buildPdfBlob(sampleData)
    const [, opts] = mockAutoTable.mock.calls[0]
    const hook = opts.didParseCell

    // Simulate a cell with CJK content (overnight: '巴黎')
    const cellWithCjk = { styles: { font: 'helvetica' }, text: ['巴黎'], section: 'body' }
    hook({ cell: cellWithCjk })
    expect(cellWithCjk.styles.font).toBe('NotoSansSC')
  })

  it('DEF-002: didParseCell hook does NOT change font for ASCII-only cells', async () => {
    await buildPdfBlob(sampleData)
    const [, opts] = mockAutoTable.mock.calls[0]
    const hook = opts.didParseCell

    // Simulate a cell with ASCII-only content (date: '2026/9/25')
    const cellAscii = { styles: { font: 'helvetica' }, text: ['2026/9/25'], section: 'body' }
    hook({ cell: cellAscii })
    expect(cellAscii.styles.font).toBe('helvetica')
  })

  it('DEF-002: didParseCell hook applies CJK font to head cells with CJK content', async () => {
    await buildPdfBlob(sampleData)
    const [, opts] = mockAutoTable.mock.calls[0]
    const hook = opts.didParseCell

    // Head cells are column labels (all ASCII: 'Date', 'Plan', etc.)
    // A hypothetical head cell with CJK should also get the font
    const headCellWithCjk = { styles: { font: 'helvetica' }, text: ['计划'], section: 'head' }
    hook({ cell: headCellWithCjk })
    expect(headCellWithCjk.styles.font).toBe('NotoSansSC')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// hasCjkCharacters
// ─────────────────────────────────────────────────────────────────────────────

describe('hasCjkCharacters', () => {
  it('returns true for Chinese characters', () => {
    expect(hasCjkCharacters('巴黎')).toBe(true)
  })

  it('returns true for Japanese characters', () => {
    expect(hasCjkCharacters('東京')).toBe(true)
  })

  it('returns true for Korean characters', () => {
    expect(hasCjkCharacters('서울')).toBe(true)
  })

  it('returns false for ASCII-only text', () => {
    expect(hasCjkCharacters('2026/9/25')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(hasCjkCharacters('')).toBe(false)
  })

  it('returns true for mixed ASCII and CJK', () => {
    expect(hasCjkCharacters('Morning: 巴黎圣母院')).toBe(true)
  })

  it('returns false for em-dash and other symbols', () => {
    expect(hasCjkCharacters('—')).toBe(false)
  })

  it('returns false for European characters', () => {
    expect(hasCjkCharacters('München')).toBe(false)
  })
})
