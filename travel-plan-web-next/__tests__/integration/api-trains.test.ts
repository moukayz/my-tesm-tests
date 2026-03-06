/**
 * @jest-environment node
 */
jest.mock('../../app/lib/db', () => ({
  query: jest.fn(),
  PARQUET: 'mock_parquet',
  convertBigInt: jest.fn((x) => x),
}))

import { GET } from '../../app/api/trains/route'
import { query } from '../../app/lib/db'

const mockQuery = query as jest.Mock

describe('GET /api/trains', () => {
  beforeEach(() => mockQuery.mockReset())

  it('returns the train list as JSON', async () => {
    mockQuery.mockResolvedValue([
      { train_name: 'ICE 905', train_type: 'ICE' },
      { train_name: 'TGV 6201', train_type: 'TGV' },
    ])
    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual([
      { train_name: 'ICE 905', train_type: 'ICE' },
      { train_name: 'TGV 6201', train_type: 'TGV' },
    ])
  })

  it('returns empty array when no trains found', async () => {
    mockQuery.mockResolvedValue([])
    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual([])
  })

  it('returns 500 on db error', async () => {
    mockQuery.mockRejectedValue(new Error('DB connection failed'))
    const res = await GET()
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toBe('DB connection failed')
  })
})
