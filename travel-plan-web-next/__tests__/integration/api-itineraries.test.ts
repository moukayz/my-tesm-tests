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
    delete process.env.ROUTE_DATA_PATH
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

  it('persists resolved location metadata and keeps it when patching nights only', async () => {
    const createRoute = await import('../../app/api/itineraries/route')
    const createRes = await createRoute.POST(await post('http://localhost/api/itineraries', { startDate: '2026-04-01' }))
    const itineraryId = (await createRes.json()).itinerary.id as string

    const appendRoute = await import('../../app/api/itineraries/[itineraryId]/stays/route')
    const appendRes = await appendRoute.POST(
      await post(`http://localhost/api/itineraries/${itineraryId}/stays`, {
        nights: 2,
        location: {
          kind: 'resolved',
          label: 'Paris, Ile-de-France, France',
          queryText: 'par',
          coordinates: { lat: 48.85, lng: 2.35 },
          place: {
            placeId: 'geo:2988507',
            name: 'Paris',
            countryCode: 'FR',
            featureType: 'locality',
          },
        },
      }),
      { params: Promise.resolve({ itineraryId }) }
    )

    expect(appendRes.status).toBe(200)
    const appended = await appendRes.json()
    expect(appended.days).toHaveLength(2)
    expect(appended.days[0].location.kind).toBe('resolved')
    expect(appended.days[0].location.place.placeId).toBe('geo:2988507')

    const patchStayRoute = await import('../../app/api/itineraries/[itineraryId]/stays/[stayIndex]/route')
    const patchRes = await patchStayRoute.PATCH(
      await patch(`http://localhost/api/itineraries/${itineraryId}/stays/0`, { nights: 3 }),
      { params: Promise.resolve({ itineraryId, stayIndex: '0' }) }
    )

    expect(patchRes.status).toBe(200)
    const patched = await patchRes.json()
    expect(patched.days).toHaveLength(3)
    expect(patched.days.every((day: { location: { kind: string; place: { placeId: string } } }) => day.location.kind === 'resolved')).toBe(true)
    expect(patched.days.every((day: { location: { place: { placeId: string } } }) => day.location.place.placeId === 'geo:2988507')).toBe(true)
  })

  it('downgrades resolved stay to custom when city text is edited without location payload', async () => {
    const createRoute = await import('../../app/api/itineraries/route')
    const createRes = await createRoute.POST(await post('http://localhost/api/itineraries', { startDate: '2026-04-01' }))
    const itineraryId = (await createRes.json()).itinerary.id as string

    const appendRoute = await import('../../app/api/itineraries/[itineraryId]/stays/route')
    await appendRoute.POST(
      await post(`http://localhost/api/itineraries/${itineraryId}/stays`, {
        nights: 1,
        location: {
          kind: 'resolved',
          label: 'Paris, Ile-de-France, France',
          queryText: 'par',
          coordinates: { lat: 48.85, lng: 2.35 },
          place: {
            placeId: 'geo:2988507',
            name: 'Paris',
            countryCode: 'FR',
            featureType: 'locality',
          },
        },
      }),
      { params: Promise.resolve({ itineraryId }) }
    )

    const patchStayRoute = await import('../../app/api/itineraries/[itineraryId]/stays/[stayIndex]/route')
    const patchRes = await patchStayRoute.PATCH(
      await patch(`http://localhost/api/itineraries/${itineraryId}/stays/0`, { city: 'Paris (custom)' }),
      { params: Promise.resolve({ itineraryId, stayIndex: '0' }) }
    )

    expect(patchRes.status).toBe(200)
    const patched = await patchRes.json()
    expect(patched.days[0].location).toEqual({
      kind: 'custom',
      label: 'Paris (custom)',
      queryText: 'Paris (custom)',
    })
  })

  it('normalizes legacy city-only stored days to custom location on read', async () => {
    const createRoute = await import('../../app/api/itineraries/route')
    const createRes = await createRoute.POST(await post('http://localhost/api/itineraries', { startDate: '2026-04-01' }))
    const itineraryId = (await createRes.json()).itinerary.id as string

    const appendRoute = await import('../../app/api/itineraries/[itineraryId]/stays/route')
    await appendRoute.POST(
      await post(`http://localhost/api/itineraries/${itineraryId}/stays`, { city: 'Paris', nights: 1 }),
      { params: Promise.resolve({ itineraryId }) }
    )

    const recordPath = path.join(tempDir, `${itineraryId}.json`)
    const record = JSON.parse(fs.readFileSync(recordPath, 'utf-8'))
    delete record.days[0].location
    fs.writeFileSync(recordPath, JSON.stringify(record, null, 2))

    const getRoute = await import('../../app/api/itineraries/[itineraryId]/route')
    const getRes = await getRoute.GET(new NextRequest(`http://localhost/api/itineraries/${itineraryId}`), {
      params: Promise.resolve({ itineraryId }),
    })

    expect(getRes.status).toBe(200)
    const workspace = await getRes.json()
    expect(workspace.days[0].location).toEqual({ kind: 'custom', label: 'Paris', queryText: 'Paris' })
    expect(workspace.stays[0].location).toEqual({ kind: 'custom', label: 'Paris', queryText: 'Paris' })
  })

  it('returns 400 STAY_LOCATION_LABEL_MISMATCH when city and location label differ', async () => {
    const createRoute = await import('../../app/api/itineraries/route')
    const createRes = await createRoute.POST(await post('http://localhost/api/itineraries', { startDate: '2026-04-01' }))
    const itineraryId = (await createRes.json()).itinerary.id as string

    const appendRoute = await import('../../app/api/itineraries/[itineraryId]/stays/route')
    const appendRes = await appendRoute.POST(
      await post(`http://localhost/api/itineraries/${itineraryId}/stays`, {
        city: 'Paris',
        nights: 1,
        location: {
          kind: 'custom',
          label: 'Lyon',
          queryText: 'Lyon',
        },
      }),
      { params: Promise.resolve({ itineraryId }) }
    )

    expect(appendRes.status).toBe(400)
    expect((await appendRes.json()).error).toBe('STAY_LOCATION_LABEL_MISMATCH')
  })

  it('POST .../stays/0/move with direction=down swaps first and second stay', async () => {
    const createRoute = await import('../../app/api/itineraries/route')
    const createRes = await createRoute.POST(await post('http://localhost/api/itineraries', { startDate: '2026-04-01' }))
    const itineraryId = (await createRes.json()).itinerary.id as string

    const appendRoute = await import('../../app/api/itineraries/[itineraryId]/stays/route')
    await appendRoute.POST(await post(`http://localhost/api/itineraries/${itineraryId}/stays`, { city: 'Paris', nights: 2 }), { params: Promise.resolve({ itineraryId }) })
    await appendRoute.POST(await post(`http://localhost/api/itineraries/${itineraryId}/stays`, { city: 'Lyon', nights: 1 }), { params: Promise.resolve({ itineraryId }) })

    const moveRoute = await import('../../app/api/itineraries/[itineraryId]/stays/[stayIndex]/move/route')
    const moveRes = await moveRoute.POST(
      await post(`http://localhost/api/itineraries/${itineraryId}/stays/0/move`, { direction: 'down' }),
      { params: Promise.resolve({ itineraryId, stayIndex: '0' }) }
    )

    expect(moveRes.status).toBe(200)
    const body = await moveRes.json()
    expect(body.stays[0].city).toBe('Lyon')
    expect(body.stays[0].nights).toBe(1)
    expect(body.stays[1].city).toBe('Paris')
    expect(body.stays[1].nights).toBe(2)
  })

  it('POST .../stays/0/move with direction=up returns 400 STAY_SWAP_BOUNDARY', async () => {
    const createRoute = await import('../../app/api/itineraries/route')
    const createRes = await createRoute.POST(await post('http://localhost/api/itineraries', { startDate: '2026-04-01' }))
    const itineraryId = (await createRes.json()).itinerary.id as string

    const appendRoute = await import('../../app/api/itineraries/[itineraryId]/stays/route')
    await appendRoute.POST(await post(`http://localhost/api/itineraries/${itineraryId}/stays`, { city: 'Paris', nights: 1 }), { params: Promise.resolve({ itineraryId }) })
    await appendRoute.POST(await post(`http://localhost/api/itineraries/${itineraryId}/stays`, { city: 'Lyon', nights: 1 }), { params: Promise.resolve({ itineraryId }) })

    const moveRoute = await import('../../app/api/itineraries/[itineraryId]/stays/[stayIndex]/move/route')
    const res = await moveRoute.POST(
      await post(`http://localhost/api/itineraries/${itineraryId}/stays/0/move`, { direction: 'up' }),
      { params: Promise.resolve({ itineraryId, stayIndex: '0' }) }
    )

    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('STAY_SWAP_BOUNDARY')
  })

  it('POST .../stays/0/move with invalid direction returns 400 STAY_MOVE_DIRECTION_INVALID', async () => {
    const createRoute = await import('../../app/api/itineraries/route')
    const createRes = await createRoute.POST(await post('http://localhost/api/itineraries', { startDate: '2026-04-01' }))
    const itineraryId = (await createRes.json()).itinerary.id as string

    const appendRoute = await import('../../app/api/itineraries/[itineraryId]/stays/route')
    await appendRoute.POST(await post(`http://localhost/api/itineraries/${itineraryId}/stays`, { city: 'Paris', nights: 1 }), { params: Promise.resolve({ itineraryId }) })

    const moveRoute = await import('../../app/api/itineraries/[itineraryId]/stays/[stayIndex]/move/route')
    const res = await moveRoute.POST(
      await post(`http://localhost/api/itineraries/${itineraryId}/stays/0/move`, { direction: 'sideways' }),
      { params: Promise.resolve({ itineraryId, stayIndex: '0' }) }
    )

    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('STAY_MOVE_DIRECTION_INVALID')
  })

  it('POST .../stays/99/move returns 404 STAY_INDEX_INVALID', async () => {
    const createRoute = await import('../../app/api/itineraries/route')
    const createRes = await createRoute.POST(await post('http://localhost/api/itineraries', { startDate: '2026-04-01' }))
    const itineraryId = (await createRes.json()).itinerary.id as string

    const appendRoute = await import('../../app/api/itineraries/[itineraryId]/stays/route')
    await appendRoute.POST(await post(`http://localhost/api/itineraries/${itineraryId}/stays`, { city: 'Paris', nights: 1 }), { params: Promise.resolve({ itineraryId }) })

    const moveRoute = await import('../../app/api/itineraries/[itineraryId]/stays/[stayIndex]/move/route')
    const res = await moveRoute.POST(
      await post(`http://localhost/api/itineraries/${itineraryId}/stays/99/move`, { direction: 'down' }),
      { params: Promise.resolve({ itineraryId, stayIndex: '99' }) }
    )

    expect(res.status).toBe(404)
    expect((await res.json()).error).toBe('STAY_INDEX_INVALID')
  })

  it('POST .../stays/0/move returns 401 UNAUTHORIZED when no session', async () => {
    mockAuth.mockResolvedValue(null)
    const moveRoute = await import('../../app/api/itineraries/[itineraryId]/stays/[stayIndex]/move/route')
    const res = await moveRoute.POST(
      await post('http://localhost/api/itineraries/any/stays/0/move', { direction: 'down' }),
      { params: Promise.resolve({ itineraryId: 'any', stayIndex: '0' }) }
    )
    expect(res.status).toBe(401)
  })

  it('POST /api/itineraries/seed creates a new itinerary seeded from route data', async () => {
    const routeData = [
      {
        date: '2026/9/25',
        weekDay: '星期五',
        dayNum: 1,
        overnight: '巴黎',
        plan: { morning: '巴黎圣母院', afternoon: '凯旋门', evening: '卢浮宫' },
        train: [],
      },
      {
        date: '2026/9/26',
        weekDay: '星期六',
        dayNum: 2,
        overnight: '巴黎',
        plan: { morning: '', afternoon: '', evening: '' },
        train: [],
      },
    ]
    const routeFile = path.join(tempDir, 'route.json')
    fs.writeFileSync(routeFile, JSON.stringify(routeData))
    process.env.ROUTE_DATA_PATH = path.relative(process.cwd(), routeFile)

    const seedRoute = await import('../../app/api/itineraries/seed/route')
    const res = await seedRoute.POST()

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.itinerary.name).toBe('Original seeded route')
    expect(body.itinerary.startDate).toBe('2026-09-25')
    expect(body.workspaceUrl).toContain(body.itinerary.id)

    const getRoute = await import('../../app/api/itineraries/[itineraryId]/route')
    const getRes = await getRoute.GET(
      new NextRequest(`http://localhost/api/itineraries/${body.itinerary.id}`),
      { params: Promise.resolve({ itineraryId: body.itinerary.id }) }
    )
    expect(getRes.status).toBe(200)
    const workspace = await getRes.json()
    expect(workspace.days).toHaveLength(2)
    expect(workspace.days[0].overnight).toBe('巴黎')
    expect(workspace.days[0].plan.morning).toBe('巴黎圣母院')
    expect(workspace.stays[0].city).toBe('巴黎')
    expect(workspace.stays[0].nights).toBe(2)
  })

  it('POST /api/itineraries/seed returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const seedRoute = await import('../../app/api/itineraries/seed/route')
    const res = await seedRoute.POST()
    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe('UNAUTHORIZED')
  })

  it('POST /api/itineraries/seed returns 404 SEED_EMPTY when route data is empty', async () => {
    const routeFile = path.join(tempDir, 'empty-route.json')
    fs.writeFileSync(routeFile, JSON.stringify([]))
    process.env.ROUTE_DATA_PATH = path.relative(process.cwd(), routeFile)

    const seedRoute = await import('../../app/api/itineraries/seed/route')
    const res = await seedRoute.POST()
    expect(res.status).toBe(404)
    expect((await res.json()).error).toBe('SEED_EMPTY')
  })

  it('returns 400 STAY_LOCATION_INVALID for provider-specific location payloads', async () => {
    const createRoute = await import('../../app/api/itineraries/route')
    const createRes = await createRoute.POST(await post('http://localhost/api/itineraries', { startDate: '2026-04-01' }))
    const itineraryId = (await createRes.json()).itinerary.id as string

    const appendRoute = await import('../../app/api/itineraries/[itineraryId]/stays/route')
    const appendRes = await appendRoute.POST(
      await post(`http://localhost/api/itineraries/${itineraryId}/stays`, {
        nights: 1,
        location: {
          kind: 'geonames',
          label: 'Paris',
          queryText: 'Paris',
          coordinates: { lat: 48.85, lng: 2.35 },
          place: {
            geonameId: 2988507,
            name: 'Paris',
          },
        },
      }),
      { params: Promise.resolve({ itineraryId }) }
    )

    expect(appendRes.status).toBe(400)
    expect((await appendRes.json()).error).toBe('STAY_LOCATION_INVALID')
  })
})
