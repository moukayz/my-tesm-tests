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
    train: [{ train_id: 'ICE100', start: 'berlin', end: 'munich' }],
  },
  {
    date: '2026/9/26',
    weekDay: '星期六',
    dayNum: 2,
    overnight: '巴黎',
    plan: { morning: 'Day 2 morning', afternoon: 'Day 2 afternoon', evening: 'Day 2 evening' },
    train: [],
  },
  {
    date: '2026/9/27',
    weekDay: '星期日',
    dayNum: 3,
    overnight: '里昂',
    plan: { morning: 'Day 3 morning', afternoon: 'Day 3 afternoon', evening: 'Day 3 evening' },
    train: [{ train_id: 'TGV200', start: 'paris', end: 'lyon' }],
  },
]

describe('POST /api/train-update', () => {
  async function getHandler() {
    const mod = await import('../../app/api/train-update/route')
    return mod.POST
  }

  function makeRequest(body: unknown) {
    return new NextRequest('http://localhost/api/train-update', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    })
  }

  beforeEach(() => {
    jest.resetModules()
    mockAuth.mockReset()
    mockStore.getAll.mockReset()
    mockStore.updateTrain.mockReset()

    // Default: authenticated
    mockAuth.mockResolvedValue({ user: { email: 'test@example.com' } })
    mockStore.getAll.mockResolvedValue(JSON.parse(JSON.stringify(mockRouteData)))
    mockStore.updateTrain.mockImplementation(async (dayIndex: number, train: unknown) => ({
      ...mockRouteData[dayIndex],
      train,
    }))
  })

  // 1. Auth required → 401 if no session
  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const handler = await getHandler()
    const res = await handler(
      makeRequest({ dayIndex: 0, trainJson: '[]' })
    )
    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe('Unauthorized')
  })

  // 2. dayIndex must be a number → 400 if missing / wrong type
  it('returns 400 when dayIndex is missing', async () => {
    const handler = await getHandler()
    const res = await handler(makeRequest({ trainJson: '[]' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/dayIndex/)
  })

  it('returns 400 when dayIndex is not a number', async () => {
    const handler = await getHandler()
    const res = await handler(makeRequest({ dayIndex: 'bad', trainJson: '[]' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/dayIndex/)
  })

  // 3. trainJson must be a string → 400 if missing / wrong type
  it('returns 400 when trainJson is missing', async () => {
    const handler = await getHandler()
    const res = await handler(makeRequest({ dayIndex: 0 }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/trainJson/)
  })

  it('returns 400 when trainJson is not a string', async () => {
    const handler = await getHandler()
    const res = await handler(makeRequest({ dayIndex: 0, trainJson: 123 }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/trainJson/)
  })

  // 4. trainJson must be valid JSON → 400
  it('returns 400 when trainJson is not valid JSON', async () => {
    const handler = await getHandler()
    const res = await handler(makeRequest({ dayIndex: 0, trainJson: '{bad json' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/Invalid JSON/)
  })

  // 5. Parsed value must be an array → 400
  it('returns 400 when trainJson is valid JSON but not an array', async () => {
    const handler = await getHandler()
    const res = await handler(makeRequest({ dayIndex: 0, trainJson: '{}' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Train data must be an array')
  })

  // 6. Each element must have a non-empty string train_id → 400
  it('returns 400 when an array element lacks train_id', async () => {
    const handler = await getHandler()
    const res = await handler(
      makeRequest({ dayIndex: 0, trainJson: '[{"start":"a","end":"b"}]' })
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Each train entry must have a string train_id')
  })

  it('returns 400 when train_id is empty string', async () => {
    const handler = await getHandler()
    const res = await handler(
      makeRequest({ dayIndex: 0, trainJson: '[{"train_id":""}]' })
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Each train entry must have a string train_id')
  })

  it('returns 400 when train_id is not a string', async () => {
    const handler = await getHandler()
    const res = await handler(
      makeRequest({ dayIndex: 0, trainJson: '[{"train_id":123}]' })
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Each train entry must have a string train_id')
  })

  // 7. dayIndex must be in range → 400
  it('returns 400 when dayIndex is out of range (too large)', async () => {
    const handler = await getHandler()
    const res = await handler(
      makeRequest({ dayIndex: 100, trainJson: '[{"train_id":"ICE1"}]' })
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe(`Invalid dayIndex: must be between 0 and ${mockRouteData.length - 1}`)
  })

  it('returns 400 when dayIndex is negative', async () => {
    const handler = await getHandler()
    const res = await handler(
      makeRequest({ dayIndex: -1, trainJson: '[{"train_id":"ICE1"}]' })
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe(`Invalid dayIndex: must be between 0 and ${mockRouteData.length - 1}`)
  })

  // 8. 200 success — returns updated day with new train array
  it('returns 200 and the updated day on a valid request', async () => {
    const handler = await getHandler()
    const trainArray = [{ train_id: 'ICE123', start: 'cologne', end: 'munich' }]
    const trainJson = JSON.stringify(trainArray)
    const res = await handler(makeRequest({ dayIndex: 2, trainJson }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.train).toEqual(trainArray)
    expect(mockStore.updateTrain).toHaveBeenCalledWith(2, trainArray)
  })

  // 9. 200 with empty array [] — valid (a day with no trains)
  it('returns 200 with empty train array', async () => {
    const handler = await getHandler()
    const res = await handler(makeRequest({ dayIndex: 1, trainJson: '[]' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.train).toEqual([])
    expect(mockStore.updateTrain).toHaveBeenCalledWith(1, [])
  })

  // Additional: 500 on internal error
  it('returns 500 when store throws', async () => {
    mockStore.updateTrain.mockRejectedValue(new Error('disk full'))
    const handler = await getHandler()
    const res = await handler(
      makeRequest({ dayIndex: 0, trainJson: '[{"train_id":"ICE1"}]' })
    )
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toMatch(/Internal server error/)
  })
})
