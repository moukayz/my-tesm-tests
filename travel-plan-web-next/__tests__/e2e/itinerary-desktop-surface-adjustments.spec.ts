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

test.describe('Itinerary desktop surface adjustments', () => {
  test('desktop cards rail, wider detail rail stay intact', async ({ page }) => {
    test.slow()

    await page.setViewportSize({ width: 1440, height: 1200 })

    const itineraryName = `Desktop Surface ${Date.now()}`

    await injectSession(page, makeTestUser('desktop-surface'))

    const createResponse = await page.request.post('/api/itineraries', {
      data: { name: itineraryName, startDate: '2026-10-01' },
    })
    expect(createResponse.status()).toBe(201)

    const createBody = await createResponse.json()
    const itineraryId = createBody.itinerary.id as string

    const stayResponse = await page.request.post(`/api/itineraries/${itineraryId}/stays`, {
      data: { city: 'Paris', nights: 3 },
    })
    expect(stayResponse.status()).toBe(200)

    await page.goto('/?tab=itinerary')

    const cardsRail = page.getByTestId('itinerary-cards-rail')
    const savedCard = page.getByTestId(`itinerary-card-${itineraryId}`)

    await expect(cardsRail).toBeVisible()
    await expect(savedCard).toBeVisible()

    const cardsRailBox = await cardsRail.boundingBox()
    const savedCardBox = await savedCard.boundingBox()

    expect(cardsRailBox).not.toBeNull()
    expect(savedCardBox).not.toBeNull()

    expect(Math.abs((savedCardBox?.x ?? 0) - (cardsRailBox?.x ?? 0))).toBeLessThanOrEqual(1)
    expect(savedCardBox?.width ?? 0).toBeGreaterThanOrEqual(900)

    await page.getByRole('button', { name: new RegExp(`Open itinerary ${itineraryName}`) }).click()
    await expect(page).toHaveURL(`/?tab=itinerary&itineraryId=${itineraryId}`)
    await expect(page.getByRole('button', { name: 'Back to all itineraries' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add next stay' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Edit stay for Paris/i })).toBeVisible()

    const detailShellBox = await page.getByTestId('itinerary-detail-shell').boundingBox()

    expect(detailShellBox).not.toBeNull()
    expect(detailShellBox?.width ?? 0).toBeGreaterThanOrEqual(900)

    await page.goto(`/?tab=itinerary&itineraryId=${itineraryId}`)
    await page.getByRole('button', { name: 'Back to all itineraries' }).click()
    await expect(page).toHaveURL(/\?tab=itinerary$/)
  })
})
