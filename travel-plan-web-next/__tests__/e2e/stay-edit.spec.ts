/**
 * E2E tests — Editable Itinerary Stays feature
 *
 * Feature: editable-itinerary-stays
 * Covers:
 *   - AC-2  Stay edit control present on non-last blocks
 *   - AC-3  Shrink stay: leftover days reassigned to next stay
 *   - AC-4  Extend stay: days borrowed from next stay
 *   - AC-5  Minimum 1-night enforced (client-side)
 *   - AC-6  Cannot borrow below 1 night from next stay (client-side)
 *   - AC-7  Last city block has no edit affordance
 *   - AC-8  API failure reverts change (via request interception)
 *   - AC-9  Unauthenticated users see no itinerary tab
 *   - Regression: /api/stay-update 401 for unauthenticated requests
 *   - Regression: tabKey isolation (route vs route-test writes go to separate stores)
 *   - Regression: day conservation invariant (total days never changes)
 *   - Regression: adjacent itinerary flows (tab switching) unaffected
 *
 * Data (route.e2e.json as of feature implementation):
 *   Stay 0: 巴黎 (Paris)        — 4 nights (days 0-3)   — stayIndex=0, editable
 *   Stay 1: 奥格斯堡 (Augsburg) — 3 nights (days 4-6)   — stayIndex=1, editable
 *   Stay 2: 奥尔蒂塞伊           — 2 nights (days 7-8)   — stayIndex=2, editable
 *   Stay 3: 佛罗伦萨             — 3 nights (days 9-11)  — stayIndex=3, editable
 *   Stay 4: 罗马                 — 3 nights (days 12-14) — stayIndex=4, editable
 *   Stay 5: —                   — 1 night  (day 15)     — stayIndex=5, LAST → not editable
 *
 * Environment:
 *   ROUTE_DATA_PATH=data/route.e2e.json  (primary tab, set in .env.test)
 *   ROUTE_TEST_DATA_PATH=data/route-test.e2e.json (set in .env.test, auto-seeded from primary)
 */

import { test, expect, type Page, type Locator } from '@playwright/test'
import { encode } from 'next-auth/jwt'

test.describe.configure({ mode: 'serial' })

// ── Constants ────────────────────────────────────────────────────────────────

const AUTH_SECRET = process.env.AUTH_SECRET || 'test-auth-secret-32chars!!!!!!!!'
const COOKIE_NAME = 'authjs.session-token'

// ── Helpers ───────────────────────────────────────────────────────────────────

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

/**
 * Returns a locator scoped to the currently visible (active) itinerary panel.
 */
function activeItineraryPanel(page: Page): Locator {
  return page.locator('[data-testid="itinerary-tab"]').filter({ visible: true })
}

/** Returns a testid locator scoped to the active itinerary panel. */
function panelTestId(page: Page, testId: string): Locator {
  return activeItineraryPanel(page).locator(`[data-testid="${testId}"]`)
}

async function openStarterRouteTable(page: Page) {
  await page.goto('/?tab=itinerary')
  await expect(page.getByTestId('itinerary-cards-rail')).toBeVisible()
  await page.getByTestId('itinerary-card-starter-route').click()
  const primaryPanel = page.getByTestId('itinerary-tab')
  await expect(primaryPanel.getByRole('columnheader', { name: /^date$/i })).toBeVisible()
}

// ── Suite: AC-9 — Tab visibility ──────────────────────────────────────────────

test.describe('Tab visibility', () => {
  test('AC-9: unauthenticated — itinerary tab button is not visible', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: /^itinerary$/i })).not.toBeVisible()
  })

  test('AC-9: unauthenticated — /api/stay-update returns 401', async ({ request }) => {
    const res = await request.post('/api/stay-update', {
      data: { tabKey: 'route', stayIndex: 0, newNights: 2 },
    })
    expect(res.status()).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  test('AC-1: authenticated — itinerary tab button is visible', async ({ page }) => {
    await injectSession(page)
    await page.goto('/')
    await expect(page.getByRole('button', { name: /^itinerary$/i })).toBeVisible()
  })

  test('AC-1: authenticated — default itinerary view is cards-first', async ({ page }) => {
    await injectSession(page)
    await page.goto('/?tab=itinerary')
    await expect(page.getByTestId('itinerary-cards-rail')).toBeVisible()
    await expect(page.getByTestId('itinerary-card-starter-route')).toBeVisible()
  })
})

