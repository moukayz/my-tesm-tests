import { test, expect } from '@playwright/test'

test.describe('Forecast Tab', () => {
  test('forecast tab is visible to logged-out users', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: /^forecast$/i })).toBeVisible()
  })

  test('clicking Forecast tab shows the map container', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /^forecast$/i }).click()
    await expect(page.getByTestId('forecast-map')).toBeVisible()
  })

  test('Forecast tab shows ECMWF IFS label', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /^forecast$/i }).click()
    await expect(page.getByText(/ECMWF IFS/)).toBeVisible()
  })
})
