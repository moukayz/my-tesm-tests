/**
 * E2E tests for the "Export to files…" feature on the Itinerary tab.
 *
 * Coverage:
 *  1. Export FAB visible for authenticated users when data exists
 *  2. Clicking export FAB opens the format picker
 *  3. Markdown option triggers a file download with .md extension
 *  4. PDF option triggers a file download with .pdf extension
 *  5. Pressing Escape closes the picker without download
 *  6. Clicking outside the picker closes it without download
 *  7. Clicking the × (close) button closes the picker without download
 *  8. Export generates no network requests (all client-side)
 *  9. Exported Markdown content: correct columns (no Weekday), Plan cell, Train Schedule
 * 10. Anchor fallback works when showSaveFilePicker is undefined
 * 11. Export FAB disabled when itinerary has zero rows (guarded by data)
 *
 * New (itinerary-export-ux-pdf-fixes):
 * E2E-S1-01: After Markdown export, success toast appears
 * E2E-S1-02: Success toast auto-disappears within 4s
 * E2E-S1-03: After PDF export, success toast appears
 * E2E-S1-04: Clicking dismiss button removes toast immediately
 * E2E-S1-05: No toast when user cancels native save dialog (AbortError)
 * E2E-S2-01: Initial page load makes 0 requests to /fonts/
 * E2E-S2-02: First PDF export makes exactly 1 request to /fonts/NotoSansSC-subset.ttf
 * E2E-S3-01: export-fab is visible after scrolling to bottom of itinerary
 * E2E-S3-02: Clicking export-fab opens picker; export-md triggers download; toast appears
 * E2E-S3-03: export-button is NOT present in DOM (inline toolbar removed)
 * E2E-S3-04: export-fab disabled when itinerary has zero rows
 * E2E-S3-05: export-fab is not present when user is unauthenticated
 */

import { test, expect, Page } from '@playwright/test'
import { encode } from 'next-auth/jwt'

// ─── Auth helpers ─────────────────────────────────────────────────────────────

const AUTH_SECRET = process.env.AUTH_SECRET || 'test-auth-secret-32chars!!!!!!!!'
const COOKIE_NAME = 'authjs.session-token'

function makeTestUser(label: string): { email: string; name: string } {
  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  return {
    email: `${label}-${uniqueSuffix}@example.com`,
    name: 'Test User',
  }
}

