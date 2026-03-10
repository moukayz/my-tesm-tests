/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'

const mockTtl = jest.fn()
const mockRedis = { ttl: mockTtl }

jest.mock('@upstash/redis', () => ({
  Redis: { fromEnv: jest.fn(() => mockRedis) },
}))

describe('middleware: login rate limit', () => {
  beforeEach(() => {
    jest.resetModules()
    mockTtl.mockClear()
    process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.io'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token'
  })

  afterEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
  })

  async function getMiddleware() {
    const mod = await import('../../middleware')
    return mod.middleware
  }

  function makeRequest(ip = '10.0.0.1') {
    return new NextRequest('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    })
  }

  it('returns 429 with retryAfter when IP is blocked', async () => {
    mockTtl.mockResolvedValue(45)

    const middleware = await getMiddleware()
    const res = await middleware(makeRequest())

    expect(res.status).toBe(429)
    const json = await res.json()
    expect(json.error).toMatch(/too many/i)
    expect(json.retryAfter).toBe(45)
  })

  it('passes through when IP is not blocked (key missing, ttl = -2)', async () => {
    mockTtl.mockResolvedValue(-2)

    const middleware = await getMiddleware()
    const res = await middleware(makeRequest())

    expect(res.status).not.toBe(429)
  })

  it('passes through when IP is not blocked (no expiry, ttl = -1)', async () => {
    mockTtl.mockResolvedValue(-1)

    const middleware = await getMiddleware()
    const res = await middleware(makeRequest())

    expect(res.status).not.toBe(429)
  })

  it('uses the first IP from x-forwarded-for header', async () => {
    mockTtl.mockResolvedValue(-2)

    const middleware = await getMiddleware()
    await middleware(makeRequest('203.0.113.5, 10.0.0.1'))

    expect(mockTtl).toHaveBeenCalledWith('login:blocked:203.0.113.5')
  })

  it('falls back to "unknown" when x-forwarded-for is absent', async () => {
    mockTtl.mockResolvedValue(-2)

    const middleware = await getMiddleware()
    const req = new NextRequest('http://localhost/api/auth/login', { method: 'POST' })
    await middleware(req)

    expect(mockTtl).toHaveBeenCalledWith('login:blocked:unknown')
  })
})
