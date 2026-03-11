/**
 * @jest-environment node
 */
import fs from 'fs'
import { getRouteStore } from '../../app/lib/routeStore'
import type { RouteDay, PlanSections } from '../../app/lib/itinerary'

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

const mockKv = { get: jest.fn(), set: jest.fn() }
jest.mock('@vercel/kv', () => ({ kv: mockKv }))

// env helpers
const setFileStore = () => { delete process.env.KV_REST_API_URL }
const setKvStore = () => { process.env.KV_REST_API_URL = 'https://example.kv.vercel-storage.com' }
const setRoutePath = (p: string) => { process.env.ROUTE_DATA_PATH = p }
const clearRoutePath = () => { delete process.env.ROUTE_DATA_PATH }

describe('FileRouteStore (via getRouteStore, no KV_REST_API_URL)', () => {
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

describe('KvRouteStore (via getRouteStore, with KV_REST_API_URL)', () => {
  beforeEach(() => {
    setKvStore()
    mockKv.get.mockReset()
    mockKv.set.mockReset()
  })

  afterEach(() => setFileStore())

  it('getAll() reads from KV and returns data', async () => {
    mockKv.get.mockResolvedValue(mockData)
    const result = await getRouteStore().getAll()
    expect(mockKv.get).toHaveBeenCalledWith('route')
    expect(result).toEqual(mockData)
  })

  it('getAll() seeds KV from route.json when KV is empty', async () => {
    mockKv.get.mockResolvedValue(null)
    mockKv.set.mockResolvedValue('OK')
    const result = await getRouteStore().getAll()
    expect(mockKv.set).toHaveBeenCalledWith('route', expect.any(Array))
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
  })

  it('updatePlan() saves updated data to KV and returns the updated day', async () => {
    mockKv.get.mockResolvedValue(JSON.parse(JSON.stringify(mockData)))
    mockKv.set.mockResolvedValue('OK')
    const newPlan: PlanSections = { morning: 'KV A', afternoon: 'KV B', evening: 'KV C' }
    const result = await getRouteStore().updatePlan(0, newPlan)
    expect(mockKv.set).toHaveBeenCalledWith(
      'route',
      expect.arrayContaining([expect.objectContaining({ plan: newPlan })])
    )
    expect(result.plan).toEqual(newPlan)
  })
})

describe('getRouteStore() factory', () => {
  beforeEach(() => {
    setFileStore()
    mockKv.get.mockReset()
    mockKv.set.mockReset()
  })

  afterEach(() => {
    setFileStore()
  })

  it('uses FileRouteStore when KV_REST_API_URL is not set — kv is never called', async () => {
    setFileStore()
    // FileRouteStore reads the real route.json — no mock needed, just verify kv is untouched
    await getRouteStore().getAll()
    expect(mockKv.get).not.toHaveBeenCalled()
  })

  it('uses KvRouteStore when KV_REST_API_URL is set — kv.get is called, not fs', async () => {
    setKvStore()
    mockKv.get.mockResolvedValue(mockData)
    jest.spyOn(fs, 'readFileSync')
    await getRouteStore().getAll()
    expect(mockKv.get).toHaveBeenCalledWith('route')
    expect(fs.readFileSync).not.toHaveBeenCalled()
    jest.restoreAllMocks()
  })
})
