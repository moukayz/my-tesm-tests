/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'

const mockAuth = jest.fn()
const mockGetRouteStore = jest.fn()
const mockRouteStore = {
  getAll: jest.fn(),
  updatePlan: jest.fn(),
  updateTrain: jest.fn(),
  updateAttractions: jest.fn(),
  updateDays: jest.fn(),
}

jest.mock('../../auth', () => ({ auth: mockAuth }))
jest.mock('../../app/lib/routeStore', () => ({
  getRouteStore: mockGetRouteStore,
  VALID_TAB_KEYS: ['route'] as const,
}))

const mockRouteData = [
  {
    date: '2026/9/25',
    weekDay: '星期五',
    dayNum: 1,
    overnight: '巴黎',
    plan: { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' },
    train: [],
  },
  {
    date: '2026/9/26',
    weekDay: '星期六',
    dayNum: 2,
    overnight: '巴黎',
    plan: { morning: 'Day 2 morning', afternoon: 'Day 2 afternoon', evening: 'Day 2 evening' },
    train: [],
  },
]

const validAttractions = [
  { id: 'geonames:2988507', label: 'Eiffel Tower', coordinates: { lat: 48.858, lng: 2.294 } },
  { id: 'geonames:2989049', label: 'Notre-Dame' },
]

describe('POST /api/attraction-update', () => {
  async function getHandler() {
    const mod = await import('../../app/api/attraction-update/route')
    return mod.POST
  }

  function makeRequest(body: unknown) {
    return new NextRequest('http://localhost/api/attraction-update', {
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
    mockRouteStore.updateAttractions.mockReset()

    mockAuth.mockResolvedValue({ user: { email: 'test@example.com' } })
    mockGetRouteStore.mockReturnValue(mockRouteStore)
    mockRouteStore.getAll.mockResolvedValue(JSON.parse(JSON.stringify(mockRouteData)))
    mockRouteStore.updateAttractions.mockImplementation(async (dayIndex: number, attractions: unknown) => ({
      ...mockRouteData[dayIndex],
      attractions,
    }))
  })

  it.each([null, {}])('returns 401 when session is not usable (%p)', async (session) => {
    mockAuth.mockResolvedValue(session)
    const handler = await getHandler()
    const res = await handler(makeRequest({ dayIndex: 0, attractions: validAttractions }))
    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe('Unauthorized')
  })

  it('returns 200 and the updated day on a valid request', async () => {
    const handler = await getHandler()
    const res = await handler(makeRequest({ dayIndex: 0, attractions: validAttractions }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.attractions).toEqual(validAttractions)
    expect(mockRouteStore.updateAttractions).toHaveBeenCalledWith(0, validAttractions)
  })

  it('accepts an empty attractions array (clearing all)', async () => {
    const handler = await getHandler()
    const res = await handler(makeRequest({ dayIndex: 0, attractions: [] }))
    expect(res.status).toBe(200)
    expect(mockRouteStore.updateAttractions).toHaveBeenCalledWith(0, [])
  })

  it.each([
    { dayIndex: 'bad', attractions: validAttractions },
    { dayIndex: -1, attractions: validAttractions },
    { dayIndex: 100, attractions: validAttractions },
    { dayIndex: 0, attractions: 'not-an-array' },
    { dayIndex: 0, attractions: [{ id: '', label: 'Ok' }] },
    { dayIndex: 0, attractions: [{ id: 'x', label: '' }] },
    { dayIndex: 0, attractions: [{ id: 'x'.repeat(81), label: 'Ok' }] },
    { dayIndex: 0, attractions: [{ id: 'x', label: 'Ok', coordinates: { lat: 'bad', lng: 2 } }] },
  ])('returns 400 for invalid body: %p', async (body) => {
    const handler = await getHandler()
    const res = await handler(makeRequest(body))
    expect(res.status).toBe(400)
    expect(mockRouteStore.updateAttractions).not.toHaveBeenCalled()
  })

  it('returns 400 on invalid JSON body', async () => {
    const handler = await getHandler()
    const req = new NextRequest('http://localhost/api/attraction-update', {
      method: 'POST',
      body: 'not json',
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await handler(req)
    expect(res.status).toBe(400)
  })

  it('returns 500 when store throws', async () => {
    mockRouteStore.updateAttractions.mockRejectedValueOnce(new Error('write failed'))
    const handler = await getHandler()
    const res = await handler(makeRequest({ dayIndex: 0, attractions: validAttractions }))
    expect(res.status).toBe(500)
    expect((await res.json()).error).toMatch(/Internal server error/)
  })
})
