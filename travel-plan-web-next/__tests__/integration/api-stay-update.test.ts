/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import type { RouteDay } from '../../app/lib/itinerary'

const mockAuth = jest.fn()
const mockGetRouteStore = jest.fn()
const mockRouteStore = {
  getAll: jest.fn(),
  updatePlan: jest.fn(),
  updateTrain: jest.fn(),
  updateDays: jest.fn(),
}
const mockRouteTestStore = {
  getAll: jest.fn(),
  updatePlan: jest.fn(),
  updateTrain: jest.fn(),
  updateDays: jest.fn(),
}

jest.mock('../../auth', () => ({ auth: mockAuth }))
jest.mock('../../app/lib/routeStore', () => ({
  getRouteStore: mockGetRouteStore,
  VALID_TAB_KEYS: ['route', 'route-test'] as const,
}))

function makeRouteData(): RouteDay[] {
  const result: RouteDay[] = []
  for (let i = 0; i < 4; i++) {
    result.push({
      date: `2026/9/${i + 25}`,
      weekDay: 'Mon',
      dayNum: i + 1,
      overnight: 'Paris',
      plan: { morning: '', afternoon: '', evening: '' },
      train: [],
    })
  }
  for (let i = 0; i < 3; i++) {
    result.push({
      date: `2026/9/${i + 29}`,
      weekDay: 'Mon',
      dayNum: i + 5,
      overnight: 'Lyon',
      plan: { morning: '', afternoon: '', evening: '' },
      train: [],
    })
  }
  return result
}

describe('POST /api/stay-update', () => {
  async function getHandler() {
    const mod = await import('../../app/api/stay-update/route')
    return mod.POST
  }

  function makeRequest(body: unknown) {
    return new NextRequest('http://localhost/api/stay-update', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    })
  }

  beforeEach(() => {
    jest.resetModules()
    mockAuth.mockReset()
    mockGetRouteStore.mockReset()
    mockRouteStore.getAll.mockReset()
    mockRouteStore.updateDays.mockReset()
    mockRouteTestStore.getAll.mockReset()
    mockRouteTestStore.updateDays.mockReset()

    mockAuth.mockResolvedValue({ user: { email: 'test@example.com' } })
    mockGetRouteStore.mockImplementation((tabKey: string) => {
      if (tabKey === 'route-test') return mockRouteTestStore
      return mockRouteStore
    })

    const data = makeRouteData()
    mockRouteStore.getAll.mockResolvedValue(JSON.parse(JSON.stringify(data)))
    mockRouteStore.updateDays.mockImplementation(async (days: RouteDay[]) => days)
    mockRouteTestStore.getAll.mockResolvedValue(JSON.parse(JSON.stringify(data)))
    mockRouteTestStore.updateDays.mockImplementation(async (days: RouteDay[]) => days)
  })

  it.each([null, {}])('returns 401 when session is not usable (%p)', async (session) => {
    mockAuth.mockResolvedValue(session)
    const handler = await getHandler()
    const res = await handler(makeRequest({ tabKey: 'route', stayIndex: 0, newNights: 2 }))
    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe('Unauthorized')
  })

  it.each([
    [{ stayIndex: 0, newNights: 2 }, 'invalid_tab_key'],
    [{ tabKey: 'bad', stayIndex: 0, newNights: 2 }, 'invalid_tab_key'],
    [{ tabKey: 'route', newNights: 2 }, 'invalid_stay_index'],
    [{ tabKey: 'route', stayIndex: 1.5, newNights: 2 }, 'invalid_stay_index'],
    [{ tabKey: 'route', stayIndex: 1, newNights: 2 }, 'invalid_stay_index'],
    [{ tabKey: 'route', stayIndex: 0 }, 'invalid_new_nights'],
    [{ tabKey: 'route', stayIndex: 0, newNights: 1.5 }, 'invalid_new_nights'],
    [{ tabKey: 'route', stayIndex: 0, newNights: 0 }, 'invalid_new_nights'],
    [{ tabKey: 'route', stayIndex: 0, newNights: 7 }, 'next_stay_exhausted'],
  ])('returns 400 %s for invalid request body', async (body, error) => {
    const handler = await getHandler()
    const res = await handler(makeRequest(body))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe(error)
    expect(mockRouteStore.updateDays).not.toHaveBeenCalled()
    expect(mockRouteTestStore.updateDays).not.toHaveBeenCalled()
  })

  it.each([
    ['route', mockRouteStore, mockRouteTestStore],
    ['route-test', mockRouteTestStore, mockRouteStore],
  ])('returns 200 and persists into the correct store for tabKey=%s', async (tabKey, expectedStore, otherStore) => {
    const handler = await getHandler()
    const res = await handler(makeRequest({ tabKey, stayIndex: 0, newNights: 2 }))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.updatedDays).toHaveLength(7)
    expect(body.updatedDays.slice(0, 2).every((d: RouteDay) => d.overnight === 'Paris')).toBe(true)
    expect(body.updatedDays.slice(2).every((d: RouteDay) => d.overnight === 'Lyon')).toBe(true)

    expect(expectedStore.updateDays).toHaveBeenCalledTimes(1)
    expect(otherStore.updateDays).not.toHaveBeenCalled()
  })

  it('returns 200 for a valid extend operation', async () => {
    const handler = await getHandler()
    const res = await handler(makeRequest({ tabKey: 'route', stayIndex: 0, newNights: 6 }))
    expect(res.status).toBe(200)
    const body = await res.json()
    const days: RouteDay[] = body.updatedDays
    expect(days.slice(0, 6).every((d) => d.overnight === 'Paris')).toBe(true)
    expect(days.slice(6).every((d) => d.overnight === 'Lyon')).toBe(true)
  })

  it('returns 500 when store.getAll throws', async () => {
    mockRouteStore.getAll.mockRejectedValueOnce(new Error('read failure'))
    const handler = await getHandler()
    const res = await handler(makeRequest({ tabKey: 'route', stayIndex: 0, newNights: 2 }))
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe('internal_error')
  })

  it('returns 500 when store.updateDays throws', async () => {
    mockRouteStore.updateDays.mockRejectedValueOnce(new Error('write failure'))
    const handler = await getHandler()
    const res = await handler(makeRequest({ tabKey: 'route', stayIndex: 0, newNights: 2 }))
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe('internal_error')
  })

  it('returns 400 on malformed JSON body', async () => {
    const handler = await getHandler()
    const req = new NextRequest('http://localhost/api/stay-update', {
      method: 'POST',
      body: 'not-json',
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await handler(req)
    expect(res.status).toBe(400)
  })
})