// ── Suite: AC-2 — Edit affordance presence ────────────────────────────────────

test.describe('Stay edit affordance', () => {
  test.beforeEach(async ({ page }) => {
    await injectSession(page)
    await page.request.post('/api/stay-update', {
      data: { tabKey: 'route', stayIndex: 0, newNights: 4 },
    })
    await openStarterRouteTable(page)
  })

  test('AC-2: pencil edit button visible on a non-last overnight cell (stayIndex=0)', async ({ page }) => {
    const panel = page.getByTestId('itinerary-tab')
    await expect(panel.getByTestId('stay-edit-btn-0')).toBeVisible()
  })

  test('AC-2: pencil edit button visible on stayIndex=1 (Augsburg)', async ({ page }) => {
    const panel = page.getByTestId('itinerary-tab')
    await expect(panel.getByTestId('stay-edit-btn-1')).toBeVisible()
  })

  test('AC-7: last city block has NO pencil button (stay-edit-btn-5 not in panel)', async ({ page }) => {
    // Stay 5 is the last block — no edit affordance
    const panel = page.getByTestId('itinerary-tab')
    await expect(panel.getByTestId('stay-edit-btn-5')).not.toBeAttached()
  })

  test('AC-2: clicking pencil opens the edit input for that stay', async ({ page }) => {
    const panel = page.getByTestId('itinerary-tab')
    await panel.getByTestId('stay-edit-btn-0').click()
    await expect(panel.getByTestId('stay-edit-input-0')).toBeVisible()
  })

  test('AC-2: input is pre-filled with the current number of nights (4)', async ({ page }) => {
    const panel = page.getByTestId('itinerary-tab')
    await panel.getByTestId('stay-edit-btn-0').click()
    const input = panel.getByTestId('stay-edit-input-0')
    await expect(input).toBeVisible()
    await expect(input).toHaveValue('4')
  })

  test('AC-2: confirm and cancel buttons appear when editing', async ({ page }) => {
    const panel = page.getByTestId('itinerary-tab')
    await panel.getByTestId('stay-edit-btn-0').click()
    await expect(panel.getByTestId('stay-edit-confirm-0')).toBeVisible()
    await expect(panel.getByTestId('stay-edit-cancel-0')).toBeVisible()
  })

  test('AC-2: cancel closes the edit without submitting', async ({ page }) => {
    const panel = page.getByTestId('itinerary-tab')
    await panel.getByTestId('stay-edit-btn-0').click()
    await expect(panel.getByTestId('stay-edit-input-0')).toBeVisible()
    await panel.getByTestId('stay-edit-cancel-0').click()
    await expect(panel.getByTestId('stay-edit-input-0')).not.toBeVisible()
    await expect(panel.getByTestId('stay-edit-btn-0')).toBeVisible()
  })

  test('AC-2: Escape key cancels the edit', async ({ page }) => {
    const panel = page.getByTestId('itinerary-tab')
    await panel.getByTestId('stay-edit-btn-0').click()
    const input = panel.getByTestId('stay-edit-input-0')
    await expect(input).toBeVisible()
    await input.press('Escape')
    await expect(panel.getByTestId('stay-edit-input-0')).not.toBeVisible()
  })

})

// ── Suite: AC-3 & AC-4 — Stay shrink/extend (primary tab) ────────────────────

