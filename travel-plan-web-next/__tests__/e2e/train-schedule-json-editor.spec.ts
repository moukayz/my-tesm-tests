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

test.describe('Train Schedule JSON Editor', () => {
  // Day index 1 has train data: [{ "train_id": "Paris ↔ Versailles（往返）" }]
  const DAY_WITH_TRAIN = 1

  test.beforeEach(async ({ page }) => {
    await injectSession(page)
    await page.goto('/')
    // Ensure the itinerary table is visible (Itinerary tab is default when logged in)
    await expect(page.getByRole('columnheader', { name: /^date$/i })).toBeVisible()
  })

  test('pencil button is visible for a day that has train data', async ({ page }) => {
    const editBtn = page.locator(`[data-testid="train-json-edit-btn-${DAY_WITH_TRAIN}"]`)
    await expect(editBtn).toBeVisible()
  })

  test('modal opens on pencil button click', async ({ page }) => {
    // Modal should not be visible initially
    await expect(page.locator('[data-testid="train-json-modal"]')).not.toBeVisible()

    // Click pencil button
    await page.locator(`[data-testid="train-json-edit-btn-${DAY_WITH_TRAIN}"]`).click()

    // Modal should now be visible
    await expect(page.locator('[data-testid="train-json-modal"]')).toBeVisible()
  })

  test('modal textarea contains valid JSON of train data', async ({ page }) => {
    await page.locator(`[data-testid="train-json-edit-btn-${DAY_WITH_TRAIN}"]`).click()

    const textarea = page.locator('[data-testid="train-json-content"]')
    await expect(textarea).toBeVisible()

    const value = await textarea.inputValue()
    expect(value.length).toBeGreaterThan(0)

    // Should be valid JSON
    const parsed = JSON.parse(value)
    expect(Array.isArray(parsed)).toBe(true)
    // The train data for day 1 has at least one entry with train_id
    expect(parsed.length).toBeGreaterThan(0)
    expect(parsed[0]).toHaveProperty('train_id')
  })

  test('textarea is editable — user can clear and type new content', async ({ page }) => {
    await page.locator(`[data-testid="train-json-edit-btn-${DAY_WITH_TRAIN}"]`).click()

    const textarea = page.locator('[data-testid="train-json-content"]')
    await expect(textarea).toBeVisible()

    // Clear and type new content
    await textarea.fill('new content here')
    await expect(textarea).toHaveValue('new content here')
  })

  test('cancel button closes modal without saving', async ({ page }) => {
    await page.locator(`[data-testid="train-json-edit-btn-${DAY_WITH_TRAIN}"]`).click()
    await expect(page.locator('[data-testid="train-json-modal"]')).toBeVisible()

    // Click Cancel
    await page.locator('[data-testid="train-json-close"]').click()

    // Modal should be dismissed
    await expect(page.locator('[data-testid="train-json-modal"]')).not.toBeVisible()
  })

  test('escape key closes modal', async ({ page }) => {
    await page.locator(`[data-testid="train-json-edit-btn-${DAY_WITH_TRAIN}"]`).click()
    await expect(page.locator('[data-testid="train-json-modal"]')).toBeVisible()

    // Press Escape
    await page.keyboard.press('Escape')

    // Modal should be dismissed
    await expect(page.locator('[data-testid="train-json-modal"]')).not.toBeVisible()
  })

  test('valid edit saves and closes modal — no error shown', async ({ page }) => {
    await page.locator(`[data-testid="train-json-edit-btn-${DAY_WITH_TRAIN}"]`).click()
    await expect(page.locator('[data-testid="train-json-modal"]')).toBeVisible()

    const textarea = page.locator('[data-testid="train-json-content"]')

    // Replace with a valid train array containing required train_id field
    await textarea.fill('[{"train_id": "TEST-E2E-001"}]')

    // Click Save
    await page.locator('[data-testid="train-json-save"]').click()

    // Modal should close (save succeeded)
    await expect(page.locator('[data-testid="train-json-modal"]')).not.toBeVisible({ timeout: 10000 })

    // No error should be shown (modal is gone, so error element shouldn't exist)
    await expect(page.locator('[data-testid="train-json-error"]')).not.toBeVisible()
  })

  test('invalid JSON shows error message on save', async ({ page }) => {
    await page.locator(`[data-testid="train-json-edit-btn-${DAY_WITH_TRAIN}"]`).click()
    await expect(page.locator('[data-testid="train-json-modal"]')).toBeVisible()

    const textarea = page.locator('[data-testid="train-json-content"]')

    // Type invalid JSON
    await textarea.fill('not valid json')

    // Click Save
    await page.locator('[data-testid="train-json-save"]').click()

    // Error message should appear
    await expect(page.locator('[data-testid="train-json-error"]')).toBeVisible({ timeout: 10000 })
    const errorText = await page.locator('[data-testid="train-json-error"]').textContent()
    expect(errorText!.length).toBeGreaterThan(0)
  })
})
