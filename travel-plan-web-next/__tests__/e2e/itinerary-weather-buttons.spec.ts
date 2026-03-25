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

const parisLocation = {
  kind: 'resolved',
  label: 'Paris',
  queryText: 'Paris',
  coordinates: { lat: 48.8566, lng: 2.3522 },
  place: {
    placeId: 'geonames:2988507',
    name: 'Paris',
    region: 'Ile-de-France',
    country: 'France',
    countryCode: 'FR',
    featureType: 'locality',
  },
}

test.describe('Itinerary - Weather buttons in overnight cell', () => {
  test('weather forecast button opens 5-day weather modal with real data', async ({ page }) => {
    test.slow()

    const user = makeTestUser('weather-btn')
    await injectSession(page, user)

    const createRes = await page.request.post('/api/itineraries', {
      data: { name: `Weather Test ${Date.now()}`, startDate: '2026-03-25' },
    })
    expect(createRes.status()).toBe(201)
    const { itinerary } = await createRes.json()

    const stayRes = await page.request.post(`/api/itineraries/${itinerary.id}/stays`, {
      data: { nights: 2, location: parisLocation },
    })
    expect(stayRes.status()).toBe(200)

    await page.goto(`/?tab=itinerary&itineraryId=${itinerary.id}`)
    await expect(page.getByTestId('itinerary-tab')).toBeVisible()

    const weatherBtn = page.getByRole('button', { name: /weather forecast for Paris/i })
    await weatherBtn.focus()
    await weatherBtn.click()

    // Modal header appears immediately
    await expect(page.getByText('5-Day Weather Forecast')).toBeVisible()
    await expect(page.getByText('Paris').first()).toBeVisible()

    // Wait for real Open-Meteo response — spinner disappears, day grid renders with descriptions
    await expect(page.getByRole('status')).not.toBeVisible({ timeout: 15000 })
    // Per-day grid shows temperature values (red max temp spans)
    await expect(page.locator('.text-red-500').first()).toBeVisible()
  })

  test('cloud forecast button opens 12h cloud modal with real data', async ({ page }) => {
    test.slow()

    const user = makeTestUser('cloud-btn')
    await injectSession(page, user)

    const createRes = await page.request.post('/api/itineraries', {
      data: { name: `Cloud Test ${Date.now()}`, startDate: '2026-03-25' },
    })
    expect(createRes.status()).toBe(201)
    const { itinerary } = await createRes.json()

    const stayRes = await page.request.post(`/api/itineraries/${itinerary.id}/stays`, {
      data: { nights: 2, location: parisLocation },
    })
    expect(stayRes.status()).toBe(200)

    await page.goto(`/?tab=itinerary&itineraryId=${itinerary.id}`)
    await expect(page.getByTestId('itinerary-tab')).toBeVisible()

    const cloudBtn = page.getByRole('button', { name: /cloud forecast for Paris/i })
    await cloudBtn.focus()
    await cloudBtn.click()

    await expect(page.getByText('12-Hour Cloud Forecast')).toBeVisible()
    await expect(page.getByText('Paris').first()).toBeVisible()

    // Wait for real Open-Meteo response — spinner disappears, chart axis labels render
    await expect(page.getByRole('status')).not.toBeVisible({ timeout: 15000 })
    await expect(page.locator('text=/Cloud Cover/')).toBeVisible()
  })

  test('weather modal closes when close button is clicked', async ({ page }) => {
    test.slow()

    const user = makeTestUser('weather-close')
    await injectSession(page, user)

    const createRes = await page.request.post('/api/itineraries', {
      data: { name: `Weather Close Test ${Date.now()}`, startDate: '2026-03-25' },
    })
    expect(createRes.status()).toBe(201)
    const { itinerary } = await createRes.json()

    await page.request.post(`/api/itineraries/${itinerary.id}/stays`, {
      data: { nights: 2, location: parisLocation },
    })

    await page.goto(`/?tab=itinerary&itineraryId=${itinerary.id}`)
    await expect(page.getByTestId('itinerary-tab')).toBeVisible()

    const weatherBtn = page.getByRole('button', { name: /weather forecast for Paris/i })
    await weatherBtn.focus()
    await weatherBtn.click()

    await expect(page.getByText('5-Day Weather Forecast')).toBeVisible()

    await page.getByRole('button', { name: /close weather forecast modal/i }).click()
    await expect(page.getByText('5-Day Weather Forecast')).not.toBeVisible()
  })

  test('weather and cloud buttons are disabled for overnight city without coordinates', async ({ page }) => {
    test.slow()

    const user = makeTestUser('weather-disabled')
    await injectSession(page, user)

    const createRes = await page.request.post('/api/itineraries', {
      data: { name: `Weather Disabled Test ${Date.now()}`, startDate: '2026-03-25' },
    })
    expect(createRes.status()).toBe(201)
    const { itinerary } = await createRes.json()

    await page.request.post(`/api/itineraries/${itinerary.id}/stays`, {
      data: { city: 'UnknownCity', nights: 2 },
    })

    await page.goto(`/?tab=itinerary&itineraryId=${itinerary.id}`)
    await expect(page.getByTestId('itinerary-tab')).toBeVisible()

    const weatherBtn = page.getByRole('button', { name: /weather forecast for UnknownCity/i })
    const cloudBtn = page.getByRole('button', { name: /cloud forecast for UnknownCity/i })

    await expect(weatherBtn).toBeDisabled()
    await expect(cloudBtn).toBeDisabled()
  })
})