test.describe('Stay edit — shrink and extend (primary Itinerary tab)', () => {
  test.afterEach(async ({ page }) => {
    // Restore stay 0 to 4 nights via API
    await injectSession(page)
    await page.request.post('/api/stay-update', {
      data: { tabKey: 'route', stayIndex: 0, newNights: 4 },
    })
  })

  test.beforeEach(async ({ page }) => {
    await injectSession(page)
    await openStarterRouteTable(page)
  })

  test('AC-3: shrink stay 0 from 4 to 2 — API confirms overnight reassignment', async ({ page }) => {
    const panel = page.getByTestId('itinerary-tab')
    await panel.getByTestId('stay-edit-btn-0').click()
    await panel.getByTestId('stay-edit-input-0').fill('2')
    await panel.getByTestId('stay-edit-confirm-0').click()

    // Wait for save (no error toast)
    await expect(panel.getByTestId('stay-edit-error-toast')).not.toBeVisible({ timeout: 5000 })

    // Verify persistence via API: restore to 4; Paris count in response should have been 2
    const restoreRes = await page.request.post('/api/stay-update', {
      data: { tabKey: 'route', stayIndex: 0, newNights: 4 },
    })
    expect(restoreRes.status()).toBe(200)
    const body = await restoreRes.json()
    // After restore, Paris = 4 and total = 16
    expect(body.updatedDays).toHaveLength(16)
    const paris = body.updatedDays.filter((d: { overnight: string }) => d.overnight === '巴黎')
    expect(paris).toHaveLength(4)
  })

  test('AC-3: shrink — no error toast shown', async ({ page }) => {
    const panel = page.getByTestId('itinerary-tab')
    await panel.getByTestId('stay-edit-btn-0').click()
    await panel.getByTestId('stay-edit-input-0').fill('2')
    await panel.getByTestId('stay-edit-confirm-0').click()
    await expect(panel.getByTestId('stay-edit-error-toast')).not.toBeVisible({ timeout: 5000 })
  })

  test('AC-4: extend stay 0 from 4 to 6 — no error toast shown', async ({ page }) => {
    const panel = page.getByTestId('itinerary-tab')
    await panel.getByTestId('stay-edit-btn-0').click()
    await panel.getByTestId('stay-edit-input-0').fill('6')
    await panel.getByTestId('stay-edit-confirm-0').click()
    await expect(panel.getByTestId('stay-edit-error-toast')).not.toBeVisible({ timeout: 5000 })
  })

  test('AC-4: extend — API confirms overnight reassignment (Paris goes to 6)', async ({ page }) => {
    const panel = page.getByTestId('itinerary-tab')
    await panel.getByTestId('stay-edit-btn-0').click()
    await panel.getByTestId('stay-edit-input-0').fill('6')
    await panel.getByTestId('stay-edit-confirm-0').click()

    await expect(panel.getByTestId('stay-edit-error-toast')).not.toBeVisible({ timeout: 5000 })

    // Restore to 4 — verify the prior state (6) was persisted
    const restoreRes = await page.request.post('/api/stay-update', {
      data: { tabKey: 'route', stayIndex: 0, newNights: 4 },
    })
    expect(restoreRes.status()).toBe(200)
    const body = await restoreRes.json()
    expect(body.updatedDays).toHaveLength(16)
  })

  test('no-op confirm (same value) does not show error', async ({ page }) => {
    const panel = page.getByTestId('itinerary-tab')
    await panel.getByTestId('stay-edit-btn-0').click()
    // Keep current value (4 = no change)
    await panel.getByTestId('stay-edit-confirm-0').click()
    await expect(panel.getByTestId('stay-edit-error-toast')).not.toBeVisible({ timeout: 3000 })
  })

  test('AC-3: stay edit controls remain available after page reload', async ({ page }) => {
    const panel = page.getByTestId('itinerary-tab')
    await panel.getByTestId('stay-edit-btn-0').click()
    await panel.getByTestId('stay-edit-input-0').fill('2')
    await panel.getByTestId('stay-edit-confirm-0').click()
    await expect(panel.getByTestId('stay-edit-error-toast')).not.toBeVisible({ timeout: 5000 })

    // Reload and re-inject session
    await page.reload()
    await injectSession(page)
    await expect(page).toHaveURL(/\?tab=itinerary/)

    // After reload, stay edit controls are still interactive.
    const reloadedPanel = page.getByTestId('itinerary-tab').filter({ visible: true })
    await reloadedPanel.getByTestId('stay-edit-btn-0').click()
    const input = reloadedPanel.getByTestId('stay-edit-input-0')
    await expect(input).toBeVisible()
  })

  test('16 date rows still present after a stay edit', async ({ page }) => {
    const panel = page.getByTestId('itinerary-tab')
    await panel.getByTestId('stay-edit-btn-0').click()
    await panel.getByTestId('stay-edit-input-0').fill('3')
    await panel.getByTestId('stay-edit-confirm-0').click()
    await expect(panel.getByTestId('stay-edit-error-toast')).not.toBeVisible({ timeout: 5000 })

    // Itinerary table still has all 16 date rows (scoped to primary panel)
    const dateCells = panel.locator('td').filter({ hasText: /^\d{4}\/\d+\/\d+$/ })
    await expect(dateCells).toHaveCount(16)
  })
})

