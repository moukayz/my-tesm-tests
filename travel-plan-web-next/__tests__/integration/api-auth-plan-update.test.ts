/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'

const mockAuth = jest.fn()
const mockStore = {
  getAll: jest.fn().mockResolvedValue([{ date: '2026/9/25', dayNum: 1, plan: {} }]),
  updatePlan: jest.fn().mockResolvedValue({ date: '2026/9/25', dayNum: 1, plan: {} }),
  updateTrain: jest.fn(),
  updateDays: jest.fn(),
}

jest.mock('../../auth', () => ({ auth: mockAuth }))
jest.mock('../../app/lib/routeStore', () => ({ getRouteStore: () => mockStore }))

describe('POST /api/plan-update — auth guard', () => {
  async function getHandler() {
    const mod = await import('../../app/api/plan-update/route')
    return mod.POST
  }

  beforeEach(() => {
    jest.resetModules()
    mockAuth.mockClear()
    mockStore.getAll.mockClear()
    mockStore.updatePlan.mockClear()
  })

  function makeRequest(body: unknown) {
    return new NextRequest('http://localhost/api/plan-update', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    })
  }

  it('returns 401 when auth returns null (unauthenticated)', async () => {
    mockAuth.mockResolvedValue(null)
    const handler = await getHandler()
    const res = await handler(makeRequest({ dayIndex: 0, plan: { morning: 'a', afternoon: 'b', evening: 'c' } }))
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe('Unauthorized')
  })

  it('returns 401 when auth returns session without user', async () => {
    mockAuth.mockResolvedValue({})
    const handler = await getHandler()
    const res = await handler(makeRequest({ dayIndex: 0, plan: { morning: 'a', afternoon: 'b', evening: 'c' } }))
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe('Unauthorized')
  })

  it('returns 200 when authenticated', async () => {
    mockAuth.mockResolvedValue({ user: { email: 'test@gmail.com' } })
    mockStore.getAll.mockResolvedValue([{ date: '2026/9/25', dayNum: 1, plan: {} }])
    mockStore.updatePlan.mockResolvedValue({ date: '2026/9/25', dayNum: 1, plan: { morning: 'a', afternoon: 'b', evening: 'c' } })
    const handler = await getHandler()
    const res = await handler(makeRequest({ dayIndex: 0, plan: { morning: 'a', afternoon: 'b', evening: 'c' } }))
    expect(res.status).toBe(200)
  })
})
