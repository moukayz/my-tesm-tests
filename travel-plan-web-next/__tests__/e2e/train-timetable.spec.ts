/**
 * E2E tests for the Timetable tab — queries real parquet files via the running Next.js server.
 *
 * Anchored to known real data:
 *   train: ICE 905
 *   latest ride date: 2026-02-09
 *   route: Berlin Hauptbahnhof (dep 23:10) → ... → München Hbf (arr 07:14)
 *   total stops: 16
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

    // First station: Berlin Hauptbahnhof — no arrival, departs 23:10
    await expect(timetable.getByRole('cell', { name: 'Berlin Hauptbahnhof' })).toBeVisible()
    await expect(timetable.getByRole('cell', { name: '23:10' })).toBeVisible()

    // Last station: München Hbf — arrives 07:14, no departure
    await expect(timetable.getByRole('cell', { name: 'München Hbf' })).toBeVisible()
    await expect(timetable.getByRole('cell', { name: '07:14' })).toBeVisible()
  })

  test('timetable shows all 16 stops for ICE 905', async ({ page }) => {
    await openTimetableTab(page)
    await selectTrain(page, 'ICE 905')

    await expect(page.getByText('Planned Timetable')).toBeVisible({ timeout: 15_000 })

    // Filter to visible rows only — rows in hidden tabs have display:none
    const rows = page.locator('table tbody tr').filter({ visible: true })
    await expect(rows).toHaveCount(16)
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

    // Leipzig Hbf: arr 00:55, dep 01:03
    await expect(page.getByText('Leipzig Hbf')).toBeVisible()
    await expect(page.getByText('00:55')).toBeVisible()
    await expect(page.getByText('01:03')).toBeVisible()
  })

  test('switching away and back to Timetable tab preserves state', async ({ page }) => {
    await openTimetableTab(page)
    await selectTrain(page, 'ICE 905')
    const timetable = await getTimetableContainer(page)

    // Switch to another tab and back
    await page.getByRole('button', { name: 'Itinerary' }).click()
    await page.getByRole('button', { name: 'Timetable' }).click()

    // Table should still be visible (hidden via CSS, not unmounted)
    await expect(page.getByText('Planned Timetable')).toBeVisible()
    await expect(timetable.getByRole('cell', { name: 'Berlin Hauptbahnhof' })).toBeVisible()
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
    expect(rows).toHaveLength(16)

    // Rows are ordered by station_num
    for (let i = 0; i < rows.length - 1; i++) {
      expect(rows[i].station_num).toBeLessThan(rows[i + 1].station_num)
    }

    // First stop: Berlin Hauptbahnhof, no arrival
    expect(rows[0].station_name).toBe('Berlin Hauptbahnhof')
    expect(rows[0].station_num).toBe(1)
    expect(rows[0].arrival_planned_time).toBeNull()
    expect(rows[0].departure_planned_time).toContain('23:10')

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