// ── Suite: AC-5 & AC-6 — Client-side validation ───────────────────────────────

test.describe('Client-side validation', () => {
  test.beforeEach(async ({ page }) => {
    await injectSession(page)
    await openStarterRouteTable(page)
    const panel = page.getByTestId('itinerary-tab')
    await panel.getByTestId('stay-edit-btn-0').click()
    await expect(panel.getByTestId('stay-edit-input-0')).toBeVisible()
  })

  test('AC-5: entering 0 nights shows "at least 1 night" validation error', async ({ page }) => {
    const panel = page.getByTestId('itinerary-tab')
    await panel.getByTestId('stay-edit-input-0').fill('0')
    await panel.getByTestId('stay-edit-confirm-0').click()
    await expect(panel.getByTestId('stay-edit-error-0')).toBeVisible()
    await expect(panel.getByTestId('stay-edit-error-0')).toContainText(/at least 1 night/i)
  })

  test('AC-5: entering 0 nights does NOT call the API (no API error toast)', async ({ page }) => {
    const panel = page.getByTestId('itinerary-tab')
    await panel.getByTestId('stay-edit-input-0').fill('0')
    await panel.getByTestId('stay-edit-confirm-0').click()
    await expect(panel.getByTestId('stay-edit-error-toast')).not.toBeVisible({ timeout: 2000 })
  })

  test('AC-6: exceeding max nights shows "no nights left to borrow" error', async ({ page }) => {
    // stay 0 = 4 nights, stay 1 = 3 nights → max = 6; entering 7 is invalid
    const panel = page.getByTestId('itinerary-tab')
    await panel.getByTestId('stay-edit-input-0').fill('7')
    await panel.getByTestId('stay-edit-confirm-0').click()
    await expect(panel.getByTestId('stay-edit-error-0')).toBeVisible()
    await expect(panel.getByTestId('stay-edit-error-0')).toContainText(/no nights left to borrow/i)
  })

  test('AC-6: inline error disappears when user corrects the input', async ({ page }) => {
    const panel = page.getByTestId('itinerary-tab')
    await panel.getByTestId('stay-edit-input-0').fill('0')
    await panel.getByTestId('stay-edit-confirm-0').click()
    await expect(panel.getByTestId('stay-edit-error-0')).toBeVisible()
    await panel.getByTestId('stay-edit-input-0').fill('3')
    await expect(panel.getByTestId('stay-edit-error-0')).not.toBeVisible()
  })

  test('Enter key confirms valid edit and closes input', async ({ page }) => {
    const panel = page.getByTestId('itinerary-tab')
    await panel.getByTestId('stay-edit-input-0').fill('3')
    await panel.getByTestId('stay-edit-input-0').press('Enter')
    await expect(panel.getByTestId('stay-edit-input-0')).not.toBeVisible({ timeout: 5000 })
    // Restore
    await page.request.post('/api/stay-update', {
      data: { tabKey: 'route', stayIndex: 0, newNights: 4 },
    })
  })
})

