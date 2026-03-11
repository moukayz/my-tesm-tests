// pgdb.test.ts — unit tests for both local (pg.Pool) and Vercel (neon) paths

// ─── pg mock (hoisting-safe) ──────────────────────────────────────────────────
const mockQuery = jest.fn()
const mockPool = { query: mockQuery }
const MockPool = jest.fn(() => mockPool)

jest.mock('pg', () => ({ Pool: MockPool }))

// ─── @neondatabase/serverless mock ────────────────────────────────────────────
const mockNeonQuery = jest.fn()
const mockNeon = jest.fn(() => mockNeonQuery)

jest.mock('@neondatabase/serverless', () => ({ neon: mockNeon }))

describe('pgQuery — local path (VERCEL unset)', () => {
  const OLD_ENV = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...OLD_ENV }
    delete process.env.VERCEL
    process.env.DATABASE_URL = 'postgresql://localhost/test'
    MockPool.mockClear()
    mockQuery.mockClear()
  })

  afterAll(() => {
    process.env = OLD_ENV
  })

  it('constructs a pg.Pool with DATABASE_URL', async () => {
    const { pgQuery } = await import('../../app/lib/pgdb')
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] })
    await pgQuery('SELECT 1')
    expect(MockPool).toHaveBeenCalledWith({ connectionString: 'postgresql://localhost/test' })
  })

  it('calls pool.query with sql and params and returns rows', async () => {
    const { pgQuery } = await import('../../app/lib/pgdb')
    const rows = [{ trip_id: 'fr:1234' }]
    mockQuery.mockResolvedValueOnce({ rows })
    const result = await pgQuery('SELECT * FROM gtfs_trips WHERE trip_id = $1', ['fr:1234'])
    expect(mockQuery).toHaveBeenCalledWith(
      'SELECT * FROM gtfs_trips WHERE trip_id = $1',
      ['fr:1234']
    )
    expect(result).toEqual(rows)
  })

  it('reuses the same pool across multiple calls', async () => {
    const { pgQuery } = await import('../../app/lib/pgdb')
    mockQuery.mockResolvedValue({ rows: [] })
    await pgQuery('SELECT 1')
    await pgQuery('SELECT 2')
    expect(MockPool).toHaveBeenCalledTimes(1)
  })
})

describe('pgQuery — Vercel path (VERCEL=1)', () => {
  const OLD_ENV = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...OLD_ENV }
    process.env.VERCEL = '1'
    process.env.DATABASE_URL = 'postgresql://neon-host/neondb'
    mockNeon.mockClear()
    mockNeonQuery.mockClear()
  })

  afterAll(() => {
    process.env = OLD_ENV
  })

  it('calls neon() with DATABASE_URL and returns rows directly', async () => {
    const { pgQuery } = await import('../../app/lib/pgdb')
    const rows = [{ trip_id: 'eu:9002' }]
    mockNeonQuery.mockResolvedValueOnce(rows)
    const result = await pgQuery('SELECT * FROM gtfs_trips WHERE trip_id = $1', ['eu:9002'])
    expect(mockNeon).toHaveBeenCalledWith('postgresql://neon-host/neondb')
    expect(mockNeonQuery).toHaveBeenCalledWith(
      'SELECT * FROM gtfs_trips WHERE trip_id = $1',
      ['eu:9002']
    )
    expect(result).toEqual(rows)
  })

  it('does not construct a pg.Pool when VERCEL is set', async () => {
    MockPool.mockClear()
    const { pgQuery } = await import('../../app/lib/pgdb')
    mockNeonQuery.mockResolvedValueOnce([])
    await pgQuery('SELECT 1', [])
    expect(MockPool).not.toHaveBeenCalled()
  })
})
