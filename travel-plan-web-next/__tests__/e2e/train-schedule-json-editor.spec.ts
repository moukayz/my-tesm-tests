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

test.describe.configure({ mode: 'serial' })

test.describe('Train Schedule Editor', () => {
  const DAY_WITH_TRAIN = 1
  let itineraryId: string

  test.beforeEach(async ({ page }) => {
    const user = makeTestUser('train-editor')
    await injectSession(page, user)

    // Create a fresh itinerary with 2 stays (so DAY_WITH_TRAIN=1 exists)
    const createRes = await page.request.post('/api/itineraries', {
      data: { name: `Train Editor E2E ${Date.now()}`, startDate: '2026-09-25' },
    })
    expect(createRes.status()).toBe(201)
    const body = await createRes.json()
    itineraryId = body.itinerary.id

    await page.request.post(`/api/itineraries/${itineraryId}/stays`, {
      data: { city: 'Paris', nights: 3 },
    })
    await page.request.post(`/api/itineraries/${itineraryId}/stays`, {
      data: { city: 'Rome', nights: 2 },
    })

    await page.goto(`/?tab=itinerary&itineraryId=${itineraryId}`)
    const panel = page.getByTestId('itinerary-tab')
    await expect(panel.getByRole('columnheader', { name: /^date$/i })).toBeVisible()
  })

  test('pencil button is visible for any day in the itinerary table', async ({ page }) => {
    const primaryPanel = page.getByTestId('itinerary-tab')
    const editBtn = primaryPanel.locator(`[data-testid="train-json-edit-btn-${DAY_WITH_TRAIN}"]`)
    await expect(editBtn).toBeVisible()
  })

  test('editor dialog opens on pencil button click', async ({ page }) => {
    const primaryPanel = page.getByTestId('itinerary-tab')
    await expect(page.locator('[data-testid="train-schedule-editor-modal"]')).not.toBeVisible()

    await primaryPanel.locator(`[data-testid="train-json-edit-btn-${DAY_WITH_TRAIN}"]`).click()

    await expect(page.locator('[data-testid="train-schedule-editor-modal"]')).toBeVisible()
    await expect(page.getByRole('dialog', { name: /edit train schedule/i })).toBeVisible()
  })

  test('editor opens with no rows for a day with no train data', async ({ page }) => {
    const primaryPanel = page.getByTestId('itinerary-tab')
    await primaryPanel.locator(`[data-testid="train-json-edit-btn-${DAY_WITH_TRAIN}"]`).click()

    // No row fields visible initially (day has no trains)
    await expect(page.getByLabel(/train id for row 1/i)).not.toBeVisible()
  })

  test('add row and validation errors are shown before save', async ({ page }) => {
    const primaryPanel = page.getByTestId('itinerary-tab')
    await primaryPanel.locator(`[data-testid="train-json-edit-btn-${DAY_WITH_TRAIN}"]`).click()

    await page.getByTestId('train-editor-add-row').click()
    await page.getByTestId('train-editor-save').click()

    await expect(page.getByText('Train ID is required.')).toBeVisible()
  })

  test('cancel button closes editor without saving', async ({ page }) => {
    const primaryPanel = page.getByTestId('itinerary-tab')
    await primaryPanel.locator(`[data-testid="train-json-edit-btn-${DAY_WITH_TRAIN}"]`).click()
    await expect(page.locator('[data-testid="train-schedule-editor-modal"]')).toBeVisible()

    await page.locator('[data-testid="train-editor-cancel"]').click()

    await expect(page.locator('[data-testid="train-schedule-editor-modal"]')).not.toBeVisible()
  })

  test('escape key closes editor', async ({ page }) => {
    const primaryPanel = page.getByTestId('itinerary-tab')
    await primaryPanel.locator(`[data-testid="train-json-edit-btn-${DAY_WITH_TRAIN}"]`).click()
    await expect(page.locator('[data-testid="train-schedule-editor-modal"]')).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.locator('[data-testid="train-schedule-editor-modal"]')).not.toBeVisible()
  })

  test('valid edit saves and closes editor', async ({ page }) => {
    const primaryPanel = page.getByTestId('itinerary-tab')
    await primaryPanel.locator(`[data-testid="train-json-edit-btn-${DAY_WITH_TRAIN}"]`).click()
    await expect(page.locator('[data-testid="train-schedule-editor-modal"]')).toBeVisible()

    await page.getByTestId('train-editor-add-row').click()
    await page.getByLabel(/train id for row 1/i).fill('ICE 777')
    await page.getByLabel(/start station for row 1/i).fill('Berlin')
    await page.getByLabel(/end station for row 1/i).fill('Munich')
    await page.locator('[data-testid="train-editor-save"]').click()

    await expect(page.locator('[data-testid="train-schedule-editor-modal"]')).not.toBeVisible({ timeout: 10000 })
    await expect(primaryPanel.getByText('ICE 777')).toBeVisible()
  })

  test('server-side save error keeps editor open', async ({ page }) => {
    const primaryPanel = page.getByTestId('itinerary-tab')
    await primaryPanel.locator(`[data-testid="train-json-edit-btn-${DAY_WITH_TRAIN}"]`).click()
    await expect(page.locator('[data-testid="train-schedule-editor-modal"]')).toBeVisible()

    await page.route('**/api/train-update', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Failed to save' }),
      })
    })

    await page.getByTestId('train-editor-add-row').click()
    await page.getByLabel(/train id for row 1/i).fill('ICE 999')
    await page.locator('[data-testid="train-editor-save"]').click()

    await expect(page.locator('[data-testid="train-editor-save-error"]')).toContainText('Failed to save')
    await expect(page.locator('[data-testid="train-schedule-editor-modal"]')).toBeVisible()
    await expect(page.getByLabel(/train id for row 1/i)).toHaveValue('ICE 999')
    await page.unroute('**/api/train-update')
  })

  test('rows reorder by drag-and-drop and keep row-end delete only', async ({ page }) => {
    const primaryPanel = page.getByTestId('itinerary-tab')

    // Open editor and add two rows via the UI
    await primaryPanel.locator(`[data-testid="train-json-edit-btn-${DAY_WITH_TRAIN}"]`).click()

    await page.getByTestId('train-editor-add-row').click()
    await page.getByLabel(/train id for row 1/i).fill('ICE 111')
    await page.getByLabel(/start station for row 1/i).fill('Berlin')
    await page.getByLabel(/end station for row 1/i).fill('Munich')

    await page.getByTestId('train-editor-add-row').click()
    await page.getByLabel(/train id for row 2/i).fill('ICE 222')
    await page.getByLabel(/start station for row 2/i).fill('Paris')
    await page.getByLabel(/end station for row 2/i).fill('Lyon')

    await page.getByTestId('train-editor-save').click()
    await expect(page.locator('[data-testid="train-schedule-editor-modal"]')).not.toBeVisible({ timeout: 10000 })

    // Reopen editor and verify no move-up button (drag only)
    await primaryPanel.locator(`[data-testid="train-json-edit-btn-${DAY_WITH_TRAIN}"]`).click()

    await expect(page.locator('[data-testid="train-editor-move-up-1"]')).toHaveCount(0)
    await expect(page.locator('[data-testid="train-editor-move-down-1"]')).toHaveCount(0)
    await expect(page.getByTestId('train-editor-delete-1')).toBeVisible()

    // Drag row 2 onto row 1
    const firstRow = page.getByTestId('train-editor-row-1')
    const secondRow = page.getByTestId('train-editor-row-2')
    await secondRow.dragTo(firstRow)
    await page.getByTestId('train-editor-save').click()

    await expect(page.locator('[data-testid="train-schedule-editor-modal"]')).not.toBeVisible({ timeout: 10000 })

    // Reopen and verify order swapped
    await primaryPanel.locator(`[data-testid="train-json-edit-btn-${DAY_WITH_TRAIN}"]`).click()
    await expect(page.getByLabel(/train id for row 1/i)).toHaveValue('ICE 222')
  })
})
