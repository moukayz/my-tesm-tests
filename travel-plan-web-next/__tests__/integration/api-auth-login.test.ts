/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'

const mockSave = jest.fn()
const mockGetIronSession = jest.fn()
const mockCookies = jest.fn()

const mockIncr = jest.fn()
const mockExpire = jest.fn()
const mockRedisSet = jest.fn()
const mockDel = jest.fn()
const mockRedis = { incr: mockIncr, expire: mockExpire, set: mockRedisSet, del: mockDel }

jest.mock('iron-session', () => ({
  getIronSession: mockGetIronSession,
}))

jest.mock('next/headers', () => ({
  cookies: mockCookies,
}))

jest.mock('@upstash/redis', () => ({
  Redis: { fromEnv: jest.fn(() => mockRedis) },
}))

// Set env vars before importing route
process.env.AUTH_USERNAME = 'testuser'
process.env.AUTH_PASSWORD = 'testpass'
process.env.SESSION_SECRET = 'test-secret-at-least-32-characters!!'
process.env.UPSTASH_REDIS_REST_URL = 'https://mock.upstash.io'
process.env.UPSTASH_REDIS_REST_TOKEN = 'mock-token'

describe('POST /api/auth/login', () => {
  let POST: (req: NextRequest) => Promise<Response>

  beforeEach(() => {
    jest.resetModules()
    mockSave.mockClear()
    mockGetIronSession.mockClear()
    mockCookies.mockClear()
    mockIncr.mockClear()
    mockExpire.mockClear()
    mockRedisSet.mockClear()
    mockDel.mockClear()

    // Default: failure counter below threshold
    mockIncr.mockResolvedValue(1)
    mockExpire.mockResolvedValue(1)
    mockRedisSet.mockResolvedValue('OK')
    mockDel.mockResolvedValue(1)
  })

  async function getHandler() {
    const mod = await import('../../app/api/auth/login/route')
    return mod.POST
  }

  function makeRequest(body: unknown, ip = '127.0.0.1') {
    return new NextRequest('http://localhost/api/auth/login', {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    })
  }

  it('returns 200 and calls session.save() on valid credentials', async () => {
    const mockSession: { isLoggedIn: boolean; username?: string; save: jest.Mock } = { isLoggedIn: false, save: mockSave }
    mockCookies.mockResolvedValue({})
    mockGetIronSession.mockResolvedValue(mockSession)

    const handler = await getHandler()
    const res = await handler(makeRequest({ username: 'testuser', password: 'testpass' }))

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(mockSave).toHaveBeenCalledTimes(1)
    expect(mockSession.isLoggedIn).toBe(true)
    expect(mockSession.username).toBe('testuser')
  })

  it('clears rate limit record on successful login', async () => {
    const mockSession = { isLoggedIn: false, save: mockSave }
    mockCookies.mockResolvedValue({})
    mockGetIronSession.mockResolvedValue(mockSession)

    const handler = await getHandler()
    await handler(makeRequest({ username: 'testuser', password: 'testpass' }, '10.0.0.1'))

    expect(mockDel).toHaveBeenCalledWith('login:failures:10.0.0.1', 'login:blocked:10.0.0.1')
  })

  it('returns 401 on wrong password', async () => {
    const mockSession = { isLoggedIn: false, save: mockSave }
    mockCookies.mockResolvedValue({})
    mockGetIronSession.mockResolvedValue(mockSession)

    const handler = await getHandler()
    const res = await handler(makeRequest({ username: 'testuser', password: 'wrongpass' }))

    expect(res.status).toBe(401)
    expect(mockSave).not.toHaveBeenCalled()
  })

  it('increments failure counter in Redis on wrong credentials', async () => {
    const mockSession = { isLoggedIn: false, save: mockSave }
    mockCookies.mockResolvedValue({})
    mockGetIronSession.mockResolvedValue(mockSession)

    const handler = await getHandler()
    await handler(makeRequest({ username: 'testuser', password: 'wrongpass' }, '10.0.0.2'))

    expect(mockIncr).toHaveBeenCalledWith('login:failures:10.0.0.2')
  })

  it('sets the blocked key in Redis when failures reach threshold (5)', async () => {
    const mockSession = { isLoggedIn: false, save: mockSave }
    mockCookies.mockResolvedValue({})
    mockGetIronSession.mockResolvedValue(mockSession)

    // Simulate this being the 5th failure
    mockIncr.mockResolvedValue(5)

    const handler = await getHandler()
    await handler(makeRequest({ username: 'testuser', password: 'wrongpass' }, '10.0.0.3'))

    expect(mockRedisSet).toHaveBeenCalledWith('login:blocked:10.0.0.3', '1', { ex: 60 })
  })

  it('does not set blocked key when failures are below threshold', async () => {
    const mockSession = { isLoggedIn: false, save: mockSave }
    mockCookies.mockResolvedValue({})
    mockGetIronSession.mockResolvedValue(mockSession)

    mockIncr.mockResolvedValue(4)

    const handler = await getHandler()
    await handler(makeRequest({ username: 'testuser', password: 'wrongpass' }))

    expect(mockRedisSet).not.toHaveBeenCalled()
  })

  it('returns 401 on wrong username', async () => {
    const mockSession = { isLoggedIn: false, save: mockSave }
    mockCookies.mockResolvedValue({})
    mockGetIronSession.mockResolvedValue(mockSession)

    const handler = await getHandler()
    const res = await handler(makeRequest({ username: 'wronguser', password: 'testpass' }))

    expect(res.status).toBe(401)
    expect(mockSave).not.toHaveBeenCalled()
  })

  it('returns 400 on missing fields', async () => {
    const mockSession = { isLoggedIn: false, save: mockSave }
    mockCookies.mockResolvedValue({})
    mockGetIronSession.mockResolvedValue(mockSession)

    const handler = await getHandler()
    const res = await handler(makeRequest({ username: 'testuser' }))

    expect(res.status).toBe(400)
    expect(mockSave).not.toHaveBeenCalled()
  })

  it('returns 400 on invalid JSON', async () => {
    const mockSession = { isLoggedIn: false, save: mockSave }
    mockCookies.mockResolvedValue({})
    mockGetIronSession.mockResolvedValue(mockSession)

    const handler = await getHandler()
    const req = new NextRequest('http://localhost/api/auth/login', {
      method: 'POST',
      body: 'not-json',
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await handler(req)

    expect(res.status).toBe(400)
    expect(mockSave).not.toHaveBeenCalled()
  })
})
