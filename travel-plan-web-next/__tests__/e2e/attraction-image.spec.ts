import { test, expect, type Page } from '@playwright/test'
import { encode } from 'next-auth/jwt'

const AUTH_SECRET = process.env.AUTH_SECRET || 'test-auth-secret-32chars!!!!!!!!'
const COOKIE_NAME = 'authjs.session-token'

function makeTestUser(label: string) {
  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  return { email: `${label}-${uniqueSuffix}@example.com`, name: 'Test User' }
}

async function injectSession(page: Page, user: { email: string; name: string }) {
  const token = await encode({
    token: { email: user.email, name: user.name, sub: user.email },
    secret: AUTH_SECRET,
    salt: COOKIE_NAME,
  })
  await page.context().addCookies([{
    name: COOKIE_NAME,
    value: token,
    domain: 'localhost',
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
  }])
}

async function simulatePaste(page: Page, testId: string) {
  await page.evaluate((selector) => {
    const area = document.querySelector(`[data-testid="${selector}"]`) as HTMLElement
    if (!area) return
    // Minimal 1×1 PNG bytes
    const pngBytes = new Uint8Array([
      137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82,
      0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0, 144, 119, 83, 222,
    ])
    const file = new File([pngBytes], 'test.png', { type: 'image/png' })
    const dt = new DataTransfer()
    dt.items.add(file)
    area.dispatchEvent(new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData: dt,
    }))
  }, testId)
}

test.describe('Attraction image feature', () => {
  let itineraryId: string

  test.beforeEach(async ({ page }) => {
    const user = makeTestUser('attraction-image')
    await injectSession(page, user)

    const createRes = await page.request.post('/api/itineraries', {
      data: { name: `Attraction Image E2E ${Date.now()}`, startDate: '2026-09-25' },
    })
    expect(createRes.status()).toBe(201)
    itineraryId = (await createRes.json()).itinerary.id

    await page.request.post(`/api/itineraries/${itineraryId}/stays`, {
      data: { city: 'Paris', nights: 2 },
    })
    await page.request.patch(`/api/itineraries/${itineraryId}/days/0/attractions`, {
      data: {
        attractions: [{ id: 'eiffel', label: 'Eiffel Tower', coordinates: { lat: 48.858, lng: 2.294 } }],
      },
    })

    await page.goto(`/?tab=itinerary&itineraryId=${itineraryId}`)
    await expect(page.getByTestId('itinerary-tab')).toBeVisible()
  })

  test('image icon button appears on hover over an attraction tag', async ({ page }) => {
    await page.getByText('Eiffel Tower').hover()
    await expect(
      page.getByRole('button', { name: /add images for eiffel tower/i })
    ).toBeVisible()
  })

  test('clicking the image icon opens the upload modal', async ({ page }) => {
    await page.getByText('Eiffel Tower').hover()
    await page.getByRole('button', { name: /add images for eiffel tower/i }).click()
    await expect(page.getByText(/paste/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /^upload$/i })).toBeDisabled()
  })

  test('modal closes when Escape is pressed', async ({ page }) => {
    await page.getByText('Eiffel Tower').hover()
    await page.getByRole('button', { name: /add images for eiffel tower/i }).click()
    await expect(page.getByRole('button', { name: /^upload$/i })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: /^upload$/i })).not.toBeVisible()
  })

  test('modal closes when the close button is clicked', async ({ page }) => {
    await page.getByText('Eiffel Tower').hover()
    await page.getByRole('button', { name: /add images for eiffel tower/i }).click()
    await page.getByRole('button', { name: /close/i }).click()
    await expect(page.getByRole('button', { name: /^upload$/i })).not.toBeVisible()
  })

  test('pasting an image shows a preview and enables the upload button', async ({ page }) => {
    await page.getByText('Eiffel Tower').hover()
    await page.getByRole('button', { name: /add images for eiffel tower/i }).click()
    await page.getByTestId('paste-area').focus()

    await simulatePaste(page, 'paste-area')

    await expect(page.getByRole('img', { name: /preview/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /^upload$/i })).toBeEnabled()
  })

  test('pasted image can be removed before upload', async ({ page }) => {
    await page.getByText('Eiffel Tower').hover()
    await page.getByRole('button', { name: /add images for eiffel tower/i }).click()
    await page.getByTestId('paste-area').focus()
    await simulatePaste(page, 'paste-area')

    const preview = page.getByRole('img', { name: /preview/i })
    await expect(preview).toBeVisible()
    await preview.hover()
    await page.getByRole('button', { name: /remove image/i }).click()
    await expect(page.getByRole('img', { name: /preview/i })).not.toBeVisible()
    await expect(page.getByRole('button', { name: /^upload$/i })).toBeDisabled()
  })

  test('image viewer appears on hover when attraction has images', async ({ page }) => {
    await page.request.patch(`/api/itineraries/${itineraryId}/days/0/attractions`, {
      data: {
        attractions: [{
          id: 'eiffel',
          label: 'Eiffel Tower',
          coordinates: { lat: 48.858, lng: 2.294 },
          images: ['https://via.placeholder.com/64'],
        }],
      },
    })

    await page.reload()
    await expect(page.getByTestId('itinerary-tab')).toBeVisible()

    await page.getByText('Eiffel Tower').hover()

    const viewer = page.getByTestId('image-scroll')
    await expect(viewer).toBeVisible()
    await expect(viewer.getByRole('img')).toHaveCount(1)
  })

  test('image viewer shows all images without pagination when there are more than 3', async ({ page }) => {
    await page.request.patch(`/api/itineraries/${itineraryId}/days/0/attractions`, {
      data: {
        attractions: [{
          id: 'eiffel',
          label: 'Eiffel Tower',
          coordinates: { lat: 48.858, lng: 2.294 },
          images: [
            'https://via.placeholder.com/64/1',
            'https://via.placeholder.com/64/2',
            'https://via.placeholder.com/64/3',
            'https://via.placeholder.com/64/4',
          ],
        }],
      },
    })

    await page.reload()
    await expect(page.getByTestId('itinerary-tab')).toBeVisible()

    await page.getByText('Eiffel Tower').hover()

    const viewer = page.getByTestId('image-scroll')
    await expect(viewer).toBeVisible()
    await expect(viewer.getByRole('img')).toHaveCount(4)
    // No pagination buttons — all images shown in a scrollable strip with one delete button per image
    await expect(viewer.getByRole('button')).toHaveCount(4)
  })
})
