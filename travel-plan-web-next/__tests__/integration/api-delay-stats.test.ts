/**
 * @jest-environment node
 */
jest.mock('../../app/lib/db', () => ({
  query: jest.fn(),
  DELAY_PARQUET: 'mock_delay_parquet',
  STOPS_PARQUET: 'mock_stops_parquet',
  convertBigInt: jest.fn((x) => x),
}))

import { GET } from '../../app/api/delay-stats/route'
import { query } from '../../app/lib/db'

const mockQuery = query as jest.Mock

function makeRequest(params: Record<string, string>) {
  const url = new URL('http://localhost/api/delay-stats')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return new Request(url.toString())
}

const mockStats = {
  total_stops: 90,
  avg_delay: 4.2,
  p50: 2.5,
  p75: 6.0,
  p90: 9.1,
  p95: 14.0,
  max_delay: 60,
}

const mockTrends = [
  { day: '2024-01-10T00:00:00', avg_delay: 3.1, stops: 5 },
  { day: '2024-01-11T00:00:00', avg_delay: 5.0, stops: 4 },
]

describe('GET /api/delay-stats', () => {
  beforeEach(() => mockQuery.mockReset())

  it('returns 400 when both params are missing', async () => {
    const res = await GET(makeRequest({}))
    expect(res.status).toBe(400)
  })

  it('returns 400 when station param is missing', async () => {
    const res = await GET(makeRequest({ train: 'ICE 905' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when train param is missing', async () => {
    const res = await GET(makeRequest({ station: 'Berlin Hbf' }))
    expect(res.status).toBe(400)
  })

  it('returns stats and trends for valid params', async () => {
    mockQuery.mockResolvedValueOnce([mockStats]).mockResolvedValueOnce(mockTrends)
    const res = await GET(makeRequest({ train: 'ICE 905', station: 'Berlin Hbf' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.stats).toMatchObject({ total_stops: 90, avg_delay: 4.2 })
    expect(data.trends).toHaveLength(2)
  })

  it('returns null stats when db returns empty array', async () => {
    mockQuery.mockResolvedValueOnce([]).mockResolvedValueOnce([])
    const res = await GET(makeRequest({ train: 'ICE 905', station: 'Berlin Hbf' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.stats).toBeNull()
    expect(data.trends).toEqual([])
  })

  it('escapes single quotes in train and station names', async () => {
    mockQuery.mockResolvedValue([])
    await GET(makeRequest({ train: "O'Hare Express", station: "King's Cross" }))
    const sql: string = mockQuery.mock.calls[0][0]
    expect(sql).toContain("O''Hare Express")
    expect(sql).toContain("King''s Cross")
  })

  it('returns 500 on db error', async () => {
    mockQuery.mockRejectedValue(new Error('Timeout'))
    const res = await GET(makeRequest({ train: 'ICE 905', station: 'Berlin Hbf' }))
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toBe('Timeout')
  })
})
