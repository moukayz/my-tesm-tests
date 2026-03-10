/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'

const mockDestroy = jest.fn()
const mockGetIronSession = jest.fn()
const mockCookies = jest.fn()

jest.mock('iron-session', () => ({
  getIronSession: mockGetIronSession,
}))

jest.mock('next/headers', () => ({
  cookies: mockCookies,
}))

process.env.SESSION_SECRET = 'test-secret-at-least-32-characters!!'

describe('POST /api/auth/logout', () => {
  async function getHandler() {
    const mod = await import('../../app/api/auth/logout/route')
    return mod.POST
  }

  beforeEach(() => {
    jest.resetModules()
    mockDestroy.mockClear()
    mockGetIronSession.mockClear()
    mockCookies.mockClear()
  })

  it('returns 200 and calls session.destroy() when logged in', async () => {
    const mockSession = { isLoggedIn: true, username: 'testuser', destroy: mockDestroy }
    mockCookies.mockResolvedValue({})
    mockGetIronSession.mockResolvedValue(mockSession)

    const handler = await getHandler()
    const req = new NextRequest('http://localhost/api/auth/logout', { method: 'POST' })
    const res = await handler(req)

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(mockDestroy).toHaveBeenCalledTimes(1)
  })

  it('returns 200 and calls session.destroy() even when not logged in', async () => {
    const mockSession = { isLoggedIn: false, destroy: mockDestroy }
    mockCookies.mockResolvedValue({})
    mockGetIronSession.mockResolvedValue(mockSession)

    const handler = await getHandler()
    const req = new NextRequest('http://localhost/api/auth/logout', { method: 'POST' })
    const res = await handler(req)

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(mockDestroy).toHaveBeenCalledTimes(1)
  })
})
