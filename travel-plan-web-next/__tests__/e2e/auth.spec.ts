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

test.describe('Authentication (Google OAuth)', () => {
  test('login icon visible top-right when logged out', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('link', { name: /login/i })).toBeVisible()
  })

  test('Itinerary tab NOT visible when logged out', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: /^itinerary$/i })).not.toBeVisible()
  })

  test('login page renders "Sign in with Google" button', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('button', { name: /sign in with google/i })).toBeVisible()
  })

  test('login page has no username or password fields', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByLabel(/username/i)).not.toBeVisible()
    await expect(page.getByLabel(/password/i)).not.toBeVisible()
  })

  test('POST /api/plan-update returns 401 without auth', async ({ request }) => {
    const res = await request.post('/api/plan-update', {
      data: { dayIndex: 0, plan: { morning: 'a', afternoon: 'b', evening: 'c' } },
    })
    expect(res.status()).toBe(401)
  })

  test('with injected session: Itinerary tab visible', async ({ page }) => {
    await injectSession(page)
    await page.goto('/')
    await expect(page.getByRole('button', { name: /^itinerary$/i })).toBeVisible()
  })

  test('with injected session: logout button visible', async ({ page }) => {
    await injectSession(page)
    await page.goto('/')
    await expect(page.getByRole('button', { name: /logout/i })).toBeVisible()
  })

  test('with injected session: user name shown in header', async ({ page }) => {
    await injectSession(page, { email: 'test@gmail.com', name: 'Test User' })
    await page.goto('/')
    await expect(page.getByText('Test User')).toBeVisible()
  })

  test('with injected session: POST /api/plan-update returns 200', async ({ page }) => {
    await injectSession(page)
    await page.goto('/')
    const res = await page.request.post('/api/plan-update', {
      data: { dayIndex: 0, plan: { morning: 'e2e-morning', afternoon: 'e2e-afternoon', evening: 'e2e-evening' } },
    })
    expect(res.status()).toBe(200)
  })
})

test.describe('Auth Error Page', () => {
  test('shows Access Denied heading on /auth-error', async ({ page }) => {
    await page.goto('/auth-error?error=AccessDenied')
    await expect(page.getByRole('heading', { name: /access denied/i })).toBeVisible()
  })

  test('shows "not authorized" message on /auth-error', async ({ page }) => {
    await page.goto('/auth-error?error=AccessDenied')
    await expect(page.getByText(/not authorized/i)).toBeVisible()
  })

  test('shows countdown text on /auth-error', async ({ page }) => {
    await page.goto('/auth-error?error=AccessDenied')
    await expect(page.getByText(/\d+ second/i)).toBeVisible()
  })

  test('redirects to home after 5 seconds from /auth-error', async ({ page }) => {
    await page.goto('/auth-error?error=AccessDenied')
    await page.waitForURL('/', { timeout: 8000 })
    expect(page.url()).toMatch(/localhost:\d+\/$/)
  })
})
