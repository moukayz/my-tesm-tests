/**
 * @jest-environment jsdom
 *
 * Unit tests for app/lib/fileSave.ts
 * Tests are written BEFORE implementation (TDD mandate from CLAUDE.md).
 */

import { saveFile } from '../../app/lib/fileSave'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers / shared mocks
// ─────────────────────────────────────────────────────────────────────────────

function makeWritableMock() {
  const chunks: BlobPart[] = []
  return {
    write: jest.fn((chunk: BlobPart) => { chunks.push(chunk); return Promise.resolve() }),
    close: jest.fn(() => Promise.resolve()),
    getChunks: () => chunks,
  }
}

function makeFilePicker(writable: ReturnType<typeof makeWritableMock>) {
  return jest.fn(() =>
    Promise.resolve({
      createWritable: jest.fn(() => Promise.resolve(writable)),
    })
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// File System Access API path
// ─────────────────────────────────────────────────────────────────────────────

describe('saveFile – File System Access API path', () => {
  let writable: ReturnType<typeof makeWritableMock>
  let showSaveFilePicker: jest.Mock

  beforeEach(() => {
    writable = makeWritableMock()
    showSaveFilePicker = makeFilePicker(writable)
    // Install the mock on window
    Object.defineProperty(window, 'showSaveFilePicker', {
      value: showSaveFilePicker,
      writable: true,
      configurable: true,
    })
    // Also mock URL.createObjectURL / revokeObjectURL (jsdom doesn't implement them)
    window.URL.createObjectURL = jest.fn(() => 'blob:mock-url')
    window.URL.revokeObjectURL = jest.fn()
  })

  afterEach(() => {
    // Remove the mock
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).showSaveFilePicker
    jest.restoreAllMocks()
  })

  it('calls showSaveFilePicker with the suggested filename', async () => {
    await saveFile({ content: 'hello', filename: 'itinerary.md', mimeType: 'text/markdown' })
    expect(showSaveFilePicker).toHaveBeenCalledWith(
      expect.objectContaining({ suggestedName: 'itinerary.md' })
    )
  })

  it('writes the content via the writable stream and closes it', async () => {
    await saveFile({ content: 'hello', filename: 'itinerary.md', mimeType: 'text/markdown' })
    expect(writable.write).toHaveBeenCalled()
    expect(writable.close).toHaveBeenCalled()
  })

  it('converts a string content to a Blob before writing', async () => {
    await saveFile({ content: 'some text', filename: 'itinerary.md', mimeType: 'text/markdown' })
    const writtenArg = writable.write.mock.calls[0][0]
    expect(writtenArg).toBeInstanceOf(Blob)
  })

  it('passes a Blob content directly to the writable stream', async () => {
    const blob = new Blob(['pdf-bytes'], { type: 'application/pdf' })
    await saveFile({ content: blob, filename: 'itinerary.pdf', mimeType: 'application/pdf' })
    const writtenArg = writable.write.mock.calls[0][0]
    expect(writtenArg).toBeInstanceOf(Blob)
  })

  it('swallows AbortError silently (user cancelled native dialog)', async () => {
    const abortError = new DOMException('User cancelled', 'AbortError')
    showSaveFilePicker.mockRejectedValueOnce(abortError)
    await expect(
      saveFile({ content: 'hello', filename: 'itinerary.md', mimeType: 'text/markdown' })
    ).resolves.toBeUndefined()
  })

  it('re-throws non-AbortError errors', async () => {
    const networkError = new Error('Network failure')
    showSaveFilePicker.mockRejectedValueOnce(networkError)
    await expect(
      saveFile({ content: 'hello', filename: 'itinerary.md', mimeType: 'text/markdown' })
    ).rejects.toThrow('Network failure')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Anchor fallback path (no showSaveFilePicker)
// ─────────────────────────────────────────────────────────────────────────────

describe('saveFile – anchor fallback path', () => {
  let clickSpy: jest.SpyInstance
  let appendChildSpy: jest.SpyInstance
  let removeChildSpy: jest.SpyInstance

  beforeEach(() => {
    // Ensure showSaveFilePicker is not present
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).showSaveFilePicker

    window.URL.createObjectURL = jest.fn(() => 'blob:mock-url')
    window.URL.revokeObjectURL = jest.fn()

    // Spy on anchor click to prevent jsdom navigation
    clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    appendChildSpy = jest.spyOn(document.body, 'appendChild').mockImplementation((node) => node)
    removeChildSpy = jest.spyOn(document.body, 'removeChild').mockImplementation((node) => node)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('calls URL.createObjectURL with a Blob', async () => {
    await saveFile({ content: 'hello', filename: 'test.md', mimeType: 'text/markdown' })
    expect(window.URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
  })

  it('creates an anchor element with correct download attribute', async () => {
    const createElementSpy = jest.spyOn(document, 'createElement')
    await saveFile({ content: 'hello', filename: 'test.md', mimeType: 'text/markdown' })
    const anchorCalls = createElementSpy.mock.calls.filter((c) => c[0] === 'a')
    expect(anchorCalls.length).toBeGreaterThan(0)
  })

  it('calls URL.revokeObjectURL after download', async () => {
    await saveFile({ content: 'hello', filename: 'test.md', mimeType: 'text/markdown' })
    expect(window.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
  })

  it('resolves without error even when showSaveFilePicker is absent', async () => {
    await expect(
      saveFile({ content: 'hello', filename: 'test.md', mimeType: 'text/markdown' })
    ).resolves.toBeUndefined()
  })
})
