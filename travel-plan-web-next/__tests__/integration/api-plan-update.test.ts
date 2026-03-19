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

const mockRouteData = [
  {
    date: '2026/9/25',
    weekDay: '星期五',
    dayNum: 1,
    overnight: '巴黎',
    plan: { morning: 'Morning activity', afternoon: 'Afternoon activity', evening: 'Evening activity' },
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

describe('POST /api/plan-update', () => {
  async function getHandler() {
    const mod = await import('../../app/api/plan-update/route')
    return mod.POST
  }

  function makeRequest(body: unknown) {
    return new NextRequest('http://localhost/api/plan-update', {
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
    mockRouteStore.updatePlan.mockReset()
    mockRouteTestStore.getAll.mockReset()
    mockRouteTestStore.updatePlan.mockReset()

    // Default: authenticated
    mockAuth.mockResolvedValue({ user: { email: 'test@example.com' } })

    mockGetRouteStore.mockImplementation((tabKey: string) => {
      if (tabKey === 'route-test') {
        return mockRouteTestStore
      }
      return mockRouteStore
    })

    mockRouteStore.getAll.mockResolvedValue(JSON.parse(JSON.stringify(mockRouteData)))
    mockRouteStore.updatePlan.mockImplementation(async (dayIndex, plan) => ({
      ...mockRouteData[dayIndex],
      plan,
    }))

    mockRouteTestStore.getAll.mockResolvedValue(JSON.parse(JSON.stringify(mockRouteData)))
    mockRouteTestStore.updatePlan.mockImplementation(async (dayIndex, plan) => ({
      ...mockRouteData[dayIndex],
      plan,
    }))
  })

  it.each([null, {}])('returns 401 when session is not usable (%p)', async (session) => {
    mockAuth.mockResolvedValue(session)
    const handler = await getHandler()
    const res = await handler(makeRequest({ dayIndex: 0, plan: { morning: 'a', afternoon: 'b', evening: 'c' } }))
    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe('Unauthorized')
  })

  it('returns 200 and the updated day on a valid request', async () => {
    const handler = await getHandler()
    const plan = { morning: 'Updated A', afternoon: 'Updated B', evening: 'Updated C' }
    const res = await handler(makeRequest({ dayIndex: 0, plan }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.plan).toEqual(plan)
    expect(mockGetRouteStore).toHaveBeenCalledWith('route')
    expect(mockRouteStore.updatePlan).toHaveBeenCalledWith(0, plan)
  })

  it("uses route-test store when tabKey='route-test'", async () => {
    const handler = await getHandler()
    const res = await handler(makeRequest({ tabKey: 'route-test', dayIndex: 1, plan: { morning: 'x', afternoon: 'y', evening: 'z' } }))
    expect(res.status).toBe(200)
    expect(mockGetRouteStore).toHaveBeenCalledWith('route-test')
    expect(mockRouteTestStore.updatePlan).toHaveBeenCalledWith(1, { morning: 'x', afternoon: 'y', evening: 'z' })
    expect(mockRouteStore.updatePlan).not.toHaveBeenCalled()
  })

  it.each([
    { tabKey: 'bad-tab', dayIndex: 0, plan: { morning: 'a', afternoon: 'b', evening: 'c' } },
    { tabKey: '', dayIndex: 0, plan: { morning: 'a', afternoon: 'b', evening: 'c' } },
  ])('returns 400 invalid_tab_key for invalid tabKey', async (body) => {
    const handler = await getHandler()
    const res = await handler(makeRequest(body))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('invalid_tab_key')
    expect(mockRouteStore.updatePlan).not.toHaveBeenCalled()
  })

  it.each([
    { dayIndex: 'bad', plan: { morning: 'a', afternoon: 'b', evening: 'c' } },
    { dayIndex: 0, plan: { morning: 'a', afternoon: 'b' } },
    { dayIndex: -1, plan: { morning: 'a', afternoon: 'b', evening: 'c' } },
    { dayIndex: 100, plan: { morning: 'a', afternoon: 'b', evening: 'c' } },
  ])('returns 400 for invalid request body: %p', async (body) => {
    const handler = await getHandler()
    const res = await handler(makeRequest(body))
    expect(res.status).toBe(400)
    expect(mockRouteStore.updatePlan).not.toHaveBeenCalled()
  })

  it('returns 400 on invalid JSON body', async () => {
    const handler = await getHandler()
    const req = new NextRequest('http://localhost/api/plan-update', {
      method: 'POST',
      body: 'not json',
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await handler(req)
    expect(res.status).toBe(400)
  })

  it('returns 500 when store throws', async () => {
    mockRouteStore.updatePlan.mockRejectedValueOnce(new Error('write failed'))
    const handler = await getHandler()
    const res = await handler(makeRequest({ dayIndex: 0, plan: { morning: 'a', afternoon: 'b', evening: 'c' } }))
    expect(res.status).toBe(500)
    expect((await res.json()).error).toMatch(/Internal server error/)
  })
})
