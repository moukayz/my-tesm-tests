/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'

const mockAuth = jest.fn()
const mockStore = {
  getAll: jest.fn(),
  updatePlan: jest.fn(),
  updateTrain: jest.fn(),
  updateDays: jest.fn(),
}

jest.mock('../../auth', () => ({ auth: mockAuth }))
jest.mock('../../app/lib/routeStore', () => ({ getRouteStore: () => mockStore }))

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
    mockStore.getAll.mockReset()
    mockStore.updatePlan.mockReset()

    // Default: authenticated
    mockAuth.mockResolvedValue({ user: { email: 'test@example.com' } })
    mockStore.getAll.mockResolvedValue(JSON.parse(JSON.stringify(mockRouteData)))
    mockStore.updatePlan.mockImplementation(async (dayIndex, plan) => ({
      ...mockRouteData[dayIndex],
      plan,
    }))
  })

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
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
    expect(mockStore.updatePlan).toHaveBeenCalledWith(0, plan)
  })

  it('returns 400 when dayIndex is not a number', async () => {
    const handler = await getHandler()
    const res = await handler(makeRequest({ dayIndex: 'bad', plan: { morning: 'a', afternoon: 'b', evening: 'c' } }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when plan is missing a field', async () => {
    const handler = await getHandler()
    const res = await handler(makeRequest({ dayIndex: 0, plan: { morning: 'a', afternoon: 'b' } }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when dayIndex is negative', async () => {
    const handler = await getHandler()
    const res = await handler(makeRequest({ dayIndex: -1, plan: { morning: 'a', afternoon: 'b', evening: 'c' } }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when dayIndex is out of bounds', async () => {
    const handler = await getHandler()
    const res = await handler(makeRequest({ dayIndex: 100, plan: { morning: 'a', afternoon: 'b', evening: 'c' } }))
    expect(res.status).toBe(400)
  })

  it('calls store.updatePlan with correct dayIndex and plan', async () => {
    const handler = await getHandler()
    const plan = { morning: 'M', afternoon: 'A', evening: 'E' }
    await handler(makeRequest({ dayIndex: 1, plan }))
    expect(mockStore.updatePlan).toHaveBeenCalledWith(1, plan)
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
})
