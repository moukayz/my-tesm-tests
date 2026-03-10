/**
 * @jest-environment node
 */
jest.mock('../../app/lib/db', () => ({
  query: jest.fn(),
  PARQUET: 'mock_parquet',
  EURO_GTFS: 'mock_euro',
  convertBigInt: jest.fn((x) => x),
}))

import { GET } from '../../app/api/timetable/route'
import { query } from '../../app/lib/db'

const mockQuery = query as jest.Mock

function makeRequest(params: Record<string, string>) {
  const url = new URL('http://localhost/api/timetable')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return new Request(url.toString())
}

const mockRows = [
  {
    station_name: 'Berlin Hauptbahnhof',
    station_num: 1,
    arrival_planned_time: null,
    departure_planned_time: '2026-02-09 23:10:00',
    ride_date: '2026-02-09 00:00:00',
  },
  {
    station_name: 'München Hbf',
    station_num: 2,
    arrival_planned_time: '2026-02-10 07:14:00',
    departure_planned_time: null,
    ride_date: '2026-02-09 00:00:00',
  },
]

describe('GET /api/timetable', () => {
  beforeEach(() => mockQuery.mockReset())

  it('returns 400 when train param is missing', async () => {
    const res = await GET(makeRequest({}))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('train')
  })

  it('returns timetable rows from the database', async () => {
    mockQuery.mockResolvedValue(mockRows)
    const res = await GET(makeRequest({ train: 'ICE 905' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual(mockRows)
  })

  it('escapes single quotes in train name', async () => {
    mockQuery.mockResolvedValue([])
    await GET(makeRequest({ train: "O'Hare Express" }))
    const sql: string = mockQuery.mock.calls[0][0]
    expect(sql).toContain("O''Hare Express")
  })

  it('returns 500 on db error', async () => {
    mockQuery.mockRejectedValue(new Error('Connection timeout'))
    const res = await GET(makeRequest({ train: 'ICE 905' }))
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toBe('Connection timeout')
  })

  it('returns 400 for unknown railway value', async () => {
    const res = await GET(makeRequest({ train: 'ICE 905', railway: 'unknown_railway' }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBeDefined()
  })

  it('returns french timetable rows for railway=french', async () => {
    const frenchRows = [
      { station_name: 'Paris Gare de Lyon', station_num: 0, arrival_planned_time: null, departure_planned_time: '07:14:00', ride_date: null },
      { station_name: 'Lyon Part-Dieu', station_num: 5, arrival_planned_time: '09:00:00', departure_planned_time: null, ride_date: null },
    ]
    mockQuery.mockResolvedValue(frenchRows)
    const res = await GET(makeRequest({ train: '6201', railway: 'french' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual(frenchRows)
    const sql: string = mockQuery.mock.calls[0][0]
    expect(sql).toContain('trip_headsign')
    expect(sql).toContain("'arrival_time': 'VARCHAR'")
    expect(sql).not.toContain('GROUP BY st.stop_sequence')
    expect(sql).toContain('canonical_trip')
    expect(sql).toContain('LIMIT 1')
  })

  it('returns eurostar timetable rows for railway=eurostar', async () => {
    const eurostarRows = [
      { station_name: 'Paris Nord', station_num: 1, arrival_planned_time: null, departure_planned_time: '07:14:00', ride_date: '2026-03-10' },
      { station_name: 'London St Pancras', station_num: 2, arrival_planned_time: '09:00:00', departure_planned_time: null, ride_date: '2026-03-10' },
    ]
    mockQuery.mockResolvedValue(eurostarRows)
    const res = await GET(makeRequest({ train: '9002', railway: 'eurostar' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual(eurostarRows)
    const sql: string = mockQuery.mock.calls[0][0]
    expect(sql).toContain('trip_headsign')
    expect(sql).toContain("split_part")
  })
})
