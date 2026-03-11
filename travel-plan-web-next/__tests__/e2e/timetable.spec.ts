import { test, expect } from '@playwright/test'

test.describe('Timetable Tab', () => {
  test('GET /api/trains returns 200 with a non-empty array (combined German + French + Eurostar)', async ({ request }) => {
    const res = await request.get('/api/trains')
    expect(res.status()).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBeGreaterThan(0)
  })

  test('GET /api/timetable?train=ICE%20905&railway=german returns 200 with a non-empty array', async ({ request }) => {
    const res = await request.get('/api/timetable?train=ICE%20905&railway=german')
    expect(res.status()).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBeGreaterThan(0)
  })

  test('timetable tab shows train autocomplete input', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /^timetable$/i }).click()
    // The timetable tab has a train autocomplete input
    await expect(page.getByPlaceholder('Type to search, e.g. ICE 905').last()).toBeVisible()
  })

  test('selecting a train shows "Planned Timetable" heading and a table with rows', async ({ page }) => {
    // 1. Navigate to / and click Timetable tab
    await page.goto('/')
    await page.getByRole('button', { name: /^timetable$/i }).click()

    // 2. Wait for spinner to disappear (trains loaded)
    await expect(page.getByRole('status').first()).not.toBeVisible({ timeout: 20000 })

    // 3. Type "ICE 905" in train input (use last() since Train Delays tab also has a similar input)
    const trainInput = page.getByPlaceholder('Type to search, e.g. ICE 905').last()
    await trainInput.fill('ICE 905')

    // 4. Click "ICE 905" option
    await page.locator('li').filter({ hasText: 'ICE 905' }).first().click()

    // 5. Wait for "Planned Timetable" heading
    await expect(page.getByRole('heading', { name: /planned timetable/i })).toBeVisible({ timeout: 20000 })

    // 6. Expect at least one table row to be visible
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 10000 })
  })
})
