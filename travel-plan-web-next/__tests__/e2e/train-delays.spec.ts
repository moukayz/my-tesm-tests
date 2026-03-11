import { test, expect } from '@playwright/test'

test.describe('Train Delays Tab', () => {
  test('station input is disabled when no train is selected (on page load)', async ({ page }) => {
    await page.goto('/')
    const stationInput = page.getByPlaceholder('Type to search station')
    await expect(stationInput).toBeDisabled()
  })

  test('GET /api/trains?railway=german returns 200 with a non-empty array', async ({ request }) => {
    const res = await request.get('/api/trains?railway=german')
    expect(res.status()).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBeGreaterThan(0)
  })

  test('GET /api/stations?train=ICE%20905 returns 200 with a non-empty array', async ({ request }) => {
    const res = await request.get('/api/stations?train=ICE%20905')
    expect(res.status()).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBeGreaterThan(0)
  })

  test('GET /api/delay-stats with train and station returns 200 with stats object', async ({ request }) => {
    // First get a valid station for ICE 905
    const stationsRes = await request.get('/api/stations?train=ICE%20905')
    const stations = await stationsRes.json()
    expect(stations.length).toBeGreaterThan(0)
    const station = encodeURIComponent(stations[0].station_name)

    const res = await request.get(`/api/delay-stats?train=ICE%20905&station=${station}`)
    expect(res.status()).toBe(200)
    const data = await res.json()
    expect(data).toBeTruthy()
  })

  test('trains list loads and autocomplete shows options when typing "ICE"', async ({ page }) => {
    await page.goto('/')

    // Wait for the loading spinner to disappear (trains have loaded)
    await expect(page.getByRole('status').first()).not.toBeVisible({ timeout: 20000 })

    // Use the Train Delays tab input by its unique id
    const trainInput = page.locator('#train-input')
    await trainInput.fill('ICE')

    // Expect at least one list item visible in the dropdown
    await expect(page.locator('li').first()).toBeVisible({ timeout: 10000 })
  })

  test('selecting a train from autocomplete loads stations (station input becomes enabled)', async ({ page }) => {
    await page.goto('/')

    // Wait for trains to load
    await expect(page.getByRole('status').first()).not.toBeVisible({ timeout: 20000 })

    // Use the Train Delays tab input by its unique id
    const trainInput = page.locator('#train-input')
    await trainInput.fill('ICE 905')
    await page.locator('li').filter({ hasText: 'ICE 905' }).first().click()

    // Station input should become enabled
    const stationInput = page.getByPlaceholder('Type to search station')
    await expect(stationInput).not.toBeDisabled({ timeout: 10000 })
  })

  test('selecting a train and then a station shows delay stats ("Total Stops" card visible)', async ({ page }) => {
    await page.goto('/')

    // 1. Wait for trains to load (spinner gone)
    await expect(page.getByRole('status').first()).not.toBeVisible({ timeout: 20000 })

    // 2. Type "ICE 905" using the Train Delays tab input by its unique id
    const trainInput = page.locator('#train-input')
    await trainInput.fill('ICE 905')

    // 3. Click "ICE 905" option
    await page.locator('li').filter({ hasText: 'ICE 905' }).first().click()

    // 4. Wait for station input to become enabled
    const stationInput = page.getByPlaceholder('Type to search station')
    await expect(stationInput).not.toBeDisabled({ timeout: 10000 })

    // 5. Click station input to open dropdown (showAllWhenEmpty)
    await stationInput.click()

    // 6. Click the first station option in the dropdown
    await page.locator('li').first().click()

    // 7. Wait for "Total Stops" to be visible
    await expect(page.getByText(/total stops/i)).toBeVisible({ timeout: 20000 })
  })
})
