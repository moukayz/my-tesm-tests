/**
 * @jest-environment node
 *
 * Tier 2 integration tests for POST /api/stay-update.
 * Covers all error paths from backend-design.md §9 api-stay-update.test.ts.
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

// 7 days: 4 in Paris + 3 in Lyon
function makeRouteData(): RouteDay[] {
  const result: RouteDay[] = []
  for (let i = 0; i < 4; i++) {
    result.push({
      date: `2026/9/${i + 25}`,
      weekDay: '星期一',
      dayNum: i + 1,
      overnight: '巴黎',
      plan: { morning: '', afternoon: '', evening: '' },
      train: [],
    })
  }
  for (let i = 0; i < 3; i++) {
    result.push({
      date: `2026/9/${i + 29}`,
      weekDay: '星期一',
      dayNum: i + 5,
      overnight: '里昂',
      plan: { morning: '', afternoon: '', evening: '' },
      train: [],
    })
  }
  return result
}

function makeThreeStayRouteData(): RouteDay[] {
  const days: RouteDay[] = []

  const pushDays = (overnight: string, count: number, startDayNum: number) => {
    for (let i = 0; i < count; i++) {
      days.push({
        date: `2026/9/${25 + days.length}`,
        weekDay: 'Mon',
        dayNum: startDayNum + i,
        overnight,
        plan: { morning: '', afternoon: '', evening: '' },
        train: [],
      })
    }
  }

  // A=4, B=2, C=1
  pushDays('A', 4, 1)
  pushDays('B', 2, 5)
  pushDays('C', 1, 7)
  return days
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

    // Default: authenticated
    mockAuth.mockResolvedValue({ user: { email: 'test@example.com' } })

    // Default getRouteStore: return route store for 'route', test store for 'route-test'
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

  // ── Auth ──────────────────────────────────────────────────────────────────

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const handler = await getHandler()
    const res = await handler(makeRequest({ tabKey: 'route', stayIndex: 0, newNights: 2 }))
    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe('Unauthorized')
  })

  it('returns 401 when session has no user', async () => {
    mockAuth.mockResolvedValue({})
    const handler = await getHandler()
    const res = await handler(makeRequest({ tabKey: 'route', stayIndex: 0, newNights: 2 }))
    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe('Unauthorized')
  })

  // ── tabKey validation ─────────────────────────────────────────────────────

  it("returns 400 invalid_tab_key when tabKey is missing", async () => {
    const handler = await getHandler()
    const res = await handler(makeRequest({ stayIndex: 0, newNights: 2 }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('invalid_tab_key')
  })

  it("returns 400 invalid_tab_key when tabKey is 'bad'", async () => {
    const handler = await getHandler()
    const res = await handler(makeRequest({ tabKey: 'bad', stayIndex: 0, newNights: 2 }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('invalid_tab_key')
  })

  it("returns 400 invalid_tab_key when tabKey is null", async () => {
    const handler = await getHandler()
    const res = await handler(makeRequest({ tabKey: null, stayIndex: 0, newNights: 2 }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('invalid_tab_key')
  })

  // ── stayIndex validation ──────────────────────────────────────────────────

  it("returns 400 invalid_stay_index when stayIndex is missing", async () => {
    const handler = await getHandler()
    const res = await handler(makeRequest({ tabKey: 'route', newNights: 2 }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('invalid_stay_index')
  })

  it("returns 400 invalid_stay_index when stayIndex is -1", async () => {
    const handler = await getHandler()
    const res = await handler(makeRequest({ tabKey: 'route', stayIndex: -1, newNights: 2 }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('invalid_stay_index')
  })

  it("returns 400 invalid_stay_index when stayIndex is not an integer (1.5)", async () => {
    const handler = await getHandler()
    const res = await handler(makeRequest({ tabKey: 'route', stayIndex: 1.5, newNights: 2 }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('invalid_stay_index')
  })

  it("returns 400 invalid_stay_index when stayIndex is the last stay", async () => {
    // Data has 2 stays → last valid stayIndex=1 is the last stay → invalid
    const handler = await getHandler()
    const res = await handler(makeRequest({ tabKey: 'route', stayIndex: 1, newNights: 2 }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('invalid_stay_index')
  })

  // ── newNights validation ──────────────────────────────────────────────────

  it("returns 400 invalid_new_nights when newNights is 0", async () => {
    const handler = await getHandler()
    const res = await handler(makeRequest({ tabKey: 'route', stayIndex: 0, newNights: 0 }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('invalid_new_nights')
  })

  it("returns 400 invalid_new_nights when newNights is -1", async () => {
    const handler = await getHandler()
    const res = await handler(makeRequest({ tabKey: 'route', stayIndex: 0, newNights: -1 }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('invalid_new_nights')
  })

  it("returns 400 invalid_new_nights when newNights is 1.5", async () => {
    const handler = await getHandler()
    const res = await handler(makeRequest({ tabKey: 'route', stayIndex: 0, newNights: 1.5 }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('invalid_new_nights')
  })

  it("returns 400 invalid_new_nights when newNights is missing", async () => {
    const handler = await getHandler()
    const res = await handler(makeRequest({ tabKey: 'route', stayIndex: 0 }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('invalid_new_nights')
  })

  // ── domain rule: next_stay_exhausted ─────────────────────────────────────

  it("returns 400 next_stay_exhausted when extending to reduce next stay below 1", async () => {
    // Paris=4, Lyon=3 → extend Paris to 7 → Lyon would be 0
    const handler = await getHandler()
    const res = await handler(makeRequest({ tabKey: 'route', stayIndex: 0, newNights: 7 }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('next_stay_exhausted')
  })

  // ── success paths ─────────────────────────────────────────────────────────

  it("returns 200 with updatedDays on valid shrink for tabKey='route'", async () => {
    const handler = await getHandler()
    const res = await handler(makeRequest({ tabKey: 'route', stayIndex: 0, newNights: 2 }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.updatedDays)).toBe(true)
    expect(body.updatedDays).toHaveLength(7) // total unchanged
  })

  it("returns 200 with updatedDays on valid shrink for tabKey='route-test'", async () => {
    const handler = await getHandler()
    const res = await handler(makeRequest({ tabKey: 'route-test', stayIndex: 0, newNights: 2 }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.updatedDays)).toBe(true)
    expect(body.updatedDays).toHaveLength(7)
  })

  it("updatedDays reflects correct overnight reassignment after shrink", async () => {
    const handler = await getHandler()
    // Shrink Paris from 4 → 2; Lyon should become 5
    const res = await handler(makeRequest({ tabKey: 'route', stayIndex: 0, newNights: 2 }))
    const body = await res.json()
    const days: RouteDay[] = body.updatedDays
    expect(days.slice(0, 2).every(d => d.overnight === '巴黎')).toBe(true)
    expect(days.slice(2).every(d => d.overnight === '里昂')).toBe(true)
  })

  it("calls updateDays on the correct store for tabKey='route'", async () => {
    const handler = await getHandler()
    await handler(makeRequest({ tabKey: 'route', stayIndex: 0, newNights: 2 }))
    expect(mockRouteStore.updateDays).toHaveBeenCalledTimes(1)
    expect(mockRouteTestStore.updateDays).not.toHaveBeenCalled()
  })

  it("calls updateDays on the correct store for tabKey='route-test'", async () => {
    const handler = await getHandler()
    await handler(makeRequest({ tabKey: 'route-test', stayIndex: 0, newNights: 2 }))
    expect(mockRouteTestStore.updateDays).toHaveBeenCalledTimes(1)
    expect(mockRouteStore.updateDays).not.toHaveBeenCalled()
  })

  // ── store failures ────────────────────────────────────────────────────────

  it("returns 500 internal_error when store.getAll throws", async () => {
    mockRouteStore.getAll.mockRejectedValue(new Error('read failure'))
    const handler = await getHandler()
    const res = await handler(makeRequest({ tabKey: 'route', stayIndex: 0, newNights: 2 }))
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe('internal_error')
  })

  it("returns 500 internal_error when store.updateDays throws", async () => {
    mockRouteStore.updateDays.mockRejectedValue(new Error('write failure'))
    const handler = await getHandler()
    const res = await handler(makeRequest({ tabKey: 'route', stayIndex: 0, newNights: 2 }))
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe('internal_error')
  })

  // ── invalid JSON body ─────────────────────────────────────────────────────

  it("returns 400 on malformed JSON body", async () => {
    const handler = await getHandler()
    const req = new NextRequest('http://localhost/api/stay-update', {
      method: 'POST',
      body: 'not-json',
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await handler(req)
    expect(res.status).toBe(400)
  })

  // ── tab isolation ─────────────────────────────────────────────────────────

  it("writing to route-test does not call the route store's updateDays", async () => {
    const handler = await getHandler()
    await handler(makeRequest({ tabKey: 'route-test', stayIndex: 0, newNights: 2 }))
    expect(mockRouteStore.updateDays).not.toHaveBeenCalled()
  })

  // ── extend scenario ───────────────────────────────────────────────────────

  it("returns 200 on valid extend (Paris 4→6, Lyon 3→1)", async () => {
    const handler = await getHandler()
    const res = await handler(makeRequest({ tabKey: 'route', stayIndex: 0, newNights: 6 }))
    expect(res.status).toBe(200)
    const body = await res.json()
    const days: RouteDay[] = body.updatedDays
    expect(days.slice(0, 6).every(d => d.overnight === '巴黎')).toBe(true)
    expect(days.slice(6).every(d => d.overnight === '里昂')).toBe(true)
  })

  it('persists edits so subsequent stayIndex validations use updated data', async () => {
    let persisted = makeThreeStayRouteData()
    mockRouteStore.getAll.mockImplementation(async () => JSON.parse(JSON.stringify(persisted)))
    mockRouteStore.updateDays.mockImplementation(async (days: RouteDay[]) => {
      persisted = JSON.parse(JSON.stringify(days))
      return days
    })

    const handler = await getHandler()

    // 1) Shrink stay A: A=4 -> 2, so B becomes 4 and C stays 1.
    const shrinkRes = await handler(makeRequest({ tabKey: 'route', stayIndex: 0, newNights: 2 }))
    expect(shrinkRes.status).toBe(200)

    // 2) Edit stay B to 3 nights.
    // If step (1) was not persisted, B would still be 2 and this would exhaust C (2->3 makes C=0) => 400.
    // With persisted state (B=4), this is valid (B=3, C=2) => 200.
    const secondRes = await handler(makeRequest({ tabKey: 'route', stayIndex: 1, newNights: 3 }))
    expect(secondRes.status).toBe(200)

    const body = await secondRes.json()
    const days: RouteDay[] = body.updatedDays
    expect(days.slice(0, 2).every((d) => d.overnight === 'A')).toBe(true)
    expect(days.slice(2, 5).every((d) => d.overnight === 'B')).toBe(true)
    expect(days.slice(5).every((d) => d.overnight === 'C')).toBe(true)
  })
})
