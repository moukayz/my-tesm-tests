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
  const primaryPanel = page.getByTestId('itinerary-tab')
  await expect(primaryPanel.getByRole('columnheader', { name: /^date$/i })).toBeVisible()
}

test.describe.configure({ mode: 'serial' })

test.describe('Train Schedule Editor', () => {
  const DAY_WITH_TRAIN = 1
  const RESET_TRAIN_JSON = '[{"train_id":"TGV 456"}]'

  async function setDayTrain(page: import('@playwright/test').Page, trainJson: string) {
    await page.request.post('/api/train-update', {
      data: {
        dayIndex: DAY_WITH_TRAIN,
        trainJson,
      },
    })
  }

  async function resetDayTrain(page: import('@playwright/test').Page) {
    await setDayTrain(page, RESET_TRAIN_JSON)
  }

  test.beforeEach(async ({ page }) => {
    await injectSession(page)
    await resetDayTrain(page)
    await openStarterRouteTable(page)
  })

  test.afterEach(async ({ page }) => {
    await injectSession(page)
    await resetDayTrain(page)
  })

  test('pencil button is visible for a day that has train data', async ({ page }) => {
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

  test('editor shows structured fields for existing row', async ({ page }) => {
    const primaryPanel = page.getByTestId('itinerary-tab')
    await primaryPanel.locator(`[data-testid="train-json-edit-btn-${DAY_WITH_TRAIN}"]`).click()

    await expect(page.getByLabel(/train id for row 1/i)).toHaveValue('TGV 456')
    await expect(page.getByLabel(/start station for row 1/i)).toHaveValue('')
    await expect(page.getByLabel(/end station for row 1/i)).toHaveValue('')
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

    await page.getByLabel(/train id for row 1/i).fill('ICE 999')
    await page.locator('[data-testid="train-editor-save"]').click()

    await expect(page.locator('[data-testid="train-editor-save-error"]')).toContainText('Failed to save')
    await expect(page.locator('[data-testid="train-schedule-editor-modal"]')).toBeVisible()
    await expect(page.getByLabel(/train id for row 1/i)).toHaveValue('ICE 999')
    await page.unroute('**/api/train-update')
  })

  test('rows reorder by drag-and-drop and keep row-end delete only', async ({ page }) => {
    const twoRowsJson = JSON.stringify([
      { train_id: 'ICE 111', start: 'Berlin', end: 'Munich' },
      { train_id: 'ICE 222', start: 'Paris', end: 'Lyon' },
    ])
    await setDayTrain(page, twoRowsJson)
    await page.reload()

    const primaryPanel = page.getByTestId('itinerary-tab')
    await primaryPanel.locator(`[data-testid="train-json-edit-btn-${DAY_WITH_TRAIN}"]`).click()

    await expect(page.locator('[data-testid="train-editor-move-up-1"]')).toHaveCount(0)
    await expect(page.locator('[data-testid="train-editor-move-down-1"]')).toHaveCount(0)
    await expect(page.getByTestId('train-editor-delete-1')).toBeVisible()

    const firstRow = page.getByTestId('train-editor-row-1')
    const secondRow = page.getByTestId('train-editor-row-2')
    await secondRow.dragTo(firstRow)
    await page.getByTestId('train-editor-save').click()

    await expect(page.locator('[data-testid="train-schedule-editor-modal"]')).not.toBeVisible({ timeout: 10000 })

    await primaryPanel.locator(`[data-testid="train-json-edit-btn-${DAY_WITH_TRAIN}"]`).click()
    await expect(page.getByLabel(/train id for row 1/i)).toHaveValue('ICE 222')
  })
})
