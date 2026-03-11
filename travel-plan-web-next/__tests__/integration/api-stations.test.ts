/**
 * @jest-environment node
 */
jest.mock('../../app/lib/pgdb', () => ({
  pgQuery: jest.fn(),
}))

import { GET } from '../../app/api/stations/route'
import { pgQuery } from '../../app/lib/pgdb'

const mockPgQuery = pgQuery as jest.Mock

function makeRequest(params: Record<string, string>) {
  const url = new URL('http://localhost/api/stations')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return new Request(url.toString())
}

describe('GET /api/stations', () => {
  beforeEach(() => mockPgQuery.mockReset())

  it('returns 400 when train param is missing', async () => {
    const res = await GET(makeRequest({}))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/train/)
  })

  it('returns station list for a valid train', async () => {
    mockPgQuery.mockResolvedValue([
      { station_name: 'Paris Gare de Lyon', station_num: 1 },
      { station_name: 'Lyon Part-Dieu', station_num: 2 },
    ])
    const res = await GET(makeRequest({ train: 'TGV 6201' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveLength(2)
    expect(data[0].station_name).toBe('Paris Gare de Lyon')
  })

  it('uses parameterized query with raw train name (SQL injection safe)', async () => {
    mockPgQuery.mockResolvedValue([])
    await GET(makeRequest({ train: "O'clock Express" }))
    const params = mockPgQuery.mock.calls[0][1]
    expect(params).toContain("O'clock Express")
  })

  it('returns 500 on db error', async () => {
    mockPgQuery.mockRejectedValue(new Error('Query failed'))
    const res = await GET(makeRequest({ train: 'ICE 905' }))
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toBe('Query failed')
  })
})
