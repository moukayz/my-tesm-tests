/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'

const mockAuth = jest.fn()
const mockGetRouteStore = jest.fn()
const mockRouteStore = {
  getAll: jest.fn(),
  updateNote: jest.fn(),
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

describe('POST /api/note-update', () => {
  async function getHandler() {
    const mod = await import('../../app/api/note-update/route')
    return mod.POST
  }

  function makeRequest(body: unknown) {
    return new NextRequest('http://localhost/api/note-update', {
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
    mockRouteStore.updateNote.mockReset()

    // Default: authenticated
    mockAuth.mockResolvedValue({ user: { email: 'test@example.com' } })

    mockGetRouteStore.mockReturnValue(mockRouteStore)

    mockRouteStore.getAll.mockResolvedValue(JSON.parse(JSON.stringify(mockRouteData)))
    mockRouteStore.updateNote.mockImplementation(async (dayIndex: number, note: string) => ({
      ...mockRouteData[dayIndex],
      note,
    }))
  })

  it.each([null, {}])('returns 401 when session is not usable (%p)', async (session) => {
    mockAuth.mockResolvedValue(session)
    const handler = await getHandler()
    const res = await handler(makeRequest({ dayIndex: 0, note: 'some note' }))
    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe('Unauthorized')
  })

  it('returns 200 and the updated day on a valid request', async () => {
    const handler = await getHandler()
    const note = 'My travel note for day 1'
    const res = await handler(makeRequest({ dayIndex: 0, note }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.note).toBe(note)
    expect(mockGetRouteStore).toHaveBeenCalledWith()
    expect(mockRouteStore.updateNote).toHaveBeenCalledWith(0, note)
  })

  it.each([
    { tabKey: 'bad-tab', dayIndex: 0, note: 'hello' },
    { tabKey: '', dayIndex: 0, note: 'hello' },
  ])('returns 400 invalid_tab_key for invalid tabKey', async (body) => {
    const handler = await getHandler()
    const res = await handler(makeRequest(body))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('invalid_tab_key')
    expect(mockRouteStore.updateNote).not.toHaveBeenCalled()
  })

  it.each([
    { dayIndex: 'bad', note: 'hello' },
    { dayIndex: -1, note: 'hello' },
    { dayIndex: 100, note: 'hello' },
    { dayIndex: 0, note: 42 },
    { dayIndex: 0 },
  ])('returns 400 for invalid request body: %p', async (body) => {
    const handler = await getHandler()
    const res = await handler(makeRequest(body))
    expect(res.status).toBe(400)
    expect(mockRouteStore.updateNote).not.toHaveBeenCalled()
  })

  it('returns 400 on invalid JSON body', async () => {
    const handler = await getHandler()
    const req = new NextRequest('http://localhost/api/note-update', {
      method: 'POST',
      body: 'not json',
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await handler(req)
    expect(res.status).toBe(400)
  })

  it('returns 500 when store throws', async () => {
    mockRouteStore.updateNote.mockRejectedValueOnce(new Error('write failed'))
    const handler = await getHandler()
    const res = await handler(makeRequest({ dayIndex: 0, note: 'hello' }))
    expect(res.status).toBe(500)
    expect((await res.json()).error).toMatch(/Internal server error/)
  })

  it('accepts empty string as a valid note (clears note)', async () => {
    const handler = await getHandler()
    const res = await handler(makeRequest({ dayIndex: 0, note: '' }))
    expect(res.status).toBe(200)
    expect(mockRouteStore.updateNote).toHaveBeenCalledWith(0, '')
  })
})