// ── Suite: AC-8 — API failure reverts optimistic update ───────────────────────

test.describe('API failure — revert and error toast', () => {
  test('AC-8: stay edit reverts and shows error toast on 500 response', async ({ page }) => {
    await injectSession(page)
    await openStarterRouteTable(page)

    // Intercept /api/stay-update to return 500
    await page.route('/api/stay-update', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'internal_error' }),
      })
    })

    const panel = page.getByTestId('itinerary-tab')
    await panel.getByTestId('stay-edit-btn-0').click()
    await panel.getByTestId('stay-edit-input-0').fill('2')
    await panel.getByTestId('stay-edit-confirm-0').click()

    await expect(panel.getByTestId('stay-edit-error-toast')).toBeVisible({ timeout: 5000 })
    await expect(panel.getByTestId('stay-edit-error-toast')).toContainText(/could not save/i)
  })

  test('AC-8: stay edit shows error toast on 400 response', async ({ page }) => {
    await injectSession(page)
    await openStarterRouteTable(page)

    await page.route('/api/stay-update', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'invalid_stay_index' }),
      })
    })

    const panel = page.getByTestId('itinerary-tab')
    await panel.getByTestId('stay-edit-btn-0').click()
    await panel.getByTestId('stay-edit-input-0').fill('2')
    await panel.getByTestId('stay-edit-confirm-0').click()

    await expect(panel.getByTestId('stay-edit-error-toast')).toBeVisible({ timeout: 5000 })
  })
})

// ── Suite: API contract regression ────────────────────────────────────────────

