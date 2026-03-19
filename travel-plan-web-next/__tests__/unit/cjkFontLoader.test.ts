/**
 * Unit tests for app/lib/cjkFontLoader.ts
 * Written BEFORE implementation (TDD mandate from CLAUDE.md).
 * Slice 2 — F-02: CJK Font in PDF
 * Runs in default jsdom environment.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeMockDoc() {
  return {
    addFileToVFS: jest.fn(),
    addFont: jest.fn(),
  }
}

function makeSuccessfulFetch() {
  // Create a minimal ArrayBuffer to simulate font bytes
  const buffer = new ArrayBuffer(4)
  const view = new Uint8Array(buffer)
  view[0] = 70; view[1] = 79; view[2] = 78; view[3] = 84 // "FONT"
  return jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    arrayBuffer: () => Promise.resolve(buffer),
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('loadCjkFont', () => {
  let loadCjkFont: (doc: ReturnType<typeof makeMockDoc>) => Promise<string>

  beforeEach(async () => {
    jest.resetModules()
    global.fetch = makeSuccessfulFetch()
    // Re-import to reset the module-level singleton
    const mod = await import('../../app/lib/cjkFontLoader')
    loadCjkFont = mod.loadCjkFont as unknown as (doc: ReturnType<typeof makeMockDoc>) => Promise<string>
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // T1-S2-01: first call fetches font
  it('first call fetches /fonts/NotoSansSC-subset.ttf', async () => {
    const doc = makeMockDoc()
    await loadCjkFont(doc)
    expect(global.fetch).toHaveBeenCalledWith('/fonts/NotoSansSC-subset.ttf')
  })

  // T1-S2-02: first call calls addFileToVFS
  it('first call calls doc.addFileToVFS("NotoSansSC.ttf", base64str)', async () => {
    const doc = makeMockDoc()
    await loadCjkFont(doc)
    expect(doc.addFileToVFS).toHaveBeenCalledWith('NotoSansSC.ttf', expect.any(String))
  })

  // T1-S2-03: first call calls addFont
  it('first call calls doc.addFont("NotoSansSC.ttf", "NotoSansSC", "normal")', async () => {
    const doc = makeMockDoc()
    await loadCjkFont(doc)
    expect(doc.addFont).toHaveBeenCalledWith('NotoSansSC.ttf', 'NotoSansSC', 'normal')
  })

  // T1-S2-04: first call returns "NotoSansSC"
  it('first call returns "NotoSansSC" font family name', async () => {
    const doc = makeMockDoc()
    const result = await loadCjkFont(doc)
    expect(result).toBe('NotoSansSC')
  })

  // T1-S2-05: second call does NOT re-fetch (singleton)
  it('second call with a different doc does NOT re-fetch (singleton cache)', async () => {
    const doc1 = makeMockDoc()
    const doc2 = makeMockDoc()
    await loadCjkFont(doc1)
    await loadCjkFont(doc2)
    // fetch called only once across both invocations
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  // T1-S2-06: second call DOES register font on new doc
  it('second call DOES call addFileToVFS and addFont on the new doc instance', async () => {
    const doc1 = makeMockDoc()
    const doc2 = makeMockDoc()
    await loadCjkFont(doc1)
    await loadCjkFont(doc2)
    // doc2 must have had font registered too
    expect(doc2.addFileToVFS).toHaveBeenCalledTimes(1)
    expect(doc2.addFont).toHaveBeenCalledTimes(1)
  })

  // T1-S2-07: throws on HTTP 404
  it('throws when fetch returns HTTP 404', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    })
    const doc = makeMockDoc()
    await expect(loadCjkFont(doc)).rejects.toThrow(/404/)
  })

  // T1-S2-08: throws on network error
  it('throws when fetch rejects with a network error', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Network error'))
    const doc = makeMockDoc()
    await expect(loadCjkFont(doc)).rejects.toThrow('Network error')
  })
})
