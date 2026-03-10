/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'

const mockGetIronSession = jest.fn()
const mockCookies = jest.fn()

jest.mock('iron-session', () => ({
  getIronSession: mockGetIronSession,
}))

jest.mock('next/headers', () => ({
  cookies: mockCookies,
}))

jest.mock('fs', () => ({
  readFileSync: jest.fn().mockReturnValue(JSON.stringify([{ plan: {} }])),
  writeFileSync: jest.fn(),
}))

process.env.SESSION_SECRET = 'test-secret-at-least-32-characters!!'

describe('POST /api/plan-update — auth guard', () => {
  async function getHandler() {
    const mod = await import('../../app/api/plan-update/route')
    return mod.POST
  }

  beforeEach(() => {
    jest.resetModules()
    mockGetIronSession.mockClear()
    mockCookies.mockClear()
  })

  function makeRequest(body: unknown) {
    return new NextRequest('http://localhost/api/plan-update', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    })
  }

  it('returns 401 when isLoggedIn is false', async () => {
    mockCookies.mockResolvedValue({})
    mockGetIronSession.mockResolvedValue({ isLoggedIn: false })

    const handler = await getHandler()
    const res = await handler(makeRequest({ dayIndex: 0, plan: { morning: 'a', afternoon: 'b', evening: 'c' } }))

    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe('Unauthorized')
  })

  it('returns 401 when session has no isLoggedIn flag', async () => {
    mockCookies.mockResolvedValue({})
    mockGetIronSession.mockResolvedValue({})

    const handler = await getHandler()
    const res = await handler(makeRequest({ dayIndex: 0, plan: { morning: 'a', afternoon: 'b', evening: 'c' } }))

    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe('Unauthorized')
  })
})
