/**
 * @jest-environment node
 */
import fs from 'fs'

jest.mock('../../app/lib/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}))

import { getRouteStore } from '../../app/lib/routeStore'
import type { RouteDay, PlanSections } from '../../app/lib/itinerary'
import logger from '../../app/lib/logger'

const mockedLogger = logger as unknown as { info: jest.Mock; warn: jest.Mock }

const mockData: RouteDay[] = [
  {
    date: '2026/9/25',
    weekDay: '星期五',
    dayNum: 1,
    overnight: '巴黎',
    plan: { morning: 'Morning 1', afternoon: 'Afternoon 1', evening: 'Evening 1' },
    train: [],
  },
  {
    date: '2026/9/26',
    weekDay: '星期六',
    dayNum: 2,
    overnight: '巴黎',
    plan: { morning: 'Morning 2', afternoon: 'Afternoon 2', evening: 'Evening 2' },
    train: [],
  },
]

const mockRedis = { get: jest.fn(), set: jest.fn() }
const mockFromEnv = jest.fn(() => mockRedis)
jest.mock('@upstash/redis', () => ({ Redis: { fromEnv: mockFromEnv } }))

// env helpers
const setFileStore = () => {
  delete process.env.KV_REST_API_URL
  delete process.env.KV_REST_API_TOKEN
}
const setUpstashStore = () => {
  process.env.KV_REST_API_URL = 'https://example.upstash.io'
  process.env.KV_REST_API_TOKEN = 'example-token'
}
const setRoutePath = (p: string) => { process.env.ROUTE_DATA_PATH = p }
const clearRoutePath = () => { delete process.env.ROUTE_DATA_PATH }

beforeEach(() => {
  mockedLogger.info.mockClear()
  mockedLogger.warn.mockClear()
})

describe('FileRouteStore (via getRouteStore, no Upstash env)', () => {
  beforeEach(() => {
    setFileStore()
    clearRoutePath()
    jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(mockData) as unknown as Buffer)
    jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
    clearRoutePath()
  })

  it('getAll() reads from the filesystem and returns parsed data', async () => {
    const result = await getRouteStore().getAll()
    expect(fs.readFileSync).toHaveBeenCalled()
    expect(result).toHaveLength(2)
    expect(result[0].date).toBe('2026/9/25')
    expect(result[1].plan.morning).toBe('Morning 2')
  })

  it('updatePlan() writes the updated data back to the filesystem', async () => {
    let written: RouteDay[] | null = null
    jest.spyOn(fs, 'writeFileSync').mockImplementation((_path, content) => {
      written = JSON.parse(content as string)
    })
    const newPlan: PlanSections = { morning: 'New A', afternoon: 'New B', evening: 'New C' }

    await getRouteStore().updatePlan(0, newPlan)

    expect(fs.writeFileSync).toHaveBeenCalled()
    expect(written![0].plan).toEqual(newPlan)
    expect(written![1].plan.morning).toBe('Morning 2') // unchanged
  })

  it('updatePlan() returns the updated day object', async () => {
    const newPlan: PlanSections = { morning: 'X', afternoon: 'Y', evening: 'Z' }
    const result = await getRouteStore().updatePlan(1, newPlan)
    expect(result.plan).toEqual(newPlan)
    expect(result.date).toBe('2026/9/26')
  })

  it('uses ROUTE_DATA_PATH env var as the file path when set', async () => {
    setRoutePath('data/route.e2e.json')
    const readSpy = jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(mockData) as unknown as Buffer)
    await getRouteStore().getAll()
    expect(readSpy).toHaveBeenCalledWith(expect.stringContaining('route.e2e.json'), 'utf-8')
  })

  it('falls back to data/route.json when ROUTE_DATA_PATH is not set', async () => {
    const readSpy = jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(mockData) as unknown as Buffer)
    await getRouteStore().getAll()
    expect(readSpy).toHaveBeenCalledWith(expect.stringContaining('route.json'), 'utf-8')
    expect(readSpy).not.toHaveBeenCalledWith(expect.stringContaining('e2e'), 'utf-8')
  })
})

