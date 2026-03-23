/**
 * E2E tests — Location Autocomplete UI feature
 *
 * Covers:
 *   - Spinner shows while location search is loading (no hint text)
 *   - No "no matching places" text when search returns empty
 *   - Dropdown overlays content without shifting layout
 *   - Country column and city-name-only overnight after selecting resolved location
 */

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

const PARIS_RESOLVED_RESULT = {
  kind: 'resolved',
  label: 'Paris, Île-de-France, France',
  queryText: 'Paris',
  coordinates: { lat: 48.8566, lng: 2.3522 },
  place: {
    placeId: 'geonames:2988507',
    name: 'Paris',
    locality: 'Paris',
    region: 'Île-de-France',
    country: 'France',
    countryCode: 'FR',
    featureType: 'locality',
  },
}

test.describe('Location autocomplete UI', () => {
  test('spinner visible while loading, no hint text shown', async ({ page }) => {
    const user = makeTestUser('autocomplete-spinner')
    await injectSession(page, user)

    const createResponse = await page.request.post('/api/itineraries', {
      data: { name: `AC Spinner ${Date.now()}`, startDate: '2026-10-01' },
    })
    expect(createResponse.status()).toBe(201)
    const { workspaceUrl } = await createResponse.json()

    // Intercept location search and delay it
    await page.route('**/api/locations/search**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 800))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ query: 'Par', results: [] }),
      })
    })

    await page.goto(workspaceUrl)
    await page.getByRole('button', { name: 'Add first stay' }).click({ timeout: 15000 })
    await page.getByLabel('City').fill('Par')

    // Spinner should appear while fetch is delayed
    await expect(page.getByRole('status')).toBeVisible({ timeout: 5000 })

    // No visible hint text
    await expect(page.getByText(/searching for places/i)).not.toBeVisible()

    // Wait for fetch to complete; spinner disappears
    await expect(page.getByRole('status')).not.toBeVisible({ timeout: 3000 })
  })

  test('no "no matching places" text when search returns empty', async ({ page }) => {
    const user = makeTestUser('autocomplete-no-results')
    await injectSession(page, user)

    const createResponse = await page.request.post('/api/itineraries', {
      data: { name: `AC No Results ${Date.now()}`, startDate: '2026-10-01' },
    })
    expect(createResponse.status()).toBe(201)
    const { workspaceUrl } = await createResponse.json()

    await page.route('**/api/locations/search**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ query: 'xyz', results: [] }),
      })
    })

    await page.goto(workspaceUrl)
    await page.getByRole('button', { name: 'Add first stay' }).click({ timeout: 15000 })
    await page.getByLabel('City').fill('xyz')

    // Wait a moment for debounce + response
    await page.waitForTimeout(500)

    await expect(page.getByText(/no matching places/i)).not.toBeVisible()
  })

  test('dropdown overlays content without shifting Nights label position', async ({ page }) => {
    const user = makeTestUser('autocomplete-overlay')
    await injectSession(page, user)

    const createResponse = await page.request.post('/api/itineraries', {
      data: { name: `AC Overlay ${Date.now()}`, startDate: '2026-10-01' },
    })
    expect(createResponse.status()).toBe(201)
    const { workspaceUrl } = await createResponse.json()

    await page.route('**/api/locations/search**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ query: 'Par', results: [PARIS_RESOLVED_RESULT] }),
      })
    })

    await page.goto(workspaceUrl)
    await page.getByRole('button', { name: 'Add first stay' }).click({ timeout: 15000 })

    const nightsLabel = page.getByLabel('Nights')
    const boxBefore = await nightsLabel.boundingBox()

    await page.getByLabel('City').fill('Par')
    await expect(page.getByRole('listbox')).toBeVisible({ timeout: 3000 })

    // Dropdown should be absolutely positioned — Nights input must not shift
    const boxAfter = await nightsLabel.boundingBox()
    expect(boxAfter?.y).toBeCloseTo(boxBefore?.y ?? 0, 0)

    // Verify listbox has absolute positioning
    const listbox = page.getByRole('listbox')
    const position = await listbox.evaluate((el) => getComputedStyle(el).position)
    expect(position).toBe('absolute')
  })

  test('country column shows country and overnight shows city name after selecting resolved location', async ({ page }) => {
    test.slow()

    const user = makeTestUser('autocomplete-country-col')
    await injectSession(page, user)

    const createResponse = await page.request.post('/api/itineraries', {
      data: { name: `AC Country ${Date.now()}`, startDate: '2026-10-01' },
    })
    expect(createResponse.status()).toBe(201)
    const { workspaceUrl } = await createResponse.json()

    await page.route('**/api/locations/search**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ query: 'Paris', results: [PARIS_RESOLVED_RESULT] }),
      })
    })

    await page.goto(workspaceUrl)
    await page.getByRole('button', { name: 'Add first stay' }).click({ timeout: 15000 })
    await page.getByLabel('City').fill('Paris')

    // Select the resolved result from dropdown
    await expect(page.getByRole('listbox')).toBeVisible({ timeout: 3000 })
    await page.getByRole('option', { name: /paris, île-de-france, france/i }).click()

    await page.getByLabel('Nights').fill('2')
    await page.getByRole('button', { name: 'Create stay' }).click()

    const itineraryTab = page.getByTestId('itinerary-tab')
    await expect(itineraryTab).toBeVisible({ timeout: 15000 })

    // Country column header present
    await expect(itineraryTab.getByRole('columnheader', { name: /^country$/i })).toBeVisible()

    // Country cell shows "France"
    await expect(itineraryTab.getByText('France')).toBeVisible()

    // Overnight cell shows "Paris" only, not the full label
    await expect(itineraryTab.getByText('Paris')).toBeVisible()
    await expect(itineraryTab.getByText('Paris, Île-de-France, France')).not.toBeVisible()
  })
})
