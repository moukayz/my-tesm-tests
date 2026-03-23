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

    // Reset day 0 to known e2e values via API
    const res = await page.request.post('/api/plan-update', {
      data: {
        dayIndex: 0,
        plan: { morning: 'e2e-morning', afternoon: 'e2e-afternoon', evening: 'e2e-evening' },
      },
    })
    expect(res.status()).toBe(200)

    await openStarterRouteTable(page)
  })

  // NOTE: Both ItineraryTab instances (tabKey='route' and tabKey='route-test') are always
  // mounted in the DOM (keep-alive pattern). Selectors are scoped to the PRIMARY panel
  // (data-testid="itinerary-tab") to avoid strict-mode violations from duplicate elements.

  test('itinerary table renders with date "2026/9/25"', async ({ page }) => {
    const panel = page.getByTestId('itinerary-tab')
    await expect(panel.getByText('2026/9/25')).toBeVisible()
  })

  test('plan section "e2e-morning" is visible', async ({ page }) => {
    const panel = page.getByTestId('itinerary-tab')
    await expect(panel.getByText('e2e-morning')).toBeVisible()
  })

  test('all 16 days are shown (16 date cells matching date pattern)', async ({ page }) => {
    // Scope to the primary panel to avoid counting cells from the hidden test-tab panel
    const panel = page.getByTestId('itinerary-tab')
    const dateCells = panel.locator('td').filter({ hasText: /^\d{4}\/\d+\/\d+$/ })
    await expect(dateCells).toHaveCount(16)
  })

  test('double-clicking the morning plan row of day 1 shows a textarea pre-filled with "e2e-morning"', async ({ page }) => {
    const panel = page.getByTestId('itinerary-tab')
    const morningRow = panel.locator('[data-testid="plan-row-0-morning"]')
    await morningRow.dblclick()

    // A textarea should appear pre-filled with the current morning value
    const textarea = panel.locator('textarea')
    await expect(textarea).toBeVisible()
    await expect(textarea).toHaveValue('e2e-morning')
  })

  test('editing the textarea and blurring saves the new value (verify new text appears in cell)', async ({ page }) => {
    const panel = page.getByTestId('itinerary-tab')
    const morningRow = panel.locator('[data-testid="plan-row-0-morning"]')
    await morningRow.dblclick()

    const textarea = panel.locator('textarea')
    await expect(textarea).toBeVisible()

    // Clear and type new value
    await textarea.fill('e2e-morning-edited')

    // Blur to trigger save
    await textarea.press('Tab')

    // Wait for textarea to disappear (edit mode ended)
    await expect(textarea).not.toBeVisible({ timeout: 5000 })

    // New value should appear in the cell
    await expect(panel.getByText('e2e-morning-edited')).toBeVisible({ timeout: 10000 })
  })

  test('drag-dropping morning to evening within day 1 swaps the values', async ({ page }) => {
    const panel = page.getByTestId('itinerary-tab')
    // Verify initial state
    const morningRow = panel.locator('[data-testid="plan-row-0-morning"]')
    const eveningRow = panel.locator('[data-testid="plan-row-0-evening"]')

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
