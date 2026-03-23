/**
 * @jest-environment node
 */
import fs from 'fs'
import os from 'os'
import path from 'path'
import { NextRequest } from 'next/server'

const mockAuth = jest.fn()
jest.mock('../../auth', () => ({ auth: mockAuth }))

describe('itinerary APIs', () => {
  let tempDir: string

  async function post(url: string, body: unknown) {
    return new NextRequest(url, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    })
  }

  async function patch(url: string, body: unknown) {
    return new NextRequest(url, {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    })
  }

  function get(url: string) {
    return new NextRequest(url, { method: 'GET' })
  }

  beforeEach(() => {
    jest.resetModules()
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'itinerary-api-'))
    process.env.ITINERARY_DATA_DIR = tempDir
    delete process.env.KV_REST_API_URL
    delete process.env.KV_REST_API_TOKEN
    mockAuth.mockReset()
    mockAuth.mockResolvedValue({ user: { email: 'owner@example.com' } })
  })

  afterEach(() => {
    delete process.env.ITINERARY_DATA_DIR
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('supports full write chain: create -> append stay -> patch stay -> patch day plan -> reload workspace', async () => {
    const createRoute = await import('../../app/api/itineraries/route')
    const createRes = await createRoute.POST(await post('http://localhost/api/itineraries', { name: 'Euro Trip', startDate: '2026-04-01' }))

    expect(createRes.status).toBe(201)
    const createBody = await createRes.json()
    const itineraryId = createBody.itinerary.id as string
    expect(createBody.workspaceUrl).toBe(`/?tab=itinerary&itineraryId=${itineraryId}`)

    const appendRoute = await import('../../app/api/itineraries/[itineraryId]/stays/route')
    const appendRes = await appendRoute.POST(
      await post(`http://localhost/api/itineraries/${itineraryId}/stays`, { city: 'Paris', nights: 2 }),
      { params: Promise.resolve({ itineraryId }) }
    )

    expect(appendRes.status).toBe(200)
    const appendBody = await appendRes.json()
    expect(appendBody.days).toHaveLength(2)
    expect(appendBody.stays).toHaveLength(1)

    const patchStayRoute = await import('../../app/api/itineraries/[itineraryId]/stays/[stayIndex]/route')
    const patchStayRes = await patchStayRoute.PATCH(
      await patch(`http://localhost/api/itineraries/${itineraryId}/stays/0`, { city: 'Lyon', nights: 3 }),
      { params: Promise.resolve({ itineraryId, stayIndex: '0' }) }
    )

    expect(patchStayRes.status).toBe(200)
    const stayBody = await patchStayRes.json()
    expect(stayBody.days).toHaveLength(3)
    expect(stayBody.days.every((d: { overnight: string }) => d.overnight === 'Lyon')).toBe(true)

    const patchPlanRoute = await import('../../app/api/itineraries/[itineraryId]/days/[dayIndex]/plan/route')
    const patchPlanRes = await patchPlanRoute.PATCH(
      await patch(`http://localhost/api/itineraries/${itineraryId}/days/2/plan`, {
        plan: { morning: 'Museum', afternoon: 'Old town', evening: 'Dinner' },
      }),
      { params: Promise.resolve({ itineraryId, dayIndex: '2' }) }
    )

    expect(patchPlanRes.status).toBe(200)
    const updatedDay = await patchPlanRes.json()
    expect(updatedDay.plan.morning).toBe('Museum')

    const getRoute = await import('../../app/api/itineraries/[itineraryId]/route')
    const getRes = await getRoute.GET(new NextRequest(`http://localhost/api/itineraries/${itineraryId}`), {
      params: Promise.resolve({ itineraryId }),
    })

    expect(getRes.status).toBe(200)
    const workspace = await getRes.json()
    expect(workspace.days[2].plan.evening).toBe('Dinner')
  })

  it('returns 401 UNAUTHORIZED when no session', async () => {
    mockAuth.mockResolvedValue(null)
    const createRoute = await import('../../app/api/itineraries/route')
    const res = await createRoute.POST(await post('http://localhost/api/itineraries', { startDate: '2026-04-01' }))
    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe('UNAUTHORIZED')
  })

  it('GET /api/itineraries returns owner summaries ordered by updatedAt desc', async () => {
    const route = await import('../../app/api/itineraries/route')

    const firstCreate = await route.POST(await post('http://localhost/api/itineraries', { name: 'First', startDate: '2026-04-01' }))
    const firstId = (await firstCreate.json()).itinerary.id as string

    await route.POST(await post('http://localhost/api/itineraries', { name: 'Second', startDate: '2026-04-02' }))

    const staysRoute = await import('../../app/api/itineraries/[itineraryId]/stays/route')
    await new Promise((resolve) => setTimeout(resolve, 5))
    await staysRoute.POST(await post(`http://localhost/api/itineraries/${firstId}/stays`, { city: 'Paris', nights: 2 }), {
      params: Promise.resolve({ itineraryId: firstId }),
    })

    mockAuth.mockResolvedValue({ user: { email: 'other@example.com' } })
    await route.POST(await post('http://localhost/api/itineraries', { name: 'Third', startDate: '2026-04-03' }))

    mockAuth.mockResolvedValue({ user: { email: 'owner@example.com' } })
    const listRes = await route.GET(get('http://localhost/api/itineraries'))

    expect(listRes.status).toBe(200)
    expect(await listRes.json()).toEqual({
      items: [
        expect.objectContaining({ id: firstId, name: 'First' }),
        expect.objectContaining({ name: 'Second' }),
      ],
    })
  })

  it('GET /api/itineraries returns empty items when owner has none', async () => {
    const route = await import('../../app/api/itineraries/route')
    const listRes = await route.GET(get('http://localhost/api/itineraries'))

    expect(listRes.status).toBe(200)
    expect(await listRes.json()).toEqual({ items: [] })
  })

  it('GET /api/itineraries returns 401 UNAUTHORIZED when no session', async () => {
    mockAuth.mockResolvedValue(null)
    const route = await import('../../app/api/itineraries/route')
    const listRes = await route.GET(get('http://localhost/api/itineraries'))

    expect(listRes.status).toBe(401)
    expect((await listRes.json()).error).toBe('UNAUTHORIZED')
  })

  it('returns 403 ITINERARY_FORBIDDEN when owner mismatches', async () => {
    const createRoute = await import('../../app/api/itineraries/route')
    const createRes = await createRoute.POST(await post('http://localhost/api/itineraries', { startDate: '2026-04-01' }))
    const itineraryId = (await createRes.json()).itinerary.id as string

    mockAuth.mockResolvedValue({ user: { email: 'other@example.com' } })

    const getRoute = await import('../../app/api/itineraries/[itineraryId]/route')
    const getRes = await getRoute.GET(new NextRequest(`http://localhost/api/itineraries/${itineraryId}`), {
      params: Promise.resolve({ itineraryId }),
    })

    expect(getRes.status).toBe(403)
    expect((await getRes.json()).error).toBe('ITINERARY_FORBIDDEN')
  })

  it('returns 404 ITINERARY_NOT_FOUND for unknown itinerary', async () => {
    const getRoute = await import('../../app/api/itineraries/[itineraryId]/route')
    const getRes = await getRoute.GET(new NextRequest('http://localhost/api/itineraries/missing'), {
      params: Promise.resolve({ itineraryId: 'missing' }),
    })

    expect(getRes.status).toBe(404)
    expect((await getRes.json()).error).toBe('ITINERARY_NOT_FOUND')
  })

  it('returns 409 STAY_TRAILING_DAYS_LOCKED when shrinking last stay with authored trailing content', async () => {
    const createRoute = await import('../../app/api/itineraries/route')
    const createRes = await createRoute.POST(await post('http://localhost/api/itineraries', { startDate: '2026-04-01' }))
    const itineraryId = (await createRes.json()).itinerary.id as string

    const appendRoute = await import('../../app/api/itineraries/[itineraryId]/stays/route')
    await appendRoute.POST(
      await post(`http://localhost/api/itineraries/${itineraryId}/stays`, { city: 'Paris', nights: 3 }),
      { params: Promise.resolve({ itineraryId }) }
    )

    const patchPlanRoute = await import('../../app/api/itineraries/[itineraryId]/days/[dayIndex]/plan/route')
    await patchPlanRoute.PATCH(
      await patch(`http://localhost/api/itineraries/${itineraryId}/days/2/plan`, {
        plan: { morning: 'Authored', afternoon: '', evening: '' },
      }),
      { params: Promise.resolve({ itineraryId, dayIndex: '2' }) }
    )

    const patchStayRoute = await import('../../app/api/itineraries/[itineraryId]/stays/[stayIndex]/route')
    const res = await patchStayRoute.PATCH(
      await patch(`http://localhost/api/itineraries/${itineraryId}/stays/0`, { nights: 1 }),
      { params: Promise.resolve({ itineraryId, stayIndex: '0' }) }
    )

    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe('STAY_TRAILING_DAYS_LOCKED')
  })
})
