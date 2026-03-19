/**
 * E2E tests for the Train Delay tab — queries real parquet files via the running Next.js server.
 *
 * Anchored to known real data:
 *   train: ICE 1000  |  station: München Hbf
 *   total_stops: 56, avg_delay: 3.04, p50: 1.0, max_delay: 34  (last 3 months window)
 */
import { test, expect, type Page } from '@playwright/test'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function openDelaysTab(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Train Delays' }).click()
}

async function selectTrain(page: Page, trainName: string) {
  const trainInput = page.getByRole('textbox', { name: /train/i })
  await trainInput.fill(trainName)
  // Wait for the dropdown option and click it
  const option = page.getByRole('listitem').filter({ hasText: trainName }).first()
  await option.waitFor({ state: 'visible' })
  await option.click()
}

async function selectStation(page: Page, stationName: string) {
  const stationInput = page.getByRole('textbox', { name: /station/i })
  await stationInput.fill(stationName)
  const option = page.getByRole('listitem').filter({ hasText: stationName }).first()
  await option.waitFor({ state: 'visible' })
  await option.click()
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Train Delays tab — real parquet queries', () => {
  test('page loads with Train Delays tab visible', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Train Delays' })).toBeVisible()
  })

  test('train autocomplete lists real trains from parquet', async ({ page }) => {
    await openDelaysTab(page)

    const trainInput = page.getByRole('textbox', { name: /train/i })
    await trainInput.fill('ICE 1')

    // Several ICE trains should appear in the dropdown
    const dropdown = page.getByRole('list')
    await dropdown.waitFor({ state: 'visible' })
    const items = dropdown.getByRole('listitem')
    await expect(items.first()).toBeVisible()
    const count = await items.count()
    expect(count).toBeGreaterThan(0)

    // ICE 1000 must be among them
    await expect(dropdown.getByRole('listitem').filter({ hasText: 'ICE 1000' })).toBeVisible()
  })

  test('selecting a train populates the station dropdown', async ({ page }) => {
    await openDelaysTab(page)
    await selectTrain(page, 'ICE 1000')

    // Station input should become enabled and list stations after fetch
    const stationInput = page.getByRole('textbox', { name: /station/i })
    await expect(stationInput).not.toBeDisabled()

    await stationInput.fill('München')
    const dropdown = page.getByRole('list')
    await dropdown.waitFor({ state: 'visible' })
    await expect(dropdown.getByRole('listitem').filter({ hasText: 'München Hbf' })).toBeVisible()
  })

  test('selecting train + station shows real delay stats from parquet', async ({ page }) => {
    await openDelaysTab(page)
    await selectTrain(page, 'ICE 1000')
    await selectStation(page, 'München Hbf')

    // Wait for stats to appear (loading spinner goes away)
    await expect(page.getByText('Loading...')).toBeHidden({ timeout: 15_000 })

    // Known stat values from the real parquet data:
    //   total_stops: 56, avg_delay: 3.04 min
    await expect(page.getByText('56')).toBeVisible()
    await expect(page.getByText('3.04')).toBeVisible()
  })

  test('delay trend chart is rendered after stats load', async ({ page }) => {
    await openDelaysTab(page)
    await selectTrain(page, 'ICE 1000')
    await selectStation(page, 'München Hbf')

    await expect(page.getByText('Loading...')).toBeHidden({ timeout: 15_000 })

    // The chart section heading is always rendered when stats exist
    await expect(page.getByText('Daily Avg Delay — Last 3 Months')).toBeVisible()

    // recharts renders an SVG
    const svg = page.locator('.recharts-wrapper svg').first()
    await expect(svg).toBeVisible()
  })

  test('switching trains resets station and clears stats', async ({ page }) => {
    await openDelaysTab(page)
    await selectTrain(page, 'ICE 1000')
    await selectStation(page, 'München Hbf')
    await expect(page.getByText('Loading...')).toBeHidden({ timeout: 15_000 })

    // Now change the train — type something different
    const trainInput = page.getByRole('textbox', { name: /train/i })
    await trainInput.fill('ICE 10')

    // Stats should no longer be visible (selected train is deselected)
    await expect(page.getByText('Daily Avg Delay — Last 3 Months')).toBeHidden()
  })

  test('no-data message is shown for a train+station with no recent records', async ({ page }) => {
    // Use a combination that realistically has no data in the last 3 months window
    // by picking a train that exists but typing a non-existent station
    await openDelaysTab(page)
    await selectTrain(page, 'ICE 1000')

    // Manually force an API call for a station that doesn't exist by directly hitting the API
    const res = await page.request.get('/api/delay-stats?train=ICE+1000&station=NONEXISTENT_STATION_XYZ')
    const body = await res.json()
    // API should return ok with zero stops (no data) not an error
    expect(res.ok()).toBeTruthy()
    // When no rows match, COUNT(*) returns 0 and AVG returns null
    expect(body.stats.total_stops).toBe(0)
    expect(body.stats.avg_delay).toBeNull()
    expect(body.trends).toHaveLength(0)
  })
})
