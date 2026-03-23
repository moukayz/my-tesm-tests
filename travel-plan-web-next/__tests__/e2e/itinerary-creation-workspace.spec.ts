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

test.describe('Itinerary creation and stay planning MVP', () => {
  test('authenticated user can create a new itinerary shell and land on the empty workspace', async ({ page }) => {
    const itineraryName = `QA MVP ${Date.now()}`

    await injectSession(page, makeTestUser('workspace-shell'))
    await page.goto('/')

    await page.getByRole('button', { name: 'New itinerary' }).click()
    await page.getByLabel('Name').fill(itineraryName)
    await page.getByLabel('Start date').fill('2026-10-01')
    await page.getByRole('button', { name: 'Create itinerary' }).click()

    await expect(page).toHaveURL(/\?tab=itinerary&itineraryId=/)

    const emptyState = page.getByTestId('itinerary-empty-state')
    await expect(page.getByRole('button', { name: 'Add first stay' })).toBeVisible({ timeout: 15000 })
    await expect(emptyState).toBeVisible()
    await expect(emptyState.getByRole('heading', { name: itineraryName })).toBeVisible()
    await expect(emptyState.getByText('Start date: 2026-10-01')).toBeVisible()
  })

  test('empty workspace supports progressive stay planning, full stay edits, and reload', async ({ page }) => {
    test.slow()

    const itineraryName = `QA Workspace ${Date.now()}`

    await injectSession(page, makeTestUser('workspace-progressive'))
    await page.goto('/')

    const createResponse = await page.request.post('/api/itineraries', {
      data: { name: itineraryName, startDate: '2026-10-01' },
    })
    expect(createResponse.status()).toBe(201)

    const createBody = await createResponse.json()
    const workspaceUrl = createBody.workspaceUrl as string
    const itineraryId = createBody.itinerary.id as string

    await page.goto(workspaceUrl)

    const emptyState = page.getByTestId('itinerary-empty-state')
    await expect(emptyState).toBeVisible()
    await expect(emptyState.getByRole('heading', { name: itineraryName })).toBeVisible()

    await emptyState.getByRole('button', { name: 'Add first stay' }).click()
    await page.getByLabel('City').fill('Paris')
    await page.getByLabel('Nights').fill('3')
    await page.getByRole('button', { name: 'Create stay' }).click()

    const itineraryTab = page.getByTestId('itinerary-tab')
    await expect(itineraryTab).toBeVisible()
    await expect(page.getByRole('heading', { name: itineraryName })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add next stay' })).toHaveCount(1)

    await page.getByRole('button', { name: 'Add next stay' }).click()
    await page.getByLabel('City').fill('Rome')
    await page.getByLabel('Nights').fill('2')
    await page.getByRole('button', { name: 'Add stay' }).click()

    await expect(page.getByRole('button', { name: 'Edit stay for Rome' })).toHaveCount(1)

    await page.getByRole('button', { name: 'Edit stay for Rome' }).click()
    await page.getByLabel('City').fill('Milan')
    await page.getByLabel('Nights').fill('4')
    await page.getByRole('button', { name: 'Save stay' }).click()

    await expect(page.getByRole('button', { name: 'Edit stay for Milan' })).toHaveCount(1)

    await page.getByRole('button', { name: 'Edit stay for Paris' }).click()
    await page.getByLabel('Nights').fill('2')
    const stayEditSave = page.waitForResponse(
      (response) => response.url().includes(`/api/itineraries/${itineraryId}/stays/0`) && response.status() === 200
    )
    await page.getByRole('button', { name: 'Save stay' }).click()
    await stayEditSave

    const workspaceResponse = await page.request.get(`/api/itineraries/${itineraryId}`)
    expect(workspaceResponse.status()).toBe(200)

    const workspaceBody = await workspaceResponse.json()
    expect(workspaceBody.stays).toEqual([
      expect.objectContaining({ city: 'Paris', nights: 2, stayIndex: 0 }),
      expect.objectContaining({ city: 'Milan', nights: 5, stayIndex: 1 }),
    ])
    expect(workspaceBody.days).toHaveLength(7)

    await page.reload()
    await expect(page).toHaveURL(new RegExp(`\\?tab=itinerary&itineraryId=${itineraryId}`))
    await expect(page.getByRole('heading', { name: itineraryName })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Edit stay for Milan' })).toHaveCount(1)
    await expect(page.getByRole('button', { name: 'Edit stay for Paris' })).toHaveCount(1)
  })
})
