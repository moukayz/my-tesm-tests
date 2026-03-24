/**
 * E2E tests — Editable Itinerary Stays feature
 *
 * Feature: editable-itinerary-stays
 * Covers:
 *   - AC-9  Unauthenticated users see no itinerary tab
 *   - Regression: /api/stay-update 401 for unauthenticated requests
 *   - Regression: API contract for /api/stay-update (route store)
 */

import { test, expect, type Page } from '@playwright/test'
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
    const user = { email: `stay-edit-cards-${Date.now()}@example.com`, name: 'Test User' }
    await injectSession(page, user)
    const res = await page.request.post('/api/itineraries', {
      data: { name: 'Stay edit test itinerary', startDate: '2026-01-01' },
    })
    expect(res.status()).toBe(201)
    await page.goto('/?tab=itinerary')
    await expect(page.getByTestId('itinerary-cards-rail')).toBeVisible()
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
})
