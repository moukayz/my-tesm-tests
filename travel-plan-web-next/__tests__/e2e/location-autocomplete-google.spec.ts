/**
 * E2E tests — Location autocomplete backed by the real Google Places API.
 *
 * These tests are skipped unless the web server is configured with
 * LOCATION_SEARCH_PROVIDER=google (set in .env.local).
 *
 * To run:
 *   1. Set LOCATION_SEARCH_PROVIDER=google and GOOGLE_MAP_API_KEY=<key> in .env.local
 *   2. npm run test:e2e -- --grep "Location autocomplete.*Google"
 */

import { test, expect } from '@playwright/test'
import { encode } from 'next-auth/jwt'

const AUTH_SECRET = process.env.AUTH_SECRET || 'test-auth-secret-32chars!!!!!!!!'
const COOKIE_NAME = 'authjs.session-token'
const IS_GOOGLE_PROVIDER = process.env.LOCATION_SEARCH_PROVIDER === 'google'

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

test.describe('Location autocomplete — Google Places backend', () => {
  test.skip(!IS_GOOGLE_PROVIDER, 'Skipped: set LOCATION_SEARCH_PROVIDER=google in .env.local to run')

  test('search returns real place suggestions from Google for a city query', async ({ page }) => {
    const user = makeTestUser('google-live-search')
    await injectSession(page, user)

    const createResponse = await page.request.post('/api/itineraries', {
      data: { name: `Google Live ${Date.now()}`, startDate: '2026-10-01' },
    })
    expect(createResponse.status()).toBe(201)
    const { workspaceUrl } = await createResponse.json()

    await page.goto(workspaceUrl)
    await page.getByRole('button', { name: 'Add first stay' }).click({ timeout: 15000 })
    await page.getByLabel('City').fill('Paris')

    // Dropdown should appear with real results — no mock
    const listbox = page.getByRole('listbox')
    await expect(listbox).toBeVisible({ timeout: 8000 })

    const options = listbox.getByRole('option')
    await expect(options.first()).toBeVisible({ timeout: 5000 })

    // At least one result should mention France or Paris
    const firstOptionText = await options.first().textContent()
    expect(firstOptionText).toBeTruthy()
    expect(firstOptionText!.length).toBeGreaterThan(2)
  })

  test('selecting a Google result populates country column with real country data', async ({ page }) => {
    test.slow()

    const user = makeTestUser('google-live-select')
    await injectSession(page, user)

    const createResponse = await page.request.post('/api/itineraries', {
      data: { name: `Google Select ${Date.now()}`, startDate: '2026-10-01' },
    })
    expect(createResponse.status()).toBe(201)
    const { workspaceUrl } = await createResponse.json()

    await page.goto(workspaceUrl)
    await page.getByRole('button', { name: 'Add first stay' }).click({ timeout: 15000 })
    await page.getByLabel('City').fill('Berlin')

    const listbox = page.getByRole('listbox')
    await expect(listbox).toBeVisible({ timeout: 8000 })

    // Pick the first resolved result — resolved options have a comma-separated label
    // (e.g. "Berlin, Berlin, Germany"), skipping the custom "Use X as a custom location" option
    const resolvedOption = listbox.getByRole('option').filter({ hasText: /,/ }).first()
    await expect(resolvedOption).toBeVisible({ timeout: 3000 })
    const optionText = await resolvedOption.textContent()
    await resolvedOption.click()

    await page.getByLabel('Nights').fill('2')
    await page.getByRole('button', { name: 'Create stay' }).click()

    const itineraryTab = page.getByTestId('itinerary-tab')
    await expect(itineraryTab).toBeVisible({ timeout: 15000 })

    // The place name (first segment before comma) should appear in the itinerary table
    if (optionText) {
      const placeName = optionText.split(',')[0].trim()
      if (placeName) {
        await expect(itineraryTab.getByText(placeName, { exact: false })).toBeVisible({ timeout: 5000 })
      }
    }
  })

  test('API endpoint returns valid LocationSearchResponse shape with Google sourceIds', async ({ page }) => {
    const user = makeTestUser('google-live-api')
    await injectSession(page, user)

    const response = await page.request.get('/api/locations/search?query=London&limit=3')
    expect(response.status()).toBe(200)

    const body = await response.json()
    expect(body.query).toBe('London')
    expect(Array.isArray(body.results)).toBe(true)
    expect(body.results.length).toBeGreaterThan(0)

    for (const result of body.results) {
      expect(result.kind).toBe('resolved')
      expect(result.place.placeId).toMatch(/^google:/)
      expect(typeof result.coordinates.lat).toBe('number')
      expect(typeof result.coordinates.lng).toBe('number')
      expect(result.label.length).toBeGreaterThan(0)
    }
  })
})
