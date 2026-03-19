/**
 * @jest-environment node
 *
 * Tests for tabKey support in getRouteStore().
 * Covers Tier 1 cases from backend-design.md §9 routeStore.test.ts additions.
 */
import fs from 'fs'
import path from 'path'

jest.mock('../../app/lib/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}))

const mockRedis = { get: jest.fn(), set: jest.fn() }
const mockFromEnv = jest.fn(() => mockRedis)
jest.mock('@upstash/redis', () => ({ Redis: { fromEnv: mockFromEnv } }))

import { getRouteStore } from '../../app/lib/routeStore'
import type { RouteDay } from '../../app/lib/itinerary'

const mockData: RouteDay[] = [
  {
    date: '2026/9/25',
    weekDay: '星期五',
    dayNum: 1,
    overnight: '巴黎',
    plan: { morning: 'M1', afternoon: 'A1', evening: 'E1' },
    train: [],
  },
  {
    date: '2026/9/26',
    weekDay: '星期六',
    dayNum: 2,
    overnight: '里昂',
    plan: { morning: 'M2', afternoon: 'A2', evening: 'E2' },
    train: [],
  },
]

const setFileStore = () => {
  delete process.env.KV_REST_API_URL
  delete process.env.KV_REST_API_TOKEN
}
const setUpstashStore = () => {
  process.env.KV_REST_API_URL = 'https://example.upstash.io'
  process.env.KV_REST_API_TOKEN = 'example-token'
}

// ─── FileRouteStore — tabKey routing ─────────────────────────────────────────

describe('FileRouteStore — tabKey routing', () => {
  beforeEach(() => {
    setFileStore()
    delete process.env.ROUTE_DATA_PATH
    delete process.env.ROUTE_TEST_DATA_PATH
    jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {})
    jest.spyOn(fs, 'existsSync').mockReturnValue(true)
    jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(mockData))
  })

  afterEach(() => {
    jest.restoreAllMocks()
    delete process.env.ROUTE_DATA_PATH
    delete process.env.ROUTE_TEST_DATA_PATH
  })

  it("getRouteStore() with no arg uses 'route' key → reads data/route.json by default", async () => {
    const readSpy = jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(mockData))
    await getRouteStore().getAll()
    expect(readSpy).toHaveBeenCalledWith(expect.stringContaining('route.json'), 'utf-8')
    // Must NOT contain 'route-test'
    const calls = readSpy.mock.calls.map(c => c[0] as string)
    expect(calls.some(c => c.includes('route-test'))).toBe(false)
  })

  it("getRouteStore('route') reads ROUTE_DATA_PATH when set", async () => {
    process.env.ROUTE_DATA_PATH = 'data/route.e2e.json'
    const readSpy = jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(mockData))
    await getRouteStore('route').getAll()
    expect(readSpy).toHaveBeenCalledWith(expect.stringContaining('route.e2e.json'), 'utf-8')
  })

  it("getRouteStore('route-test') reads ROUTE_TEST_DATA_PATH when set", async () => {
    process.env.ROUTE_TEST_DATA_PATH = 'data/route-test.custom.json'
    const existsSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true)
    const readSpy = jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(mockData))
    await getRouteStore('route-test').getAll()
    const allReadPaths = readSpy.mock.calls.map(c => c[0] as string)
    expect(allReadPaths.some(p => p.includes('route-test.custom.json'))).toBe(true)
    existsSpy.mockRestore()
  })

  it("getRouteStore('route-test') reads data/route-test.json by default when file exists", async () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(true)
    const readSpy = jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(mockData))
    await getRouteStore('route-test').getAll()
    const calls = readSpy.mock.calls.map(c => c[0] as string)
    expect(calls.some(c => c.includes('route-test.json'))).toBe(true)
  })

  it("getRouteStore('route-test') auto-seeds from route.json when test file does not exist", async () => {
    const testFilePath = path.join(process.cwd(), 'data/route-test.json')
    const seedFilePath = path.join(process.cwd(), 'data/route.json')

    jest.spyOn(fs, 'existsSync').mockImplementation((p) => p !== testFilePath)
    const readSpy = jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(mockData))
    const writeSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {})

    await getRouteStore('route-test').getAll()

    // Should have read the seed file
    const readCalls = readSpy.mock.calls.map(c => c[0] as string)
    expect(readCalls.some(p => p.includes('route.json') && !p.includes('route-test'))).toBe(true)

    // Should have written the seed to the test file
    const writeCalls = writeSpy.mock.calls.map(c => c[0] as string)
    expect(writeCalls.some(p => p.includes('route-test.json'))).toBe(true)

    readSpy.mockRestore()
    writeSpy.mockRestore()
  })

  it("getRouteStore('route-test') does NOT auto-seed when test file already exists", async () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(true)
    const writeSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {})

    await getRouteStore('route-test').getAll()

    // writeFileSync should not be called for seeding (only for actual updates)
    const seedWriteCalls = writeSpy.mock.calls.filter(c => {
      const p = c[0] as string
      return p.includes('route-test.json') && typeof c[1] === 'string' && c[1].includes('巴黎')
    })
    // The test file existed — no seed write should have happened on getAll
    // (writeFileSync should only be called from updatePlan/updateTrain/updateDays)
    expect(seedWriteCalls).toHaveLength(0)
  })
})

// ─── FileRouteStore — updateDays ─────────────────────────────────────────────

