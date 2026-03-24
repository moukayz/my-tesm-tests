import { test, expect } from '@playwright/test'
import { encode } from 'next-auth/jwt'

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
  page: import('@playwright/test').Page,
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

test.describe('Itinerary Tab', () => {
  let itineraryId: string

  test.beforeEach(async ({ page }) => {
    const user = makeTestUser('itinerary-tab')
    await injectSession(page, user)

    // Create a fresh itinerary with 2 stays (5 days total: Paris 3 + Rome 2)
    const createRes = await page.request.post('/api/itineraries', {
      data: { name: `Itinerary Tab E2E ${Date.now()}`, startDate: '2026-09-25' },
    })
    expect(createRes.status()).toBe(201)
    const body = await createRes.json()
    itineraryId = body.itinerary.id

    await page.request.post(`/api/itineraries/${itineraryId}/stays`, {
      data: { city: 'Paris', nights: 3 },
    })
    await page.request.post(`/api/itineraries/${itineraryId}/stays`, {
      data: { city: 'Rome', nights: 2 },
    })

    // Set day 0 note to a known e2e value via itinerary-scoped API
    const noteRes = await page.request.patch(`/api/itineraries/${itineraryId}/days/0/note`, {
      data: { note: 'e2e-note' },
    })
    expect(noteRes.status()).toBe(200)

    await page.goto(`/?tab=itinerary&itineraryId=${itineraryId}`)
    const panel = page.getByTestId('itinerary-tab')
    await expect(panel.getByRole('columnheader', { name: /^date$/i })).toBeVisible()
  })

  test('itinerary table renders with date "2026/9/25"', async ({ page }) => {
    const panel = page.getByTestId('itinerary-tab')
    await expect(panel.getByText('2026/9/25')).toBeVisible()
  })

  test('Note column header is visible', async ({ page }) => {
    const panel = page.getByTestId('itinerary-tab')
    await expect(panel.getByRole('columnheader', { name: /^note$/i })).toBeVisible()
  })

  test('all 5 days are shown (5 date cells matching date pattern)', async ({ page }) => {
    const panel = page.getByTestId('itinerary-tab')
    const dateCells = panel.locator('td').filter({ hasText: /^\d{4}\/\d+\/\d+$/ })
    await expect(dateCells).toHaveCount(5)
  })

  test('clicking the pencil button on day 1 note opens a textarea', async ({ page }) => {
    const panel = page.getByTestId('itinerary-tab')
    const noteCell = panel.getByTestId('note-cell-0')
    await noteCell.hover()
    await noteCell.getByRole('button', { name: /edit note/i }).click()

    const textarea = panel.locator('textarea')
    await expect(textarea).toBeVisible()
    await expect(textarea).toHaveValue('e2e-note')
  })

  test('editing the note textarea and blurring saves the new value', async ({ page }) => {
    const panel = page.getByTestId('itinerary-tab')
    const noteCell = panel.getByTestId('note-cell-0')
    await noteCell.hover()
    await noteCell.getByRole('button', { name: /edit note/i }).click()

    const textarea = panel.locator('textarea')
    await textarea.fill('e2e-note-edited')
    await textarea.press('Tab')

    await expect(textarea).not.toBeVisible({ timeout: 5000 })
    await expect(panel.getByText('e2e-note-edited')).toBeVisible({ timeout: 10000 })
  })
})
