/**
 * @jest-environment node
 */
jest.mock('../../app/lib/db', () => ({
  query: jest.fn(),
  DELAY_PARQUET: 'mock_delay_parquet',
  STOPS_PARQUET: 'mock_stops_parquet',
  convertBigInt: jest.fn((x) => x),
}))

jest.mock('../../app/lib/pgdb', () => ({
  pgQuery: jest.fn(),
}))

import { NextRequest } from 'next/server'
import { GET } from '../../app/api/trains/route'
import { query } from '../../app/lib/db'
import { pgQuery } from '../../app/lib/pgdb'

const mockDuckQuery = query as jest.Mock
const mockPgQuery = pgQuery as jest.Mock

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/trains')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return new NextRequest(url)
}

describe('GET /api/trains', () => {
  beforeEach(() => {
    mockDuckQuery.mockReset()
    mockPgQuery.mockReset()
  })

  it('returns the train list with railway field from all sources', async () => {
    mockDuckQuery.mockResolvedValueOnce([{ train_name: 'ICE 905', train_type: 'ICE' }])
    mockPgQuery
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
    mockDuckQuery.mockResolvedValueOnce([{ train_name: 'RE 1', train_type: 'RE' }])
    mockPgQuery
      .mockResolvedValueOnce([{ train_name: 'TGV 100', train_type: 'SNCF' }])
      .mockResolvedValueOnce([{ train_name: 'ES 9001', train_type: 'Eurostar' }])
    const res = await GET(makeRequest())
    const data = await res.json()
    expect(data.find((r: { train_name: string; railway: string }) => r.train_name === 'RE 1')?.railway).toBe('german')
    expect(data.find((r: { train_name: string; railway: string }) => r.train_name === 'TGV 100')?.railway).toBe('french')
    expect(data.find((r: { train_name: string; railway: string }) => r.train_name === 'ES 9001')?.railway).toBe('eurostar')
  })

  it('returns empty array when no trains found', async () => {
    mockDuckQuery.mockResolvedValue([])
    mockPgQuery.mockResolvedValue([])
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual([])
  })

  it('returns empty array when all sources fail (graceful fallback)', async () => {
    mockDuckQuery.mockRejectedValue(new Error('DB connection failed'))
    mockPgQuery.mockRejectedValue(new Error('PG connection failed'))
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual([])
  })

  it('deduplicates trains with the same name across sources, preferring french over german', async () => {
    mockDuckQuery.mockResolvedValueOnce([{ train_name: 'ICE 9550', train_type: 'ICE' }])
    mockPgQuery
      .mockResolvedValueOnce([{ train_name: 'ICE 9550', train_type: 'SNCF' }])
      .mockResolvedValueOnce([])
    const res = await GET(makeRequest())
    const data = await res.json()
    const matches = data.filter((r: { train_name: string }) => r.train_name === 'ICE 9550')
    expect(matches).toHaveLength(1)
    expect(matches[0].railway).toBe('french')
  })

  it('returns partial results when one source fails', async () => {
    mockDuckQuery.mockResolvedValueOnce([{ train_name: 'ICE 905', train_type: 'ICE' }])
    mockPgQuery
      .mockRejectedValueOnce(new Error('French data unavailable'))
      .mockRejectedValueOnce(new Error('Eurostar data unavailable'))
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual([{ train_name: 'ICE 905', train_type: 'ICE', railway: 'german' }])
  })

  it('?railway=german returns only german parquet trains', async () => {
    mockDuckQuery.mockResolvedValueOnce([
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
    expect(mockDuckQuery).toHaveBeenCalledTimes(1)
    expect(mockPgQuery).not.toHaveBeenCalled()
  })

  it('?railway=german excludes french and eurostar trains', async () => {
    mockDuckQuery.mockResolvedValueOnce([{ train_name: 'ICE 1', train_type: 'ICE' }])
    const res = await GET(makeRequest({ railway: 'german' }))
    const data = await res.json()
    expect(data.every((r: { railway: string }) => r.railway === 'german')).toBe(true)
  })

  it('uses gtfs_trips table with split_part for french trains', async () => {
    mockDuckQuery.mockResolvedValueOnce([])
    mockPgQuery.mockResolvedValue([])
    await GET(makeRequest())
    const frenchCall = mockPgQuery.mock.calls[0]?.[0] as string
    expect(frenchCall).toContain('gtfs_trips')
    expect(frenchCall).toContain("split_part(trip_id, ':', 1)")
    expect(frenchCall).toContain("'fr'")
  })

  it('uses gtfs_trips table with split_part for eurostar trains', async () => {
    mockDuckQuery.mockResolvedValueOnce([])
    mockPgQuery.mockResolvedValue([])
    await GET(makeRequest())
    const eurostarCall = mockPgQuery.mock.calls[1]?.[0] as string
    expect(eurostarCall).toContain('gtfs_trips')
    expect(eurostarCall).toContain("split_part(trip_id, ':', 1)")
    expect(eurostarCall).toContain("'eu'")
  })
})
