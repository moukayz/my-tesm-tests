/**
 * @jest-environment node
 */
jest.mock('../../app/lib/pgdb', () => ({
  pgQuery: jest.fn(),
}))

import { NextRequest } from 'next/server'
import * as trainsRoute from '../../app/api/trains/route'
import { resetTrainsCacheForTests } from '../../app/api/trains/cache'
import { pgQuery } from '../../app/lib/pgdb'

const mockPgQuery = pgQuery as jest.Mock
const { GET } = trainsRoute

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/trains')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return new NextRequest(url)
}

describe('GET /api/trains', () => {
  beforeEach(() => {
    mockPgQuery.mockReset()
    resetTrainsCacheForTests()
  })

  it('does not export test-only helpers from the route module', () => {
    expect('__resetTrainsCacheForTests' in trainsRoute).toBe(false)
  })

  it('returns the train list with railway field from all sources', async () => {
    mockPgQuery
      .mockResolvedValueOnce([{ train_name: 'ICE 905', train_type: 'ICE' }])      // german
      .mockResolvedValueOnce([{ train_name: '6201', train_type: 'SNCF' }])        // french
      .mockResolvedValueOnce([{ train_name: '9002', train_type: 'Eurostar' }])    // eurostar
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toContainEqual({ train_name: 'ICE 905', train_type: 'ICE', railway: 'german' })
    expect(data).toContainEqual({ train_name: '6201', train_type: 'SNCF', railway: 'french' })
    expect(data).toContainEqual({ train_name: '9002', train_type: 'Eurostar', railway: 'eurostar' })
  })

  it('returns entries with railway field for each source', async () => {
    mockPgQuery
      .mockResolvedValueOnce([{ train_name: 'RE 1', train_type: 'RE' }])          // german
      .mockResolvedValueOnce([{ train_name: 'TGV 100', train_type: 'SNCF' }])     // french
      .mockResolvedValueOnce([{ train_name: 'ES 9001', train_type: 'Eurostar' }]) // eurostar
    const res = await GET(makeRequest())
    const data = await res.json()
    expect(data.find((r: { train_name: string; railway: string }) => r.train_name === 'RE 1')?.railway).toBe('german')
    expect(data.find((r: { train_name: string; railway: string }) => r.train_name === 'TGV 100')?.railway).toBe('french')
    expect(data.find((r: { train_name: string; railway: string }) => r.train_name === 'ES 9001')?.railway).toBe('eurostar')
  })

  it('returns empty array when no trains found', async () => {
    mockPgQuery.mockResolvedValue([])
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual([])
  })

  it('returns empty array when all sources fail (graceful fallback)', async () => {
    mockPgQuery.mockRejectedValue(new Error('PG connection failed'))
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual([])
  })

  it('deduplicates trains with the same name across sources, preferring french over german', async () => {
    mockPgQuery
      .mockResolvedValueOnce([{ train_name: 'ICE 9550', train_type: 'ICE' }])   // german
      .mockResolvedValueOnce([{ train_name: 'ICE 9550', train_type: 'SNCF' }])  // french
      .mockResolvedValueOnce([])                                                  // eurostar
    const res = await GET(makeRequest())
    const data = await res.json()
    const matches = data.filter((r: { train_name: string }) => r.train_name === 'ICE 9550')
    expect(matches).toHaveLength(1)
    expect(matches[0].railway).toBe('french')
  })

  it('returns partial results when one source fails', async () => {
    mockPgQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('de_db_train_latest_stops')) {
        return [{ train_name: 'ICE 905', train_type: 'ICE' }]
      }
      if (sql.includes("split_part(trip_id, ':', 1) = 'fr'")) {
        throw new Error('French data unavailable')
      }
      if (sql.includes("split_part(trip_id, ':', 1) = 'eu'")) {
        throw new Error('Eurostar data unavailable')
      }
      return []
    })

    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual([{ train_name: 'ICE 905', train_type: 'ICE', railway: 'german' }])
  })

  it('retries transient german query failures for ?railway=german', async () => {
    mockPgQuery
      .mockRejectedValueOnce(new Error('connection warming up'))
      .mockResolvedValueOnce([{ train_name: 'ICE 905', train_type: 'ICE' }])

    const res = await GET(makeRequest({ railway: 'german' }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([
      { train_name: 'ICE 905', train_type: 'ICE', railway: 'german' },
    ])
    expect(mockPgQuery).toHaveBeenCalledTimes(2)
  })

  it('retries transient source failures in combined mode', async () => {
    let frenchAttempts = 0
    mockPgQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('de_db_train_latest_stops')) {
        return [{ train_name: 'ICE 905', train_type: 'ICE' }]
      }
      if (sql.includes("split_part(trip_id, ':', 1) = 'fr'")) {
        frenchAttempts += 1
        if (frenchAttempts === 1) {
          throw new Error('temporary french source failure')
        }
        return [{ train_name: 'TGV 8088', train_type: 'SNCF' }]
      }
      if (sql.includes("split_part(trip_id, ':', 1) = 'eu'")) {
        return [{ train_name: 'EST 9423', train_type: 'Eurostar' }]
      }
      return []
    })

    const res = await GET(makeRequest())

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toContainEqual({ train_name: 'ICE 905', train_type: 'ICE', railway: 'german' })
    expect(data).toContainEqual({ train_name: 'TGV 8088', train_type: 'SNCF', railway: 'french' })
    expect(data).toContainEqual({ train_name: 'EST 9423', train_type: 'Eurostar', railway: 'eurostar' })
    expect(mockPgQuery).toHaveBeenCalledTimes(4)
  })

  it('serves combined train list from in-memory cache within TTL', async () => {
    mockPgQuery
      .mockResolvedValueOnce([{ train_name: 'ICE 905', train_type: 'ICE' }])
      .mockResolvedValueOnce([{ train_name: 'TGV 8088', train_type: 'SNCF' }])
      .mockResolvedValueOnce([{ train_name: 'EST 9423', train_type: 'Eurostar' }])

    const first = await GET(makeRequest())
    expect(first.status).toBe(200)
    const firstData = await first.json()
    expect(firstData).toHaveLength(3)

    const second = await GET(makeRequest())
    expect(second.status).toBe(200)
    const secondData = await second.json()
    expect(secondData).toEqual(firstData)

    expect(mockPgQuery).toHaveBeenCalledTimes(3)
  })

  it('serves ?railway=german from in-memory cache within TTL', async () => {
    mockPgQuery.mockResolvedValueOnce([{ train_name: 'ICE 905', train_type: 'ICE' }])

    const first = await GET(makeRequest({ railway: 'german' }))
    expect(first.status).toBe(200)
    expect(await first.json()).toEqual([
      { train_name: 'ICE 905', train_type: 'ICE', railway: 'german' },
    ])

    const second = await GET(makeRequest({ railway: 'german' }))
    expect(second.status).toBe(200)
    expect(await second.json()).toEqual([
      { train_name: 'ICE 905', train_type: 'ICE', railway: 'german' },
    ])

    expect(mockPgQuery).toHaveBeenCalledTimes(1)
  })

  it('?railway=german returns only german trains', async () => {
    mockPgQuery.mockResolvedValueOnce([
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
    expect(mockPgQuery).toHaveBeenCalledTimes(1)
  })

  it('?railway=german excludes french and eurostar trains', async () => {
    mockPgQuery.mockResolvedValueOnce([{ train_name: 'ICE 1', train_type: 'ICE' }])
    const res = await GET(makeRequest({ railway: 'german' }))
    const data = await res.json()
    expect(data.every((r: { railway: string }) => r.railway === 'german')).toBe(true)
  })

  it('uses de_train_latest_stops for german trains', async () => {
    mockPgQuery.mockResolvedValue([])
    await GET(makeRequest())
    const germanCall = mockPgQuery.mock.calls[0]?.[0] as string
    expect(germanCall).toContain('de_db_train_latest_stops')
  })

  it('uses gtfs_trips table with split_part for french trains', async () => {
    mockPgQuery.mockResolvedValue([])
    await GET(makeRequest())
    const frenchCall = mockPgQuery.mock.calls[1]?.[0] as string
    expect(frenchCall).toContain('gtfs_trips')
    expect(frenchCall).toContain("split_part(trip_id, ':', 1)")
    expect(frenchCall).toContain("'fr'")
  })

  it('uses gtfs_trips table with split_part for eurostar trains', async () => {
    mockPgQuery.mockResolvedValue([])
    await GET(makeRequest())
    const eurostarCall = mockPgQuery.mock.calls[2]?.[0] as string
    expect(eurostarCall).toContain('gtfs_trips')
    expect(eurostarCall).toContain("split_part(trip_id, ':', 1)")
    expect(eurostarCall).toContain("'eu'")
  })
})
