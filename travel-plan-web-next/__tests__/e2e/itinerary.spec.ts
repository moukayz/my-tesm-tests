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

test.describe('Itinerary Tab', () => {
  test.beforeEach(async ({ page }) => {
    // Inject auth session
    await injectSession(page)

    // Reset day 0 to known e2e values via API
    const res = await page.request.post('/api/plan-update', {
      data: {
        dayIndex: 0,
        plan: { morning: 'e2e-morning', afternoon: 'e2e-afternoon', evening: 'e2e-evening' },
      },
    })
    expect(res.status()).toBe(200)

    // Navigate to home page
    await page.goto('/')
  })

  test('itinerary table renders with date "2026/9/25"', async ({ page }) => {
    await expect(page.getByText('2026/9/25')).toBeVisible()
  })

  test('plan section "e2e-morning" is visible', async ({ page }) => {
    await expect(page.getByText('e2e-morning')).toBeVisible()
  })

  test('all 16 days are shown (16 date cells matching date pattern)', async ({ page }) => {
    // Find all table cells (td) whose text matches a date pattern like YYYY/M/D
    const dateCells = page.locator('td').filter({ hasText: /^\d{4}\/\d+\/\d+$/ })
    await expect(dateCells).toHaveCount(16)
  })

  test('double-clicking the morning plan row of day 1 shows a textarea pre-filled with "e2e-morning"', async ({ page }) => {
    const morningRow = page.locator('[data-testid="plan-row-0-morning"]')
    await morningRow.dblclick()

    // A textarea should appear pre-filled with the current morning value
    const textarea = page.locator('textarea')
    await expect(textarea).toBeVisible()
    await expect(textarea).toHaveValue('e2e-morning')
  })

  test('editing the textarea and blurring saves the new value (verify new text appears in cell)', async ({ page }) => {
    const morningRow = page.locator('[data-testid="plan-row-0-morning"]')
    await morningRow.dblclick()

    const textarea = page.locator('textarea')
    await expect(textarea).toBeVisible()

    // Clear and type new value
    await textarea.fill('e2e-morning-edited')

    // Blur to trigger save
    await textarea.press('Tab')

    // Wait for textarea to disappear (edit mode ended)
    await expect(textarea).not.toBeVisible({ timeout: 5000 })

    // New value should appear in the cell
    await expect(page.getByText('e2e-morning-edited')).toBeVisible({ timeout: 10000 })
  })

  test('drag-dropping morning to evening within day 1 swaps the values', async ({ page }) => {
    // Verify initial state
    const morningRow = page.locator('[data-testid="plan-row-0-morning"]')
    const eveningRow = page.locator('[data-testid="plan-row-0-evening"]')

    await expect(morningRow.getByText('e2e-morning')).toBeVisible()
    await expect(eveningRow.getByText('e2e-evening')).toBeVisible()

    // Drag morning row to evening row
    await morningRow.dragTo(eveningRow)

    // After the drag, the values should be swapped:
    // Evening row should now contain what was in morning ("e2e-morning")
    await expect(eveningRow.getByText('e2e-morning')).toBeVisible({ timeout: 10000 })
    // Morning row should now contain what was in evening ("e2e-evening")
    await expect(morningRow.getByText('e2e-evening')).toBeVisible({ timeout: 10000 })
  })
})
