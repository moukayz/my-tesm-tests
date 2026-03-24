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

test.describe('Itinerary UI adjustments', () => {
  test('detail shell uses an icon-only back action and preserves cards navigation', async ({ page }) => {
    const itineraryName = `UI Adjustments ${Date.now()}`

    await injectSession(page, makeTestUser('ui-adjustments-back'))

    const createResponse = await page.request.post('/api/itineraries', {
      data: { name: itineraryName, startDate: '2026-10-01' },
    })
    expect(createResponse.status()).toBe(201)

    const createBody = await createResponse.json()
    const itineraryId = createBody.itinerary.id as string

    const stayResponse = await page.request.post(`/api/itineraries/${itineraryId}/stays`, {
      data: { city: 'Paris', nights: 3 },
    })
    expect(stayResponse.status()).toBe(200)

    await page.goto(`/?tab=itinerary&itineraryId=${itineraryId}`)

    const backButton = page.getByRole('button', { name: 'Back to all itineraries' })
    await expect(backButton).toBeVisible()
    await expect(page.getByText('Back to all itineraries', { exact: true })).toHaveCount(0)
    await expect.poll(async () => backButton.evaluate((node) => node.textContent?.trim() ?? '')).toBe('')

    await backButton.click()

    await expect(page).toHaveURL('/?tab=itinerary')
    await expect(page.getByRole('button', { name: new RegExp(`Open itinerary ${itineraryName}`) })).toBeVisible()
  })

  test('overnight pencil is the only full stay edit trigger', async ({ page }) => {
    const itineraryName = `UI Adjustments Stay ${Date.now()}`

    await injectSession(page, makeTestUser('ui-adjustments-stay'))

    const createResponse = await page.request.post('/api/itineraries', {
      data: { name: itineraryName, startDate: '2026-10-01' },
    })
    expect(createResponse.status()).toBe(201)

    const createBody = await createResponse.json()
    const itineraryId = createBody.itinerary.id as string

    const firstStayResponse = await page.request.post(`/api/itineraries/${itineraryId}/stays`, {
      data: { city: 'Paris', nights: 3 },
    })
    expect(firstStayResponse.status()).toBe(200)

    const secondStayResponse = await page.request.post(`/api/itineraries/${itineraryId}/stays`, {
      data: { city: 'Rome', nights: 2 },
    })
    expect(secondStayResponse.status()).toBe(200)

    await page.goto(`/?tab=itinerary&itineraryId=${itineraryId}`)

    const itineraryTab = page.getByTestId('itinerary-tab')
    const parisEditButton = itineraryTab.getByRole('button', { name: 'Edit stay for Paris' })

    await expect(parisEditButton).toBeVisible()
    await expect(itineraryTab.getByRole('button', { name: /^Edit stay$/i })).toHaveCount(0)

    await parisEditButton.focus()
    await parisEditButton.click()

    const dialog = page.getByRole('dialog', { name: 'Edit stay' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByLabel('City')).toHaveValue('Paris')
    await expect(dialog.getByLabel('Nights')).toHaveValue('3')

    await dialog.getByLabel('City').fill('Lyon')
    await dialog.getByLabel('Nights').fill('4')

    const saveResponse = page.waitForResponse(
      (response) => response.url().includes(`/api/itineraries/${itineraryId}/stays/0`) && response.status() === 200
    )
    await dialog.getByRole('button', { name: 'Save stay' }).click()
    await saveResponse

    await expect(page.getByRole('dialog', { name: 'Edit stay' })).toHaveCount(0)
    await expect(itineraryTab.getByRole('button', { name: 'Edit stay for Lyon' })).toBeVisible()
    await expect(itineraryTab.getByRole('button', { name: /^Edit stay$/i })).toHaveCount(0)

    const workspaceResponse = await page.request.get(`/api/itineraries/${itineraryId}`)
    expect(workspaceResponse.status()).toBe(200)

    const workspaceBody = await workspaceResponse.json()
    expect(workspaceBody.stays).toEqual([
      expect.objectContaining({ city: 'Lyon', nights: 4, stayIndex: 0 }),
      expect.objectContaining({ city: 'Rome', nights: 2, stayIndex: 1 }),
    ])
  })
})
