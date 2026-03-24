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

async function openStarterRouteTable(page: import('@playwright/test').Page) {
  await page.goto('/?tab=itinerary')
  await expect(page.getByTestId('itinerary-cards-rail')).toBeVisible()
  await page.getByTestId('itinerary-card-starter-route').click()
  const panel = page.getByTestId('itinerary-tab')
  await expect(panel.getByRole('columnheader', { name: /^date$/i })).toBeVisible()
}

test.describe('Itinerary Tab', () => {
  test.beforeEach(async ({ page }) => {
    // Inject auth session
    await injectSession(page)

    // Reset day 0 note to a known e2e value via API
    const res = await page.request.post('/api/note-update', {
      data: { dayIndex: 0, note: 'e2e-note' },
    })
    expect(res.status()).toBe(200)

    await openStarterRouteTable(page)
  })

  test('itinerary table renders with date "2026/9/25"', async ({ page }) => {
    const panel = page.getByTestId('itinerary-tab')
    await expect(panel.getByText('2026/9/25')).toBeVisible()
  })

  test('Note column header is visible', async ({ page }) => {
    const panel = page.getByTestId('itinerary-tab')
    await expect(panel.getByRole('columnheader', { name: /^note$/i })).toBeVisible()
  })

  test('all 16 days are shown (16 date cells matching date pattern)', async ({ page }) => {
    const panel = page.getByTestId('itinerary-tab')
    const dateCells = panel.locator('td').filter({ hasText: /^\d{4}\/\d+\/\d+$/ })
    await expect(dateCells).toHaveCount(16)
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