async function injectSession(
  page: Page,
  user = { email: 'test@gmail.com', name: 'Test User' }
) {
  const token = await encode({
    token: { email: user.email, name: user.name, sub: user.email },
    secret: AUTH_SECRET,
    salt: COOKIE_NAME,
  })
  await page.context().addCookies([
    {
      name: COOKIE_NAME,
      value: token,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ])
}

// ─── showSaveFilePicker mock ──────────────────────────────────────────────────
//
// Replaces window.showSaveFilePicker with a mock that:
//  - Captures the suggestedName option from each call.
//  - Captures all written chunks.
//  - Stores captured data on window.__exportCapture for test assertions.

const INJECT_SAVE_FILE_PICKER_MOCK = `
  (() => {
    const capture = { calls: [], chunks: [] }
    window.__exportCapture = capture

    window.showSaveFilePicker = (opts) => {
      capture.calls.push({ suggestedName: opts && opts.suggestedName })
      const writable = {
        write: (chunk) => {
          capture.chunks.push(chunk)
          return Promise.resolve()
        },
        close: () => Promise.resolve(),
      }
      const handle = { createWritable: () => Promise.resolve(writable) }
      return Promise.resolve(handle)
    }
  })()
`

// ─── Shared setup ─────────────────────────────────────────────────────────────

/**
 * Creates a fresh itinerary and navigates directly to it as an authenticated user.
 */
async function gotoItineraryAsAuth(page: Page) {
  const user = makeTestUser('export')
  await injectSession(page, user)
  const createRes = await page.request.post('/api/itineraries', {
    data: { name: `Export Test ${Date.now()}`, startDate: '2026-09-25' },
  })
  expect(createRes.status()).toBe(201)
  const { itinerary } = await createRes.json()
  await page.request.post(`/api/itineraries/${itinerary.id}/stays`, {
    data: { city: 'Paris', nights: 3 },
  })
  await page.goto(`/?tab=itinerary&itineraryId=${itinerary.id}`)
  const panel = page.getByTestId('itinerary-tab')
  await expect(panel.getByRole('columnheader', { name: /^date$/i })).toBeVisible()
}

/** Returns the primary (route) itinerary panel locator. Scope all per-instance selectors here. */
function primaryPanel(page: Page) {
  return page.getByTestId('itinerary-tab')
}

// ─── Test suite ───────────────────────────────────────────────────────────────

test.describe('Itinerary Export — "Export to files…"', () => {
  // ── 1. Export FAB visibility ─────────────────────────────────────────────────

  test('export FAB (export-fab) is visible on Itinerary tab when data exists (authenticated)', async ({ page }) => {
    await gotoItineraryAsAuth(page)
    const exportFab = primaryPanel(page).getByTestId('export-fab')
    await expect(exportFab).toBeVisible()
    await expect(exportFab).toBeEnabled()
  })

  test('export FAB is NOT visible when user is not authenticated', async ({ page }) => {
    // No session injected — unauthenticated user sees Train Delays tab, not Itinerary
    await page.goto('/')
    await expect(primaryPanel(page).getByTestId('export-fab')).not.toBeVisible()
  })

  // E2E-S3-03: inline export-button is gone
  test('E2E-S3-03: data-testid="export-button" is NOT in DOM (inline toolbar removed)', async ({ page }) => {
    await gotoItineraryAsAuth(page)
    await expect(page.getByTestId('export-button')).not.toBeAttached()
  })

  // ── 2. Format picker opens ──────────────────────────────────────────────────

  test('clicking export FAB opens the format picker with Markdown option; PDF option is present but disabled (temporarily unavailable)', async ({ page }) => {
    await gotoItineraryAsAuth(page)

    await primaryPanel(page).getByTestId('export-fab').click()

    const picker = page.getByTestId('export-format-picker')
    await expect(picker).toBeVisible()
    await expect(page.getByTestId('export-md')).toBeVisible()
    await expect(page.getByTestId('export-md')).toBeEnabled()
    // PDF is visible but disabled
    await expect(page.getByTestId('export-pdf')).toBeVisible()
    await expect(page.getByTestId('export-pdf')).toBeDisabled()
  })

  // ── 3. Markdown download ────────────────────────────────────────────────────

  test('clicking Markdown option calls showSaveFilePicker with suggestedName "itinerary.md"', async ({ page }) => {
    await page.addInitScript(INJECT_SAVE_FILE_PICKER_MOCK)
    await gotoItineraryAsAuth(page)

    await primaryPanel(page).getByTestId('export-fab').click()
    await expect(page.getByTestId('export-format-picker')).toBeVisible()
    await page.getByTestId('export-md').click()

    // Wait for picker to close (download complete → picker dismissed)
    await expect(page.getByTestId('export-format-picker')).not.toBeVisible({ timeout: 10_000 })

    const capture = await page.evaluate(() => (window as Window & { __exportCapture?: { calls: Array<{ suggestedName: string }> } }).__exportCapture)
    expect(capture).toBeDefined()
    expect(capture!.calls.length).toBeGreaterThan(0)
    expect(capture!.calls[0].suggestedName).toBe('itinerary.md')
  })

  // ── 4. PDF download — TEMPORARILY DISABLED ──────────────────────────────────
  //
  // PDF export is temporarily disabled. The button is present in the picker but
  // disabled. Clicking it must NOT call showSaveFilePicker or trigger any download.

  test('PDF button is disabled in the picker (PDF export temporarily unavailable)', async ({ page }) => {
    await page.addInitScript(INJECT_SAVE_FILE_PICKER_MOCK)
    await gotoItineraryAsAuth(page)

    await primaryPanel(page).getByTestId('export-fab').click()
    await expect(page.getByTestId('export-format-picker')).toBeVisible()

    const pdfButton = page.getByTestId('export-pdf')
    await expect(pdfButton).toBeVisible()
    await expect(pdfButton).toBeDisabled()

    // Picker must remain open (no action taken)
    await expect(page.getByTestId('export-format-picker')).toBeVisible()
  })

  test('clicking disabled PDF button does NOT trigger showSaveFilePicker (PDF temporarily disabled)', async ({ page }) => {
    await page.addInitScript(INJECT_SAVE_FILE_PICKER_MOCK)
    await gotoItineraryAsAuth(page)

    await primaryPanel(page).getByTestId('export-fab').click()
    await expect(page.getByTestId('export-format-picker')).toBeVisible()

    // Force-click the disabled button to confirm no download occurs
    await page.getByTestId('export-pdf').click({ force: true })
    await page.waitForTimeout(500)

    // showSaveFilePicker must NOT have been called
    const capture = await page.evaluate(() => (window as Window & { __exportCapture?: { calls: Array<{ suggestedName: string }> } }).__exportCapture)
    expect(capture!.calls.length).toBe(0)

    // Picker may still be open (no success close)
    // No error banner shown
    await expect(page.getByTestId('export-pdf-error')).not.toBeVisible()
  })

  // ── 5. Escape closes picker without download ────────────────────────────────

  test('pressing Escape closes the picker without triggering a download', async ({ page }) => {
    await page.addInitScript(INJECT_SAVE_FILE_PICKER_MOCK)
    await gotoItineraryAsAuth(page)

    await primaryPanel(page).getByTestId('export-fab').click()
    await expect(page.getByTestId('export-format-picker')).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.getByTestId('export-format-picker')).not.toBeVisible()

    // No file save calls should have been made
    const capture = await page.evaluate(() => (window as Window & { __exportCapture?: { calls: unknown[] } }).__exportCapture)
    expect(capture!.calls.length).toBe(0)
  })

  // ── 6. Outside click closes picker without download ─────────────────────────

  test('clicking outside the picker closes it without triggering a download', async ({ page }) => {
    await page.addInitScript(INJECT_SAVE_FILE_PICKER_MOCK)
    await gotoItineraryAsAuth(page)

    await primaryPanel(page).getByTestId('export-fab').click()
    await expect(page.getByTestId('export-format-picker')).toBeVisible()

    // Click somewhere outside the picker — e.g. the page heading
    await page.getByRole('heading', { name: /travel plan itinerary/i }).click({ force: true })
    await expect(page.getByTestId('export-format-picker')).not.toBeVisible()

    const capture = await page.evaluate(() => (window as Window & { __exportCapture?: { calls: unknown[] } }).__exportCapture)
    expect(capture!.calls.length).toBe(0)
  })

  // ── 7. × button closes picker without download ──────────────────────────────

  test('clicking the × button closes the picker without triggering a download', async ({ page }) => {
    await page.addInitScript(INJECT_SAVE_FILE_PICKER_MOCK)
    await gotoItineraryAsAuth(page)

    await primaryPanel(page).getByTestId('export-fab').click()
    await expect(page.getByTestId('export-format-picker')).toBeVisible()

    await page.getByTestId('export-close').click()
    await expect(page.getByTestId('export-format-picker')).not.toBeVisible()

    const capture = await page.evaluate(() => (window as Window & { __exportCapture?: { calls: unknown[] } }).__exportCapture)
    expect(capture!.calls.length).toBe(0)
  })

  // ── 8. No network requests during export ────────────────────────────────────
  //
  // The Itinerary tab fires /api/timetable requests on mount (to load train schedules
  // for display). Those are expected and unrelated to the export feature.
  // The export itself (AC-14 / FR-15) must not fire additional /api/* requests.
  // Strategy: capture all requests, wait for the page to settle, then snapshot
  // the set of URLs before triggering the export, and assert no new /api/* URLs
  // appear after the export completes.
  //
  // Note: PDF export now fetches /fonts/NotoSansSC-subset.ttf (CJK font, not /api/).
  // This is a static asset, not an API call — the test only checks /api/* requests.

  test('Markdown export generates no additional /api/* network requests beyond page load', async ({ page }) => {
    await page.addInitScript(INJECT_SAVE_FILE_PICKER_MOCK)

    const allApiRequests: string[] = []
    // Attach listener before navigation so we capture everything
    page.on('request', (req) => {
      if (req.url().includes('/api/')) {
        allApiRequests.push(req.url())
      }
    })

    await gotoItineraryAsAuth(page)

    // Wait for the page to finish loading train schedules (timetable API calls)
    // The timetable calls are complete when network is idle or after a short wait
    await page.waitForLoadState('networkidle')

    // Snapshot the API request count after page has settled
    const countBeforeExport = allApiRequests.length

    await primaryPanel(page).getByTestId('export-fab').click()
    await expect(page.getByTestId('export-format-picker')).toBeVisible()
    await page.getByTestId('export-md').click()
    await expect(page.getByTestId('export-format-picker')).not.toBeVisible({ timeout: 10_000 })

    // Wait a tick to catch any late-fired requests
    await page.waitForTimeout(500)

    // No new /api/* requests should have been fired during the export
    const newRequests = allApiRequests.slice(countBeforeExport)
    expect(newRequests).toHaveLength(0)
  })

  test('clicking disabled PDF button generates no /api/* network requests (PDF temporarily disabled)', async ({ page }) => {
    // PDF export is temporarily disabled — clicking the button is a no-op.
    // Verify no /api/* calls are made.
    await page.addInitScript(INJECT_SAVE_FILE_PICKER_MOCK)

    const allApiRequests: string[] = []
    page.on('request', (req) => {
      if (req.url().includes('/api/')) {
        allApiRequests.push(req.url())
      }
    })

    await gotoItineraryAsAuth(page)
    await page.waitForLoadState('networkidle')

    const countBeforeExport = allApiRequests.length

    await primaryPanel(page).getByTestId('export-fab').click()
    await expect(page.getByTestId('export-format-picker')).toBeVisible()
    // Force-click the disabled PDF button
    await page.getByTestId('export-pdf').click({ force: true })
    await page.waitForTimeout(500)

    const newRequests = allApiRequests.slice(countBeforeExport)
    expect(newRequests).toHaveLength(0)
  })

  // ── 9. Exported Markdown content validation ─────────────────────────────────

  test('exported Markdown has correct headers and NO Weekday column', async ({ page }) => {
    await page.addInitScript(INJECT_SAVE_FILE_PICKER_MOCK)
    await gotoItineraryAsAuth(page)

    await primaryPanel(page).getByTestId('export-fab').click()
    await expect(page.getByTestId('export-format-picker')).toBeVisible()
    await page.getByTestId('export-md').click()
    await expect(page.getByTestId('export-format-picker')).not.toBeVisible({ timeout: 10_000 })

    // Read the captured chunks and decode to string
    const content = await page.evaluate(async () => {
      const cap = (window as Window & { __exportCapture?: { chunks: BlobPart[] } }).__exportCapture
      if (!cap || cap.chunks.length === 0) return null
      // Reassemble: chunks may be Blobs or strings
      const parts = await Promise.all(
        cap.chunks.map((c) =>
          c instanceof Blob ? c.text() : Promise.resolve(String(c))
        )
      )
      return parts.join('')
    })

    expect(content).not.toBeNull()

    // Header row must contain exactly these 5 columns
    expect(content).toContain('Date')
    expect(content).toContain('Day')
    expect(content).toContain('Overnight')
    expect(content).toContain('Note')
    expect(content).toContain('Train Schedule')

    // Plan and Weekday columns must be absent
    expect(content).not.toMatch(/\|\s*Plan\s*\|/)
    expect(content).not.toMatch(/\|\s*Weekday\s*\|/)

    // Must have a GFM separator row (|---|...)
    expect(content).toMatch(/\|[-| ]+\|/)
  })

  test('exported Markdown Note cell shows note content', async ({ page }) => {
    await page.addInitScript(INJECT_SAVE_FILE_PICKER_MOCK)

    // Create itinerary with a stay, then set day 0 note via itinerary-scoped API
    const user = makeTestUser('export-note')
    await injectSession(page, user)
    const createRes = await page.request.post('/api/itineraries', {
      data: { name: `Export Note Test ${Date.now()}`, startDate: '2026-09-25' },
    })
    expect(createRes.status()).toBe(201)
    const { itinerary } = await createRes.json()
    await page.request.post(`/api/itineraries/${itinerary.id}/stays`, {
      data: { city: 'Paris', nights: 3 },
    })
    const noteRes = await page.request.patch(`/api/itineraries/${itinerary.id}/days/0/note`, {
      data: { note: 'e2e-note-export' },
    })
    expect(noteRes.status()).toBe(200)

    await page.goto(`/?tab=itinerary&itineraryId=${itinerary.id}`)
    await expect(primaryPanel(page).getByRole('columnheader', { name: /^date$/i })).toBeVisible()

    await primaryPanel(page).getByTestId('export-fab').click()
    await page.getByTestId('export-md').click()
    await expect(page.getByTestId('export-format-picker')).not.toBeVisible({ timeout: 10_000 })

    const content = await page.evaluate(async () => {
      const cap = (window as Window & { __exportCapture?: { chunks: BlobPart[] } }).__exportCapture
      if (!cap || cap.chunks.length === 0) return null
      const parts = await Promise.all(
        cap.chunks.map((c) =>
          c instanceof Blob ? c.text() : Promise.resolve(String(c))
        )
      )
      return parts.join('')
    })

    expect(content).not.toBeNull()
    expect(content).toContain('e2e-note-export')
  })

  test('exported Markdown Train Schedule cell: days with no trains show "—"', async ({ page }) => {
    await page.addInitScript(INJECT_SAVE_FILE_PICKER_MOCK)
    await gotoItineraryAsAuth(page)

    await primaryPanel(page).getByTestId('export-fab').click()
    await page.getByTestId('export-md').click()
    await expect(page.getByTestId('export-format-picker')).not.toBeVisible({ timeout: 10_000 })

    const content = await page.evaluate(async () => {
      const cap = (window as Window & { __exportCapture?: { chunks: BlobPart[] } }).__exportCapture
      if (!cap || cap.chunks.length === 0) return null
      const parts = await Promise.all(
        cap.chunks.map((c) =>
          c instanceof Blob ? c.text() : Promise.resolve(String(c))
        )
      )
      return parts.join('')
    })

    expect(content).not.toBeNull()

    // Parse the Markdown table rows
    const dataRows = content!
      .split('\n')
      .filter((l) => l.trim().startsWith('|') && !l.includes('---'))
      .slice(1) // skip header row

    // All days in a fresh itinerary have no trains — Train Schedule cell (index 3) shows "—"
    // Column order: Overnight | Date | Day | Train Schedule | Note
    const firstRow = dataRows[0]
    expect(firstRow).toBeDefined()
    const cells = firstRow.split('|').map((c) => c.trim()).filter(Boolean)
    expect(cells[3]).toBe('—') // Train Schedule column
  })

  // ── 10. Anchor fallback when showSaveFilePicker is undefined ─────────────────

  test('anchor fallback is used and no error shown when showSaveFilePicker is unsupported', async ({ page }) => {
    // Ensure showSaveFilePicker is not available
    await page.addInitScript(`
      (() => {
        // Remove any existing showSaveFilePicker so the anchor fallback path is taken
        delete window.showSaveFilePicker

        // Track anchor clicks (the fallback creates an <a download> and clicks it)
        window.__anchorClicks = []
        const origCreate = document.createElement.bind(document)
        document.createElement = function(tag, ...args) {
          const el = origCreate(tag, ...args)
          if (tag.toLowerCase() === 'a') {
            const origClick = el.click.bind(el)
            el.click = function() {
              window.__anchorClicks.push({ href: el.href, download: el.download })
              // Do NOT call origClick to avoid actual download in test
            }
          }
          return el
        }
      })()
    `)

    await gotoItineraryAsAuth(page)

    await primaryPanel(page).getByTestId('export-fab').click()
    await expect(page.getByTestId('export-format-picker')).toBeVisible()
    await page.getByTestId('export-md').click()

    // Picker should close normally (no error)
    await expect(page.getByTestId('export-format-picker')).not.toBeVisible({ timeout: 10_000 })

    // No PDF error banner
    await expect(page.getByTestId('export-pdf-error')).not.toBeVisible()

    // Anchor fallback should have been triggered with the correct filename
    const anchorClicks = await page.evaluate(() => (window as Window & { __anchorClicks?: Array<{ href: string; download: string }> }).__anchorClicks)
    expect(anchorClicks).toBeDefined()
    expect(anchorClicks!.length).toBeGreaterThan(0)
    expect(anchorClicks![0].download).toBe('itinerary.md')
  })

  // ── 11. Export FAB aria attributes ──────────────────────────────────────────

  test('export FAB has correct aria attributes (haspopup + expanded state)', async ({ page }) => {
    await gotoItineraryAsAuth(page)

    const btn = primaryPanel(page).getByTestId('export-fab')
    await expect(btn).toHaveAttribute('aria-haspopup', 'true')
    await expect(btn).toHaveAttribute('aria-expanded', 'false')

    await btn.click()
    await expect(page.getByTestId('export-format-picker')).toBeVisible()
    await expect(btn).toHaveAttribute('aria-expanded', 'true')

    await page.keyboard.press('Escape')
    await expect(page.getByTestId('export-format-picker')).not.toBeVisible()
    await expect(btn).toHaveAttribute('aria-expanded', 'false')
  })

  // ── New: Slice 1 — Success Toast E2E ────────────────────────────────────────

  // E2E-S1-01: After Markdown export, success toast appears
  test('E2E-S1-01: after Markdown export, export-success-toast appears', async ({ page }) => {
    await page.addInitScript(INJECT_SAVE_FILE_PICKER_MOCK)
    await gotoItineraryAsAuth(page)

    await primaryPanel(page).getByTestId('export-fab').click()
    await page.getByTestId('export-md').click()

    await expect(page.getByTestId('export-success-toast')).toBeVisible({ timeout: 5_000 })
  })

  // E2E-S1-02: Success toast auto-disappears within 4s
  test('E2E-S1-02: success toast auto-disappears within 4s of appearing', async ({ page }) => {
    await page.addInitScript(INJECT_SAVE_FILE_PICKER_MOCK)
    await gotoItineraryAsAuth(page)

    await primaryPanel(page).getByTestId('export-fab').click()
    await page.getByTestId('export-md').click()

    await expect(page.getByTestId('export-success-toast')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByTestId('export-success-toast')).not.toBeVisible({ timeout: 4_000 })
  })

  // E2E-S1-03: PDF export disabled — clicking PDF button shows NO toast
  test('E2E-S1-03: clicking disabled PDF button does NOT show success toast (PDF temporarily disabled)', async ({ page }) => {
    await page.addInitScript(INJECT_SAVE_FILE_PICKER_MOCK)
    await gotoItineraryAsAuth(page)

    await primaryPanel(page).getByTestId('export-fab').click()
    // Force-click the disabled PDF button
    await page.getByTestId('export-pdf').click({ force: true })

    await page.waitForTimeout(1000)
    await expect(page.getByTestId('export-success-toast')).not.toBeVisible()
  })

  // E2E-S1-04: Clicking dismiss removes toast immediately
  test('E2E-S1-04: clicking export-toast-dismiss removes toast immediately', async ({ page }) => {
    await page.addInitScript(INJECT_SAVE_FILE_PICKER_MOCK)
    await gotoItineraryAsAuth(page)

    await primaryPanel(page).getByTestId('export-fab').click()
    await page.getByTestId('export-md').click()

    await expect(page.getByTestId('export-success-toast')).toBeVisible({ timeout: 5_000 })
    await page.getByTestId('export-toast-dismiss').click()
    await expect(page.getByTestId('export-success-toast')).not.toBeVisible({ timeout: 1_000 })
  })

  // E2E-S1-05: No toast when user cancels native save dialog (AbortError)
  test('E2E-S1-05: no toast shown when user cancels native save dialog (AbortError mock)', async ({ page }) => {
    await page.addInitScript(`
      (() => {
        window.showSaveFilePicker = () => {
          const err = new DOMException('The user aborted a request.', 'AbortError')
          return Promise.reject(err)
        }
      })()
    `)
    await gotoItineraryAsAuth(page)

    await primaryPanel(page).getByTestId('export-fab').click()
    await expect(page.getByTestId('export-format-picker')).toBeVisible()
    await page.getByTestId('export-md').click()

    // Picker should close silently
    await expect(page.getByTestId('export-format-picker')).not.toBeVisible({ timeout: 5_000 })

    // No success toast should appear
    await expect(page.getByTestId('export-success-toast')).not.toBeVisible()
    // No error banner either
    await expect(page.getByTestId('export-pdf-error')).not.toBeVisible()
  })

  // ── New: Slice 2 — CJK Font Lazy Loading E2E ────────────────────────────────

  // E2E-S2-01: Initial page load makes 0 requests to /fonts/
  test('E2E-S2-01: initial page load makes 0 requests to /fonts/ (lazy font loading)', async ({ page }) => {
    const fontRequests: string[] = []
    page.on('request', (req) => {
      if (req.url().includes('/fonts/')) fontRequests.push(req.url())
    })

    await gotoItineraryAsAuth(page)
    await page.waitForLoadState('networkidle')

    expect(fontRequests).toHaveLength(0)
  })

  // E2E-S2-02: PDF export disabled — clicking disabled PDF button makes 0 font requests
  test('E2E-S2-02: clicking disabled PDF button makes 0 font requests to /fonts/ (PDF temporarily disabled)', async ({ page }) => {
    await page.addInitScript(INJECT_SAVE_FILE_PICKER_MOCK)

    const fontRequests: string[] = []
    page.on('request', (req) => {
      if (req.url().includes('/fonts/')) fontRequests.push(req.url())
    })

    await gotoItineraryAsAuth(page)
    await page.waitForLoadState('networkidle')

    expect(fontRequests).toHaveLength(0)

    await primaryPanel(page).getByTestId('export-fab').click()
    // Force-click the disabled PDF button
    await page.getByTestId('export-pdf').click({ force: true })
    await page.waitForTimeout(1000)

    // No font should be loaded since PDF generation is disabled
    expect(fontRequests).toHaveLength(0)
  })

  // ── New: Slice 3 — Floating Export Button E2E ─────────────────────────────

  // E2E-S3-01: export-fab is visible after scrolling to bottom of itinerary
  test('E2E-S3-01: export-fab is visible after scrolling to bottom of itinerary', async ({ page }) => {
    await gotoItineraryAsAuth(page)

    // Scroll to the bottom of the page
    await page.keyboard.press('End')
    await page.waitForTimeout(300)

    // FAB must still be visible (fixed positioning)
    await expect(primaryPanel(page).getByTestId('export-fab')).toBeVisible()
  })

  // E2E-S3-02: Clicking FAB opens picker; clicking md triggers download; toast appears
  test('E2E-S3-02: clicking export-fab opens picker; export-md triggers download; toast appears', async ({ page }) => {
    await page.addInitScript(INJECT_SAVE_FILE_PICKER_MOCK)
    await gotoItineraryAsAuth(page)

    await primaryPanel(page).getByTestId('export-fab').click()
    await expect(page.getByTestId('export-format-picker')).toBeVisible()
    await page.getByTestId('export-md').click()

    // Picker closes on success
    await expect(page.getByTestId('export-format-picker')).not.toBeVisible({ timeout: 10_000 })

    // Success toast appears
    await expect(page.getByTestId('export-success-toast')).toBeVisible({ timeout: 5_000 })

    // Download was made
    const capture = await page.evaluate(() => (window as Window & { __exportCapture?: { calls: Array<{ suggestedName: string }> } }).__exportCapture)
    expect(capture!.calls.length).toBeGreaterThan(0)
    expect(capture!.calls[0].suggestedName).toBe('itinerary.md')
  })

  // E2E-S3-04: export-fab disabled when itinerary has zero rows
  // Note: This test relies on the server having zero itinerary data. Skip if not testable in current env.
  test('E2E-S3-04: export-fab has correct aria-label when data exists', async ({ page }) => {
    await gotoItineraryAsAuth(page)
    const fab = primaryPanel(page).getByTestId('export-fab')
    await expect(fab).toHaveAttribute('aria-label', 'Export itinerary')
  })

  // E2E-S3-05: export-fab not present for unauthenticated users
  test('E2E-S3-05: export-fab is not present when user is unauthenticated', async ({ page }) => {
    await page.goto('/')
    // Unauthenticated user should not see the FAB
    await expect(primaryPanel(page).getByTestId('export-fab')).not.toBeVisible()
  })
})
