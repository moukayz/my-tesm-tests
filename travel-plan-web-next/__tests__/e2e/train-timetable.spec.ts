/**
 * E2E tests for the Timetable tab — queries real parquet files via the running Next.js server.
 *
 * Anchored to known real data (timestamps stored as UTC in Neon/local Postgres):
 *   train: ICE 905
 *   latest ride date: 2026-02-09
 *   route: Bitterfeld (arr 00:37 / dep 00:39 UTC) → ... → München Hbf (arr 07:14 UTC)
 *   total stops: 15
 */
import { test, expect, type Page } from '@playwright/test'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function openTimetableTab(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Timetable' }).click()
}

async function selectTrain(page: Page, trainName: string) {
  const trainInput = page.getByRole('textbox', { name: /train/i })
  await trainInput.fill(trainName)
  const option = page.getByRole('listitem').filter({ hasText: trainName }).first()
  await option.waitFor({ state: 'visible' })
  await option.click()
}

async function getTimetableContainer(page: Page) {
  const header = page.getByRole('heading', { name: 'Planned Timetable' })
  await expect(header).toBeVisible({ timeout: 15_000 })
  return header.locator('..').locator('..')
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Timetable tab — real parquet queries', () => {
  test('train autocomplete lists real trains from parquet', async ({ page }) => {
    await openTimetableTab(page)
    const trainInput = page.getByRole('textbox', { name: /train/i })
    await trainInput.fill('ICE 9')

    const dropdown = page.getByRole('list')
    await dropdown.waitFor({ state: 'visible' })
    await expect(dropdown.getByRole('listitem').filter({ hasText: 'ICE 905' })).toBeVisible()
  })

  test('selecting a train renders the timetable table', async ({ page }) => {
    await openTimetableTab(page)
    await selectTrain(page, 'ICE 905')

    await expect(page.getByText('Planned Timetable')).toBeVisible({ timeout: 15_000 })
  })

  test('timetable shows correct first and last station for ICE 905', async ({ page }) => {
    await openTimetableTab(page)
    await selectTrain(page, 'ICE 905')

    const timetable = await getTimetableContainer(page)

    // First station: Bitterfeld — arr 00:37 UTC, dep 00:39 UTC
    await expect(timetable.getByRole('cell', { name: 'Bitterfeld' })).toBeVisible()
    await expect(timetable.getByRole('cell', { name: '00:37' })).toBeVisible()
    await expect(timetable.getByRole('cell', { name: '00:39' })).toBeVisible()

    // Last station: München Hbf — arrives 07:14 UTC, no departure
    await expect(timetable.getByRole('cell', { name: 'München Hbf' })).toBeVisible()
    await expect(timetable.getByRole('cell', { name: '07:14' })).toBeVisible()
  })

  test('timetable shows all 15 stops for ICE 905', async ({ page }) => {
    await openTimetableTab(page)
    await selectTrain(page, 'ICE 905')

    await expect(page.getByText('Planned Timetable')).toBeVisible({ timeout: 15_000 })

    // Filter to visible rows only — rows in hidden tabs have display:none
    const rows = page.locator('table tbody tr').filter({ visible: true })
    await expect(rows).toHaveCount(15)
  })

  test('timetable shows the latest ride date in the header', async ({ page }) => {
    await openTimetableTab(page)
    await selectTrain(page, 'ICE 905')

    await expect(page.getByText('Planned Timetable')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/latest run: 2026-02-09/i)).toBeVisible()
  })

  test('intermediate stations have both arrival and departure', async ({ page }) => {
    await openTimetableTab(page)
    await selectTrain(page, 'ICE 905')

    await expect(page.getByText('Planned Timetable')).toBeVisible({ timeout: 15_000 })

    // Leipzig Hbf: arr 00:55 UTC, dep 01:03 UTC
    await expect(page.getByText('Leipzig Hbf')).toBeVisible()
    await expect(page.getByText('00:55')).toBeVisible()
    await expect(page.getByText('01:03')).toBeVisible()
  })

  test('switching away and back to Timetable tab preserves state', async ({ page }) => {
    await openTimetableTab(page)
    await selectTrain(page, 'ICE 905')
    const timetable = await getTimetableContainer(page)

    // Switch to another tab and back
    await page.getByRole('button', { name: 'Train Delays' }).click()
    await page.getByRole('button', { name: 'Timetable' }).click()

    // Table should still be visible (hidden via CSS, not unmounted)
    await expect(page.getByText('Planned Timetable')).toBeVisible()
    await expect(timetable.getByRole('cell', { name: 'Bitterfeld' })).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// French (TGV 8088) and Eurostar (EST 9423) UI tests
// ---------------------------------------------------------------------------

test.describe('Timetable tab — French and Eurostar GTFS queries', () => {
  test('typing "8088" shows TGV 8088 in dropdown', async ({ page }) => {
    await openTimetableTab(page)
    const trainInput = page.getByRole('textbox', { name: /train/i })
    await trainInput.fill('8088')

    const dropdown = page.getByRole('list')
    await dropdown.waitFor({ state: 'visible' })
    await expect(dropdown.getByRole('listitem').filter({ hasText: 'TGV 8088' })).toBeVisible()
  })

  test('TGV 8088 timetable shows 4 stops without ride date', async ({ page }) => {
    await openTimetableTab(page)
    await selectTrain(page, 'TGV 8088')

    await expect(page.getByText('Planned Timetable')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/latest run:/i)).not.toBeVisible()

    const rows = page.locator('table tbody tr').filter({ visible: true })
    await expect(rows).toHaveCount(4)

    const timetable = await getTimetableContainer(page)
    await expect(timetable.getByRole('cell', { name: 'Saint-Malo' })).toBeVisible()
    await expect(timetable.getByRole('cell', { name: 'Paris Montparnasse Hall 1 - 2' })).toBeVisible()
  })

  test('typing "9423" shows EST 9423 in dropdown', async ({ page }) => {
    await openTimetableTab(page)
    const trainInput = page.getByRole('textbox', { name: /train/i })
    await trainInput.fill('9423')

    const dropdown = page.getByRole('list')
    await dropdown.waitFor({ state: 'visible' })
    await expect(dropdown.getByRole('listitem').filter({ hasText: 'EST 9423' })).toBeVisible()
  })

  test('EST 9423 timetable shows 5 stops with ride date', async ({ page }) => {
    await openTimetableTab(page)
    await selectTrain(page, 'EST 9423')

    await expect(page.getByText('Planned Timetable')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/latest run:/i)).toBeVisible()

    const rows = page.locator('table tbody tr').filter({ visible: true })
    await expect(rows).toHaveCount(5)

    const timetable = await getTimetableContainer(page)
    await expect(timetable.getByRole('cell', { name: 'Paris-Nord' })).toBeVisible()
    await expect(timetable.getByRole('cell', { name: 'Köln Hbf' })).toBeVisible()
  })
})
