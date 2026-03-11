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
  test('Timetable tab button is visible on the page', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Timetable' })).toBeVisible()
  })

  test('clicking Timetable tab shows the train input', async ({ page }) => {
    await openTimetableTab(page)
    await expect(page.getByRole('textbox', { name: /train/i })).toBeVisible()
  })

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

  test('all dropdown items contain the search term when typing "8088"', async ({ page }) => {
    await openTimetableTab(page)
    const trainInput = page.getByRole('textbox', { name: /train/i })
    await trainInput.fill('8088')

    const dropdown = page.getByRole('list')
    await dropdown.waitFor({ state: 'visible' })
    const items = dropdown.getByRole('listitem')
    const count = await items.count()
    expect(count).toBeGreaterThan(0)
    for (let i = 0; i < count; i++) {
      await expect(items.nth(i)).toContainText('8088')
    }
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

// ---------------------------------------------------------------------------
// French and Eurostar API tests
// ---------------------------------------------------------------------------

test.describe('GET /api/timetable — French and Eurostar GTFS queries', () => {
  test('TGV 8088: 4 stops, unique station_nums, null ride_date', async ({ request }) => {
    const res = await request.get('/api/timetable?train=TGV+8088&railway=french')
    expect(res.ok()).toBeTruthy()
    const rows = await res.json()
    expect(rows).toHaveLength(4)
    expect(rows[0].station_name).toBe('Saint-Malo')
    expect(rows[rows.length - 1].station_name).toBe('Paris Montparnasse Hall 1 - 2')
    rows.forEach((row: Record<string, unknown>) => expect(row.ride_date).toBeNull())
    const nums = rows.map((r: { station_num: number }) => r.station_num)
    expect(new Set(nums).size).toBe(nums.length)
  })

  test('EST 9423: 5 stops, Paris-Nord → Köln Hbf, ride_date present', async ({ request }) => {
    const res = await request.get('/api/timetable?train=EST+9423&railway=eurostar')
    expect(res.ok()).toBeTruthy()
    const rows = await res.json()
    expect(rows).toHaveLength(5)
    expect(rows[0].station_name).toBe('Paris-Nord')
    expect(rows[rows.length - 1].station_name).toBe('Köln Hbf')
    rows.forEach((row: Record<string, unknown>) => expect(row.ride_date).not.toBeNull())
    const nums = rows.map((r: { station_num: number }) => r.station_num)
    expect(new Set(nums).size).toBe(nums.length)
  })
})

test.describe('GET /api/timetable — real parquet queries', () => {
  test('returns 400 when train param is missing', async ({ request }) => {
    const res = await request.get('/api/timetable')
    expect(res.status()).toBe(400)
  })

  test('returns empty array for an unknown train', async ({ request }) => {
    const res = await request.get('/api/timetable?train=NONEXISTENT_TRAIN_XYZ')
    expect(res.ok()).toBeTruthy()
    const data = await res.json()
    expect(Array.isArray(data)).toBeTruthy()
    expect(data).toHaveLength(0)
  })

  test('returns ordered timetable rows for ICE 905', async ({ request }) => {
    const res = await request.get('/api/timetable?train=ICE+905')
    expect(res.ok()).toBeTruthy()
    const rows = await res.json()

    expect(Array.isArray(rows)).toBeTruthy()
    expect(rows).toHaveLength(15)

    // Rows are ordered by station_num
    for (let i = 0; i < rows.length - 1; i++) {
      expect(rows[i].station_num).toBeLessThan(rows[i + 1].station_num)
    }

    // First stop: Bitterfeld
    expect(rows[0].station_name).toBe('Bitterfeld')
    expect(rows[0].station_num).toBe(2)
    expect(rows[0].arrival_planned_time).toContain('00:37')
    expect(rows[0].departure_planned_time).toContain('00:39')

    // Last stop: München Hbf, no departure
    const last = rows[rows.length - 1]
    expect(last.station_name).toBe('München Hbf')
    expect(last.station_num).toBe(16)
    expect(last.arrival_planned_time).toContain('07:14')
    expect(last.departure_planned_time).toBeNull()

    // ride_date is present on every row
    rows.forEach((row: { ride_date: string }) => {
      expect(row.ride_date).toBe('2026-02-09')
    })
  })

  test('each row has the required fields', async ({ request }) => {
    const res = await request.get('/api/timetable?train=ICE+905')
    const rows = await res.json()

    rows.forEach((row: Record<string, unknown>) => {
      expect(row).toMatchObject({
        station_name: expect.any(String),
        station_num: expect.any(Number),
        ride_date: expect.any(String),
      })
      // arrival/departure may be string or null
      expect(['string', 'object']).toContain(typeof row.arrival_planned_time)
      expect(['string', 'object']).toContain(typeof row.departure_planned_time)
    })
  })
})
