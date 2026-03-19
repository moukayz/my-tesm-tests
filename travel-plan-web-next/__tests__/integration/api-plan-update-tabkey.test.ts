/**
 * @jest-environment node
 *
 * Tier 2 tests for the tabKey extension of POST /api/plan-update.
 * Covers: tabKey default, tabKey='route-test', invalid tabKey.
 *
 * NOTE: uses jest.resetModules() + dynamic import pattern consistent with
 * the rest of the integration test suite.
 */
import { NextRequest } from 'next/server'

const mockAuth = jest.fn()

// Declare the mock store inside the module-level scope
const mockStore = {
  getAll: jest.fn(),
  updatePlan: jest.fn(),
  updateTrain: jest.fn(),
  updateDays: jest.fn(),
}

// Capture getRouteStore calls — we spy on it via a wrapper
const mockGetRouteStoreCalls: string[] = []

jest.mock('../../auth', () => ({ auth: mockAuth }))
// The mock factory must not capture external variables (Jest limitation).
// We use a spy-able wrapper captured inside the factory closure.
jest.mock('../../app/lib/routeStore', () => {
  const getRouteStore = jest.fn(() => ({
    getAll: jest.fn().mockResolvedValue([{
      date: '2026/9/25', weekDay: '星期五', dayNum: 1,
      overnight: '巴黎',
      plan: { morning: 'M1', afternoon: 'A1', evening: 'E1' },
      train: [],
    }]),
    updatePlan: jest.fn().mockImplementation(async (_dayIndex: number, plan: unknown) => ({
      date: '2026/9/25', dayNum: 1, plan
    })),
    updateTrain: jest.fn(),
    updateDays: jest.fn(),
  }))
  return { getRouteStore, VALID_TAB_KEYS: ['route', 'route-test'] }
})

const mockRouteData = [
  {
    date: '2026/9/25',
    weekDay: '星期五',
    dayNum: 1,
    overnight: '巴黎',
    plan: { morning: 'M1', afternoon: 'A1', evening: 'E1' },
    train: [],
  },
]

describe("POST /api/plan-update — tabKey extension", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  let getRouteStoreMock: jest.Mock

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

  beforeEach(async () => {
    jest.resetModules()
    mockAuth.mockReset()
    mockGetRouteStoreCalls.length = 0

    // Re-get the mock after resetModules
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const routeStoreModule = await import('../../app/lib/routeStore')
    getRouteStoreMock = routeStoreModule.getRouteStore as jest.Mock
    getRouteStoreMock.mockClear()

    // Default: authenticated
    mockAuth.mockResolvedValue({ user: { email: 'test@example.com' } })
    getRouteStoreMock.mockReturnValue({
      getAll: jest.fn().mockResolvedValue(JSON.parse(JSON.stringify(mockRouteData))),
      updatePlan: jest.fn().mockImplementation(async (dayIndex: number, plan: unknown) => ({
        ...mockRouteData[dayIndex],
        plan,
      })),
      updateTrain: jest.fn(),
      updateDays: jest.fn(),
    })
  })

  it("calls getRouteStore with 'route' when tabKey is omitted (backward compat)", async () => {
    const handler = await getHandler()
    await handler(makeRequest({ dayIndex: 0, plan: { morning: 'a', afternoon: 'b', evening: 'c' } }))
    expect(getRouteStoreMock).toHaveBeenCalledWith('route')
  })

  it("calls getRouteStore with 'route' when tabKey='route' is explicit", async () => {
    const handler = await getHandler()
    await handler(makeRequest({ tabKey: 'route', dayIndex: 0, plan: { morning: 'a', afternoon: 'b', evening: 'c' } }))
    expect(getRouteStoreMock).toHaveBeenCalledWith('route')
  })

  it("calls getRouteStore with 'route-test' when tabKey='route-test'", async () => {
    const handler = await getHandler()
    await handler(makeRequest({ tabKey: 'route-test', dayIndex: 0, plan: { morning: 'a', afternoon: 'b', evening: 'c' } }))
    expect(getRouteStoreMock).toHaveBeenCalledWith('route-test')
  })

  it("returns 400 with error 'invalid_tab_key' when tabKey is an invalid value", async () => {
    const handler = await getHandler()
    const res = await handler(makeRequest({ tabKey: 'bad-tab', dayIndex: 0, plan: { morning: 'a', afternoon: 'b', evening: 'c' } }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('invalid_tab_key')
  })

  it("returns 400 with error 'invalid_tab_key' when tabKey is empty string", async () => {
    const handler = await getHandler()
    const res = await handler(makeRequest({ tabKey: '', dayIndex: 0, plan: { morning: 'a', afternoon: 'b', evening: 'c' } }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('invalid_tab_key')
  })

  it("returns 200 for route-test tabKey with valid body", async () => {
    const handler = await getHandler()
    const res = await handler(makeRequest({ tabKey: 'route-test', dayIndex: 0, plan: { morning: 'a', afternoon: 'b', evening: 'c' } }))
    expect(res.status).toBe(200)
  })

  it("existing callers without tabKey still get 200 (backward compat smoke)", async () => {
    const handler = await getHandler()
    const res = await handler(makeRequest({ dayIndex: 0, plan: { morning: 'a', afternoon: 'b', evening: 'c' } }))
    expect(res.status).toBe(200)
  })
})
