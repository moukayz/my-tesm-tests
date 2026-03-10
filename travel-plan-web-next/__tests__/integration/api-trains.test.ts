/**
 * @jest-environment node
 */
jest.mock('../../app/lib/db', () => ({
  query: jest.fn(),
  PARQUET: 'mock_parquet',
  EURO_GTFS: 'mock_euro',
  convertBigInt: jest.fn((x) => x),
}))

import { NextRequest } from 'next/server'
import { GET } from '../../app/api/trains/route'
import { query } from '../../app/lib/db'

const mockQuery = query as jest.Mock

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/trains')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return new NextRequest(url)
}

describe('GET /api/trains', () => {
  beforeEach(() => mockQuery.mockReset())

  it('returns the train list with railway field from all sources', async () => {
    mockQuery
      .mockResolvedValueOnce([{ train_name: 'ICE 905', train_type: 'ICE' }])
      .mockResolvedValueOnce([{ train_name: '6201', train_type: 'SNCF' }])
      .mockResolvedValueOnce([{ train_name: '9002', train_type: 'Eurostar' }])
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toContainEqual({ train_name: 'ICE 905', train_type: 'ICE', railway: 'german' })
    expect(data).toContainEqual({ train_name: '6201', train_type: 'SNCF', railway: 'french' })
    expect(data).toContainEqual({ train_name: '9002', train_type: 'Eurostar', railway: 'eurostar' })
  })

  it('returns entries with railway field for each source', async () => {
    mockQuery
      .mockResolvedValueOnce([{ train_name: 'RE 1', train_type: 'RE' }])
      .mockResolvedValueOnce([{ train_name: 'TGV 100', train_type: 'SNCF' }])
      .mockResolvedValueOnce([{ train_name: 'ES 9001', train_type: 'Eurostar' }])
    const res = await GET(makeRequest())
    const data = await res.json()
    expect(data.find((r: { train_name: string; railway: string }) => r.train_name === 'RE 1')?.railway).toBe('german')
    expect(data.find((r: { train_name: string; railway: string }) => r.train_name === 'TGV 100')?.railway).toBe('french')
    expect(data.find((r: { train_name: string; railway: string }) => r.train_name === 'ES 9001')?.railway).toBe('eurostar')
  })

  it('returns empty array when no trains found', async () => {
    mockQuery.mockResolvedValue([])
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual([])
  })

  it('returns empty array when all sources fail (graceful fallback)', async () => {
    mockQuery.mockRejectedValue(new Error('DB connection failed'))
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual([])
  })

  it('deduplicates trains with the same name across sources, preferring french over german', async () => {
    mockQuery
      .mockResolvedValueOnce([{ train_name: 'ICE 9550', train_type: 'ICE' }])
      .mockResolvedValueOnce([{ train_name: 'ICE 9550', train_type: 'SNCF' }])
      .mockResolvedValueOnce([])
    const res = await GET(makeRequest())
    const data = await res.json()
    const matches = data.filter((r: { train_name: string }) => r.train_name === 'ICE 9550')
    expect(matches).toHaveLength(1)
    expect(matches[0].railway).toBe('french')
  })

  it('returns partial results when one source fails', async () => {
    mockQuery
      .mockResolvedValueOnce([{ train_name: 'ICE 905', train_type: 'ICE' }])
      .mockRejectedValueOnce(new Error('French data unavailable'))
      .mockRejectedValueOnce(new Error('Eurostar data unavailable'))
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual([{ train_name: 'ICE 905', train_type: 'ICE', railway: 'german' }])
  })

  it('?railway=german returns only german parquet trains', async () => {
    mockQuery.mockResolvedValueOnce([
      { train_name: 'ICE 905', train_type: 'ICE' },
      { train_name: 'RE 1', train_type: 'RE' },
    ])
    const res = await GET(makeRequest({ railway: 'german' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual([
      { train_name: 'ICE 905', train_type: 'ICE', railway: 'german' },
      { train_name: 'RE 1', train_type: 'RE', railway: 'german' },
    ])
    // Only one query should have been issued (no french/eurostar queries)
    expect(mockQuery).toHaveBeenCalledTimes(1)
  })

  it('?railway=german excludes french and eurostar trains', async () => {
    mockQuery.mockResolvedValueOnce([{ train_name: 'ICE 1', train_type: 'ICE' }])
    const res = await GET(makeRequest({ railway: 'german' }))
    const data = await res.json()
    expect(data.every((r: { railway: string }) => r.railway === 'german')).toBe(true)
  })
})
