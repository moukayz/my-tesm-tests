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

test.describe('Itinerary cards navigation', () => {
  test('cards-first entry supports starter route and saved itinerary details', async ({ page }) => {
    const idSuffix = Date.now()
    const firstName = `Cards Nav A ${idSuffix}`
    const secondName = `Cards Nav B ${idSuffix}`

    await injectSession(page, makeTestUser('cards-nav'))

    const firstCreate = await page.request.post('/api/itineraries', {
      data: { name: firstName, startDate: '2026-10-01' },
    })
    expect(firstCreate.status()).toBe(201)

    const secondCreate = await page.request.post('/api/itineraries', {
      data: { name: secondName, startDate: '2026-10-02' },
    })
    expect(secondCreate.status()).toBe(201)

    const firstBody = await firstCreate.json()
    const firstItineraryId = firstBody.itinerary.id as string

    await page.goto('/?tab=itinerary')

    await expect(page).toHaveURL(/\?tab=itinerary$/)
    await expect(page.getByRole('button', { name: /Open itinerary Original seeded route/i })).toBeVisible()
    await expect(page.getByRole('button', { name: new RegExp(`Open itinerary ${firstName}`) })).toBeVisible()
    await expect(page.getByRole('button', { name: new RegExp(`Open itinerary ${secondName}`) })).toBeVisible()

    await page.getByRole('button', { name: /Open itinerary Original seeded route/i }).click()
    await expect(page).toHaveURL(/\?tab=itinerary&legacyTabKey=route$/)
    await expect(page.getByRole('button', { name: 'Back to all itineraries' })).toBeVisible()

    await page.getByRole('button', { name: 'Back to all itineraries' }).click()
    await expect(page).toHaveURL(/\?tab=itinerary$/)
    await expect(page.getByRole('button', { name: /Open itinerary Original seeded route/i })).toBeVisible()

    await page.getByRole('button', { name: new RegExp(`Open itinerary ${firstName}`) }).click()
    await expect(page).toHaveURL(new RegExp(`\\?tab=itinerary&itineraryId=${firstItineraryId}`))
    await expect(page.getByRole('button', { name: 'Back to all itineraries' })).toBeVisible()

    await page.getByRole('button', { name: 'Back to all itineraries' }).click()
    await expect(page).toHaveURL(/\?tab=itinerary$/)
    await expect(page.getByRole('button', { name: new RegExp(`Open itinerary ${firstName}`) })).toBeVisible()
  })
})
