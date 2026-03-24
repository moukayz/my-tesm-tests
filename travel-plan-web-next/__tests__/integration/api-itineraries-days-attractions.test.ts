/**
 * @jest-environment node
 */
import fs from 'fs'
import os from 'os'
import path from 'path'
import { NextRequest } from 'next/server'

const mockAuth = jest.fn()
jest.mock('../../auth', () => ({ auth: mockAuth }))

describe('PATCH /api/itineraries/[id]/days/[dayIndex]/attractions', () => {
  let tempDir: string

  function patchReq(url: string, body: unknown) {
    return new NextRequest(url, {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    })
  }

  beforeEach(() => {
    jest.resetModules()
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'itinerary-attractions-'))
    process.env.ITINERARY_DATA_DIR = tempDir
    delete process.env.KV_REST_API_URL
    delete process.env.KV_REST_API_TOKEN
    mockAuth.mockReset()
    mockAuth.mockResolvedValue({ user: { email: 'owner@example.com' } })
  })

  afterEach(() => {
    delete process.env.ITINERARY_DATA_DIR
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  async function createItineraryWithDays() {
    const createRoute = await import('../../app/api/itineraries/route')
    const createRes = await createRoute.POST(
      new NextRequest('http://localhost/api/itineraries', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test', startDate: '2026-04-01' }),
        headers: { 'Content-Type': 'application/json' },
      })
    )
    const { itinerary } = await createRes.json()
    const itineraryId = itinerary.id as string

    const appendRoute = await import('../../app/api/itineraries/[itineraryId]/stays/route')
    await appendRoute.POST(
      new NextRequest(`http://localhost/api/itineraries/${itineraryId}/stays`, {
        method: 'POST',
        body: JSON.stringify({ city: 'Paris', nights: 2 }),
        headers: { 'Content-Type': 'application/json' },
      }),
      { params: Promise.resolve({ itineraryId }) }
    )
    return itineraryId
  }

  it('returns 200 and persists attractions on valid PATCH', async () => {
    const itineraryId = await createItineraryWithDays()
    const attractions = [
      { id: 'geonames:2988507', label: 'Eiffel Tower', coordinates: { lat: 48.858, lng: 2.294 } },
    ]

    const attractionsRoute = await import(
      '../../app/api/itineraries/[itineraryId]/days/[dayIndex]/attractions/route'
    )
    const res = await attractionsRoute.PATCH(
      patchReq(`http://localhost/api/itineraries/${itineraryId}/days/0/attractions`, { attractions }),
      { params: Promise.resolve({ itineraryId, dayIndex: '0' }) }
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.attractions).toEqual(attractions)
  })

  it('accepts empty attractions array to clear all', async () => {
    const itineraryId = await createItineraryWithDays()

    const attractionsRoute = await import(
      '../../app/api/itineraries/[itineraryId]/days/[dayIndex]/attractions/route'
    )
    const res = await attractionsRoute.PATCH(
      patchReq(`http://localhost/api/itineraries/${itineraryId}/days/0/attractions`, { attractions: [] }),
      { params: Promise.resolve({ itineraryId, dayIndex: '0' }) }
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.attractions).toEqual([])
  })

  it('returns 401 when unauthenticated', async () => {
    const itineraryId = await createItineraryWithDays()
    mockAuth.mockResolvedValue(null)

    const attractionsRoute = await import(
      '../../app/api/itineraries/[itineraryId]/days/[dayIndex]/attractions/route'
    )
    const res = await attractionsRoute.PATCH(
      patchReq(`http://localhost/api/itineraries/${itineraryId}/days/0/attractions`, { attractions: [] }),
      { params: Promise.resolve({ itineraryId, dayIndex: '0' }) }
    )
    expect(res.status).toBe(401)
  })

  it('returns 403 when wrong owner', async () => {
    const itineraryId = await createItineraryWithDays()
    mockAuth.mockResolvedValue({ user: { email: 'other@example.com' } })

    const attractionsRoute = await import(
      '../../app/api/itineraries/[itineraryId]/days/[dayIndex]/attractions/route'
    )
    const res = await attractionsRoute.PATCH(
      patchReq(`http://localhost/api/itineraries/${itineraryId}/days/0/attractions`, { attractions: [] }),
      { params: Promise.resolve({ itineraryId, dayIndex: '0' }) }
    )
    expect(res.status).toBe(403)
  })

  it.each([
    { dayIndex: 'bad', body: { attractions: [] } },
    { dayIndex: '99', body: { attractions: [] } },
    { dayIndex: '0', body: { attractions: 'not-array' } },
    { dayIndex: '0', body: { attractions: [{ id: '', label: 'Ok' }] } },
    { dayIndex: '0', body: { attractions: [{ id: 'x', label: '' }] } },
  ])('returns 400 for invalid input (dayIndex=%s)', async ({ dayIndex, body }) => {
    const itineraryId = await createItineraryWithDays()

    const attractionsRoute = await import(
      '../../app/api/itineraries/[itineraryId]/days/[dayIndex]/attractions/route'
    )
    const res = await attractionsRoute.PATCH(
      patchReq(`http://localhost/api/itineraries/${itineraryId}/days/${dayIndex}/attractions`, body),
      { params: Promise.resolve({ itineraryId, dayIndex }) }
    )
    expect(res.status).toBe(400)
  })
})