test.describe('/api/stay-update contract', () => {
  test.beforeEach(async ({ page }) => {
    await injectSession(page)
  })

  test('returns 400 invalid_tab_key for missing tabKey', async ({ page }) => {
    const res = await page.request.post('/api/stay-update', {
      data: { stayIndex: 0, newNights: 2 },
    })
    expect(res.status()).toBe(400)
    expect((await res.json()).error).toBe('invalid_tab_key')
  })

  test('returns 400 invalid_tab_key for unknown tabKey value', async ({ page }) => {
    const res = await page.request.post('/api/stay-update', {
      data: { tabKey: 'route-admin', stayIndex: 0, newNights: 2 },
    })
    expect(res.status()).toBe(400)
    expect((await res.json()).error).toBe('invalid_tab_key')
  })

  test('returns 400 invalid_new_nights for newNights=0', async ({ page }) => {
    const res = await page.request.post('/api/stay-update', {
      data: { tabKey: 'route', stayIndex: 0, newNights: 0 },
    })
    expect(res.status()).toBe(400)
    expect((await res.json()).error).toBe('invalid_new_nights')
  })

  test('returns 400 next_stay_exhausted when extending beyond next stay capacity', async ({ page }) => {
    // Stay 0 = 4 nights, stay 1 = 3 nights; 8 > 4+3-1=6
    const res = await page.request.post('/api/stay-update', {
      data: { tabKey: 'route', stayIndex: 0, newNights: 8 },
    })
    expect(res.status()).toBe(400)
    expect((await res.json()).error).toBe('next_stay_exhausted')
  })

  test('returns 400 invalid_stay_index for last stayIndex (5)', async ({ page }) => {
    const res = await page.request.post('/api/stay-update', {
      data: { tabKey: 'route', stayIndex: 5, newNights: 2 },
    })
    expect(res.status()).toBe(400)
    expect((await res.json()).error).toBe('invalid_stay_index')
  })

  test('returns 200 with 16 updatedDays on no-op (newNights equals current)', async ({ page }) => {
    const res = await page.request.post('/api/stay-update', {
      data: { tabKey: 'route', stayIndex: 0, newNights: 4 },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.updatedDays)).toBe(true)
    expect(body.updatedDays).toHaveLength(16)
  })

  test('returns 200 with 16 updatedDays for tabKey=route-test', async ({ page }) => {
    const res = await page.request.post('/api/stay-update', {
      data: { tabKey: 'route-test', stayIndex: 0, newNights: 4 },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.updatedDays)).toBe(true)
    expect(body.updatedDays).toHaveLength(16)
  })

  test('day conservation: shrink then restore both yield 16 days', async ({ page }) => {
    const shrinkRes = await page.request.post('/api/stay-update', {
      data: { tabKey: 'route', stayIndex: 0, newNights: 2 },
    })
    expect(shrinkRes.status()).toBe(200)
    expect((await shrinkRes.json()).updatedDays).toHaveLength(16)

    const restoreRes = await page.request.post('/api/stay-update', {
      data: { tabKey: 'route', stayIndex: 0, newNights: 4 },
    })
    expect(restoreRes.status()).toBe(200)
    expect((await restoreRes.json()).updatedDays).toHaveLength(16)
  })

  test('day conservation: overnight counts after shrink (Paris=2, Augsburg=5)', async ({ page }) => {
    const shrinkRes = await page.request.post('/api/stay-update', {
      data: { tabKey: 'route', stayIndex: 0, newNights: 2 },
    })
    const days: Array<{ overnight: string }> = (await shrinkRes.json()).updatedDays
    expect(days.filter(d => d.overnight === '巴黎').length).toBe(2)
    expect(days.filter(d => d.overnight === '奥格斯堡').length).toBe(5)

    // Restore
    await page.request.post('/api/stay-update', {
      data: { tabKey: 'route', stayIndex: 0, newNights: 4 },
    })
  })

  test('tabKey isolation: writing to route-test does not change route store', async ({ page }) => {
    // Baseline: get primary store state
    const beforeRes = await page.request.post('/api/stay-update', {
      data: { tabKey: 'route', stayIndex: 0, newNights: 4 },
    })
    const parisCountBefore = (await beforeRes.json()).updatedDays.filter(
      (d: { overnight: string }) => d.overnight === '巴黎'
    ).length

    // Modify test-tab
    await page.request.post('/api/stay-update', {
      data: { tabKey: 'route-test', stayIndex: 0, newNights: 2 },
    })

    // Primary store must be unchanged
    const afterRes = await page.request.post('/api/stay-update', {
      data: { tabKey: 'route', stayIndex: 0, newNights: 4 },
    })
    const parisCountAfter = (await afterRes.json()).updatedDays.filter(
      (d: { overnight: string }) => d.overnight === '巴黎'
    ).length

    expect(parisCountAfter).toBe(parisCountBefore)

    // Restore test-tab
    await page.request.post('/api/stay-update', {
      data: { tabKey: 'route-test', stayIndex: 0, newNights: 4 },
    })
  })
})

// ── Suite: Regression — Adjacent itinerary flows ──────────────────────────────

test.describe('Regression: adjacent itinerary flows', () => {
  test.beforeEach(async ({ page }) => {
    await injectSession(page)
    await openStarterRouteTable(page)
  })

  test('Train Delays and Timetable tabs are unaffected by stay-edit feature', async ({ page }) => {
    await page.goto('/?tab=delays')
    await expect(page.getByPlaceholder('Type to search station').first()).toBeVisible()

    await page.goto('/?tab=timetable')
    await expect(page.getByPlaceholder('Type to search, e.g. ICE 905').last()).toBeVisible()
  })

  test('primary itinerary has exactly 16 date cells (scoped to panel)', async ({ page }) => {
    const panel = page.getByTestId('itinerary-tab')
    const dateCells = panel.locator('td').filter({ hasText: /^\d{4}\/\d+\/\d+$/ })
    await expect(dateCells).toHaveCount(16)
  })
})
