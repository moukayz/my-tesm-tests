import { test, expect } from '@playwright/test'

const USERNAME = process.env.AUTH_USERNAME || 'testuser'
const PASSWORD = process.env.AUTH_PASSWORD || 'testpass'

test.describe('Authentication', () => {
  test('login icon visible top-right when logged out', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('link', { name: /login/i })).toBeVisible()
  })

  test('Itinerary tab NOT visible when logged out', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: /^itinerary$/i })).not.toBeVisible()
  })

  test('login page renders fields at /login', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByLabel(/username/i)).toBeVisible()
    await expect(page.getByLabel(/password/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
  })

  test('wrong credentials shows error', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel(/username/i).fill('wronguser')
    await page.getByLabel(/password/i).fill('wrongpass')
    await page.getByRole('button', { name: /sign in/i }).click()
    await expect(page.getByText(/invalid credentials/i)).toBeVisible()
  })

  test('correct credentials redirect to / with Itinerary tab visible', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel(/username/i).fill(USERNAME)
    await page.getByLabel(/password/i).fill(PASSWORD)
    await page.getByRole('button', { name: /sign in/i }).click()
    await page.waitForURL('/')
    await expect(page.getByRole('button', { name: /^itinerary$/i })).toBeVisible()
  })

  test('after login, logout button appears', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel(/username/i).fill(USERNAME)
    await page.getByLabel(/password/i).fill(PASSWORD)
    await page.getByRole('button', { name: /sign in/i }).click()
    await page.waitForURL('/')
    await expect(page.getByRole('button', { name: /logout/i })).toBeVisible()
  })

  test('clicking logout hides Itinerary tab and shows login icon', async ({ page }) => {
    // Login first
    await page.goto('/login')
    await page.getByLabel(/username/i).fill(USERNAME)
    await page.getByLabel(/password/i).fill(PASSWORD)
    await page.getByRole('button', { name: /sign in/i }).click()
    await page.waitForURL('/')

    // Logout
    await page.getByRole('button', { name: /logout/i }).click()
    await page.waitForURL('/')

    await expect(page.getByRole('link', { name: /login/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /^itinerary$/i })).not.toBeVisible()
  })

  test('POST /api/plan-update returns 401 without auth', async ({ request }) => {
    const res = await request.post('/api/plan-update', {
      data: { dayIndex: 0, plan: { morning: 'a', afternoon: 'b', evening: 'c' } },
    })
    expect(res.status()).toBe(401)
  })
})