describe('FileRouteStore — updateDays', () => {
  beforeEach(() => {
    setFileStore()
    jest.spyOn(fs, 'existsSync').mockReturnValue(true)
    jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(mockData))
  })

  afterEach(() => {
    jest.restoreAllMocks()
    delete process.env.ROUTE_DATA_PATH
    delete process.env.ROUTE_TEST_DATA_PATH
  })

  it("updateDays writes the full array to file and returns it", async () => {
    let written: RouteDay[] | null = null
    jest.spyOn(fs, 'writeFileSync').mockImplementation((_p, content) => {
      written = JSON.parse(content as string)
    })
    const result = await getRouteStore('route').updateDays(mockData)
    expect(fs.writeFileSync).toHaveBeenCalled()
    expect(written).toEqual(mockData)
    expect(result).toEqual(mockData)
  })

  it("updateDays on 'route-test' store writes to the test file path", async () => {
    let writtenPath: string | null = null
    jest.spyOn(fs, 'writeFileSync').mockImplementation((p) => {
      writtenPath = p as string
    })
    await getRouteStore('route-test').updateDays(mockData)
    expect(writtenPath).not.toBeNull()
    expect(writtenPath!).toContain('route-test.json')
  })

  it("updateDays on 'route' store does not write to test file", async () => {
    let writtenPath: string | null = null
    jest.spyOn(fs, 'writeFileSync').mockImplementation((p) => {
      writtenPath = p as string
    })
    await getRouteStore('route').updateDays(mockData)
    expect(writtenPath).not.toBeNull()
    expect(writtenPath!).not.toContain('route-test.json')
  })
})

// ─── UpstashRouteStore — tabKey routing ──────────────────────────────────────

describe('UpstashRouteStore — tabKey routing', () => {
  beforeEach(() => {
    setUpstashStore()
    delete process.env.ROUTE_REDIS_KEY
    delete process.env.ROUTE_TEST_REDIS_KEY
    mockFromEnv.mockClear()
    mockRedis.get.mockReset()
    mockRedis.set.mockReset()
  })

  afterEach(() => {
    setFileStore()
    delete process.env.ROUTE_REDIS_KEY
    delete process.env.ROUTE_TEST_REDIS_KEY
    jest.restoreAllMocks()
  })

  it("getRouteStore('route') uses ROUTE_REDIS_KEY env as Redis key", async () => {
    process.env.ROUTE_REDIS_KEY = 'route:test-isolation'
    mockRedis.get.mockResolvedValue(mockData)
    await getRouteStore('route').getAll()
    expect(mockRedis.get).toHaveBeenCalledWith('route:test-isolation')
  })

  it("getRouteStore('route') defaults to 'route' when ROUTE_REDIS_KEY not set", async () => {
    mockRedis.get.mockResolvedValue(mockData)
    await getRouteStore('route').getAll()
    expect(mockRedis.get).toHaveBeenCalledWith('route')
  })

  it("getRouteStore('route-test') uses ROUTE_TEST_REDIS_KEY env as Redis key", async () => {
    process.env.ROUTE_TEST_REDIS_KEY = 'route-test:ci-run'
    mockRedis.get.mockResolvedValue(mockData)
    await getRouteStore('route-test').getAll()
    expect(mockRedis.get).toHaveBeenCalledWith('route-test:ci-run')
  })

  it("getRouteStore('route-test') defaults to 'route-test' when ROUTE_TEST_REDIS_KEY not set", async () => {
    mockRedis.get.mockResolvedValue(mockData)
    await getRouteStore('route-test').getAll()
    expect(mockRedis.get).toHaveBeenCalledWith('route-test')
  })

  it("getRouteStore('route-test') seeds from route.json when Redis key is empty", async () => {
    mockRedis.get.mockResolvedValue(null)
    mockRedis.set.mockResolvedValue('OK')
    jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(mockData))
    await getRouteStore('route-test').getAll()
    expect(mockRedis.set).toHaveBeenCalledWith('route-test', expect.any(Array))
  })

  it("isolated writes: write to 'route-test' does not affect the 'route' redis key", async () => {
    mockRedis.get.mockResolvedValue(JSON.parse(JSON.stringify(mockData)))
    mockRedis.set.mockResolvedValue('OK')

    const updatedData = mockData.map(d => ({ ...d }))
    updatedData[0].overnight = 'Berlin'

    await getRouteStore('route-test').updateDays(updatedData)

    // set should have been called with 'route-test' key, not 'route'
    const setCalls = mockRedis.set.mock.calls
    expect(setCalls.some((c: unknown[]) => c[0] === 'route-test')).toBe(true)
    expect(setCalls.some((c: unknown[]) => c[0] === 'route')).toBe(false)
  })
})

// ─── UpstashRouteStore — updateDays ──────────────────────────────────────────

describe('UpstashRouteStore — updateDays', () => {
  beforeEach(() => {
    setUpstashStore()
    delete process.env.ROUTE_REDIS_KEY
    delete process.env.ROUTE_TEST_REDIS_KEY
    mockFromEnv.mockClear()
    mockRedis.get.mockReset()
    mockRedis.set.mockReset()
  })

  afterEach(() => {
    setFileStore()
    delete process.env.ROUTE_REDIS_KEY
    delete process.env.ROUTE_TEST_REDIS_KEY
  })

  it("updateDays writes the full array to Redis and returns it", async () => {
    mockRedis.set.mockResolvedValue('OK')
    const result = await getRouteStore('route').updateDays(mockData)
    expect(mockRedis.set).toHaveBeenCalledWith('route', mockData)
    expect(result).toEqual(mockData)
  })

  it("updateDays on 'route-test' store uses the route-test Redis key", async () => {
    mockRedis.set.mockResolvedValue('OK')
    await getRouteStore('route-test').updateDays(mockData)
    expect(mockRedis.set).toHaveBeenCalledWith('route-test', mockData)
  })
})
