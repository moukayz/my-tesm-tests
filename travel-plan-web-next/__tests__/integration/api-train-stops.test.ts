/**
 * @jest-environment node
 */
jest.mock('../../app/lib/db', () => ({
  query: jest.fn(),
  PARQUET: 'mock_parquet',
  convertBigInt: jest.fn((x) => x),
}))

import { GET } from '../../app/api/train-stops/route'
import { query } from '../../app/lib/db'

const mockQuery = query as jest.Mock

function makeRequest(params: Record<string, string>) {
  const url = new URL('http://localhost/api/train-stops')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return new Request(url.toString())
}

const mockTimetable = [
  {
    station_name: 'Berlin Hauptbahnhof',
    station_num: 1,
    arrival_planned_time: null,
    departure_planned_time: '2026-02-09 07:30:00',
    ride_date: '2026-02-09 00:00:00',
  },
  {
    station_name: 'Augsburg Hbf',
    station_num: 2,
    arrival_planned_time: '2026-02-09 09:15:00',
    departure_planned_time: '2026-02-09 09:20:00',
    ride_date: '2026-02-09 00:00:00',
  },
  {
    station_name: 'München Hbf',
    station_num: 3,
    arrival_planned_time: '2026-02-09 10:45:00',
    departure_planned_time: '2026-02-09 10:50:00',
    ride_date: '2026-02-09 00:00:00',
  },
  {
    station_name: 'Rosenheim',
    station_num: 4,
    arrival_planned_time: '2026-02-09 11:30:00',
    departure_planned_time: null,
    ride_date: '2026-02-09 00:00:00',
  },
]

describe('GET /api/train-stops', () => {
  beforeEach(() => mockQuery.mockReset())

  it('returns 400 when train param is missing', async () => {
    const res = await GET(makeRequest({ from: 'Augsburg', to: 'Munich' }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('train')
  })

  it('returns 400 when from param is missing', async () => {
    const res = await GET(makeRequest({ train: 'ICE 905', to: 'Munich' }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('from')
  })

  it('returns 400 when to param is missing', async () => {
    const res = await GET(makeRequest({ train: 'ICE 905', from: 'Augsburg' }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('to')
  })

  it('returns null when train not found in timetable', async () => {
    mockQuery.mockResolvedValue([])
    const res = await GET(makeRequest({ train: 'ICE 905', from: 'Augsburg', to: 'Munich' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toBeNull()
  })

  it('returns departure and arrival times for matching cities', async () => {
    mockQuery.mockResolvedValue(mockTimetable)
    const res = await GET(makeRequest({ train: 'ICE 905', from: 'Augsburg', to: 'Munich' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual({
      fromStation: 'Augsburg Hbf',
      depTime: '09:20',
      toStation: 'München Hbf',
      arrTime: '10:45',
    })
  })

  it('handles case-insensitive city matching', async () => {
    mockQuery.mockResolvedValue(mockTimetable)
    const res = await GET(makeRequest({ train: 'ICE 905', from: 'augsburg', to: 'munich' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual({
      fromStation: 'Augsburg Hbf',
      depTime: '09:20',
      toStation: 'München Hbf',
      arrTime: '10:45',
    })
  })

  it('applies city aliases (Cologne → Köln, Munich → München)', async () => {
    mockQuery.mockResolvedValue(mockTimetable)
    const res = await GET(makeRequest({ train: 'ICE 905', from: 'Augsburg', to: 'Munich' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    // München Hbf should match "Munich"
    expect(data.toStation).toContain('München')
  })

  it('returns null when from city cannot be found', async () => {
    mockQuery.mockResolvedValue(mockTimetable)
    const res = await GET(makeRequest({ train: 'ICE 905', from: 'Paris', to: 'Munich' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toBeNull()
  })

  it('returns null when to city cannot be found', async () => {
    mockQuery.mockResolvedValue(mockTimetable)
    const res = await GET(makeRequest({ train: 'ICE 905', from: 'Augsburg', to: 'Paris' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toBeNull()
  })

  it('escapes single quotes in train name', async () => {
    mockQuery.mockResolvedValue([])
    await GET(makeRequest({ train: "O'Hare Express", from: 'City1', to: 'City2' }))
    const sql: string = mockQuery.mock.calls[0][0]
    expect(sql).toContain("O''Hare Express")
  })

  it('returns 500 on db error', async () => {
    mockQuery.mockRejectedValue(new Error('Connection timeout'))
    const res = await GET(makeRequest({ train: 'ICE 905', from: 'Augsburg', to: 'Munich' }))
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toBe('Connection timeout')
  })

  it('formats times as HH:MM', async () => {
    mockQuery.mockResolvedValue(mockTimetable)
    const res = await GET(makeRequest({ train: 'ICE 905', from: 'Augsburg', to: 'Munich' }))
    const data = await res.json()
    expect(data.depTime).toMatch(/^\d{2}:\d{2}$/)
    expect(data.arrTime).toMatch(/^\d{2}:\d{2}$/)
  })
})
