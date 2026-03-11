import { test, expect } from '@playwright/test'
import { encode } from 'next-auth/jwt'

const AUTH_SECRET = process.env.AUTH_SECRET || 'test-auth-secret-32chars!!!!!!!!'
const COOKIE_NAME = 'authjs.session-token'

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

test.describe('Navigation and Tab Visibility', () => {
  test('renders "Travel Plan Itinerary" heading on home page', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /travel plan itinerary/i })).toBeVisible()
  })

  test('shows "Train Delays" tab button when logged out', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: /^train delays$/i })).toBeVisible()
  })

  test('shows "Timetable" tab button when logged out', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: /^timetable$/i })).toBeVisible()
  })

  test('does NOT show "Itinerary" tab button when logged out', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: /^itinerary$/i })).not.toBeVisible()
  })

  test('"Train Delays" tab is active by default when logged out (station input is present in DOM)', async ({ page }) => {
    await page.goto('/')
    // Station input is present when the Train Delays tab is active
    await expect(page.getByPlaceholder('Type to search station')).toBeVisible()
  })

  test('clicking "Timetable" tab switches to timetable view (timetable train input becomes visible)', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /^timetable$/i }).click()
    // After switching to Timetable tab, the timetable train autocomplete input should be visible
    // The Timetable tab has an input with the same placeholder as Train Delays but distinct context
    await expect(page.getByPlaceholder('Type to search, e.g. ICE 905').last()).toBeVisible()
  })

  test('logged in: "Itinerary" tab button is visible', async ({ page }) => {
    await injectSession(page)
    await page.goto('/')
    await expect(page.getByRole('button', { name: /^itinerary$/i })).toBeVisible()
  })

  test('logged in: "Itinerary" tab is active by default (itinerary table header "Date" is visible)', async ({ page }) => {
    await injectSession(page)
    await page.goto('/')
    await expect(page.getByRole('columnheader', { name: /^date$/i })).toBeVisible()
  })
})
