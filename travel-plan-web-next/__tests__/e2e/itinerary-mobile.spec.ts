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

test.describe('Itinerary Tab — mobile card view', () => {
  let itineraryId: string

  test.beforeEach(async ({ page }) => {
    // Set mobile viewport before navigation
    await page.setViewportSize({ width: 390, height: 844 })

    const user = makeTestUser('itinerary-mobile')
    await injectSession(page, user)

    const createRes = await page.request.post('/api/itineraries', {
      data: { name: `Mobile E2E ${Date.now()}`, startDate: '2026-09-25' },
    })
    expect(createRes.status()).toBe(201)
    const body = await createRes.json()
    itineraryId = body.itinerary.id

    await page.request.post(`/api/itineraries/${itineraryId}/stays`, {
      data: { city: 'Paris', nights: 2 },
    })
    await page.request.post(`/api/itineraries/${itineraryId}/stays`, {
      data: { city: 'Rome', nights: 2 },
    })
    await page.request.patch(`/api/itineraries/${itineraryId}/days/0/note`, {
      data: { note: 'mobile-test-note' },
    })

    await page.goto(`/?tab=itinerary&itineraryId=${itineraryId}`)
    await expect(page.getByTestId('itinerary-mobile-view')).toBeVisible()
  })

  test('card view is visible and table is hidden at mobile width', async ({ page }) => {
    await expect(page.getByTestId('itinerary-mobile-view')).toBeVisible()
    // The table header should not be visible at mobile width (hidden sm:block)
    await expect(page.getByRole('columnheader', { name: /^date$/i })).not.toBeVisible()
  })

  test('renders a city section per stay with city name', async ({ page }) => {
    await expect(page.getByTestId('stay-section-0')).toBeVisible()
    await expect(page.getByTestId('stay-section-1')).toBeVisible()
    // City names visible
    await expect(page.getByTestId('stay-section-0').getByText('Paris')).toBeVisible()
    await expect(page.getByTestId('stay-section-1').getByText('Rome')).toBeVisible()
  })

  test('shows nights count in section header', async ({ page }) => {
    await expect(page.getByTestId('stay-section-0').getByText(/2 nights/i)).toBeVisible()
  })

  test('renders day cards with date and day number', async ({ page }) => {
    await expect(page.getByTestId('day-card-0')).toBeVisible()
    await expect(page.getByTestId('day-card-1')).toBeVisible()
    await expect(page.getByTestId('day-card-2')).toBeVisible()
    await expect(page.getByTestId('day-card-3')).toBeVisible()
    // Day 1 has date 2026/9/25
    await expect(page.getByTestId('day-card-0').getByText('2026/9/25')).toBeVisible()
  })

  test('note text is visible in the card', async ({ page }) => {
    await expect(page.getByTestId('day-card-0').getByText('mobile-test-note')).toBeVisible()
  })

  test('note edit: tap pencil → textarea appears → blur saves', async ({ page }) => {
    const card0 = page.getByTestId('day-card-0')
    await expect(card0.getByText('mobile-test-note')).toBeVisible()

    // Tap pencil (always visible in card mode)
    await card0.getByRole('button', { name: /edit note/i }).click()
    const textarea = card0.locator('textarea')
    await expect(textarea).toBeVisible()

    // Edit and blur
    await textarea.fill('mobile-updated-note')
    await textarea.blur()

    // Updated text should appear
    await expect(card0.getByText('mobile-updated-note')).toBeVisible()
  })

  test('train schedule edit button is visible (not hover-only) and opens modal', async ({ page }) => {
    // In card mode alwaysShowEdit=true, so button is visible without hover
    const editBtn = page.getByRole('button', { name: /edit train schedule/i }).first()
    await expect(editBtn).toBeVisible()
    await editBtn.click()
    await expect(page.getByRole('dialog')).toBeVisible()
  })
})