describe('UpstashRouteStore (via getRouteStore, with Upstash env)', () => {
  beforeEach(() => {
    setUpstashStore()
    mockFromEnv.mockClear()
    mockRedis.get.mockReset()
    mockRedis.set.mockReset()
  })

  afterEach(() => setFileStore())

  it('getAll() reads from Upstash Redis and returns data', async () => {
    mockRedis.get.mockResolvedValue(mockData)
    const result = await getRouteStore().getAll()
    expect(mockFromEnv).toHaveBeenCalledTimes(1)
    expect(mockRedis.get).toHaveBeenCalledWith('route')
    expect(result).toEqual(mockData)
  })

  it('getAll() seeds Redis from route.json when Redis is empty', async () => {
    mockRedis.get.mockResolvedValue(null)
    mockRedis.set.mockResolvedValue('OK')
    const result = await getRouteStore().getAll()
    expect(mockRedis.set).toHaveBeenCalledWith('route', expect.any(Array))
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
  })

  it('updatePlan() saves updated data to Redis and returns the updated day', async () => {
    mockRedis.get.mockResolvedValue(JSON.parse(JSON.stringify(mockData)))
    mockRedis.set.mockResolvedValue('OK')
    const newPlan: PlanSections = { morning: 'KV A', afternoon: 'KV B', evening: 'KV C' }
    const result = await getRouteStore().updatePlan(0, newPlan)
    expect(mockRedis.set).toHaveBeenCalledWith(
      'route',
      expect.arrayContaining([expect.objectContaining({ plan: newPlan })])
    )
    expect(result.plan).toEqual(newPlan)
  })
})

describe('getRouteStore() factory', () => {
  beforeEach(() => {
    setFileStore()
    mockFromEnv.mockClear()
    mockRedis.get.mockReset()
    mockRedis.set.mockReset()
  })

  afterEach(() => {
    setFileStore()
  })

  it('uses FileRouteStore when Upstash env is not set — redis is never called', async () => {
    setFileStore()
    // FileRouteStore reads the real route.json — no mock needed, just verify redis is untouched
    await getRouteStore().getAll()
    expect(mockFromEnv).not.toHaveBeenCalled()
    expect(mockRedis.get).not.toHaveBeenCalled()
  })

  it('uses UpstashRouteStore when Upstash env is set — redis.get is called, not fs', async () => {
    setUpstashStore()
    mockRedis.get.mockResolvedValue(mockData)
    jest.spyOn(fs, 'readFileSync')
    await getRouteStore().getAll()
    expect(mockFromEnv).toHaveBeenCalledTimes(1)
    expect(mockRedis.get).toHaveBeenCalledWith('route')
    expect(fs.readFileSync).not.toHaveBeenCalled()
    jest.restoreAllMocks()
  })

  it('logs local-file backend selection when Upstash env is missing', () => {
    setFileStore()
    getRouteStore()
    expect(mockedLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ backend: 'local-file' }),
      'RouteStore backend selected'
    )
  })

  it('logs upstash-redis backend selection when Upstash env is set', () => {
    setUpstashStore()
    getRouteStore()
    expect(mockedLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ backend: 'upstash-redis' }),
      'RouteStore backend selected'
    )
  })

  it('warns and falls back to file store when only one KV env var is set', () => {
    process.env.KV_REST_API_URL = 'https://example.upstash.io'
    delete process.env.KV_REST_API_TOKEN

    getRouteStore()

    expect(mockedLogger.warn).toHaveBeenCalledWith(
      { hasKvRestApiUrl: true, hasKvRestApiToken: false },
      'KV env is incomplete, falling back to FileRouteStore'
    )
    expect(mockedLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ backend: 'local-file' }),
      'RouteStore backend selected'
    )
  })
})
