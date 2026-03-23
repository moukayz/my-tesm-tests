/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'

const mockAuth = jest.fn()
const mockSearchLocations = jest.fn()

class MockLocationSearchInputError extends Error {
  status: number
  code: string

  constructor(status: number, code: string) {
    super(code)
    this.status = status
    this.code = code
  }
}

jest.mock('../../auth', () => ({ auth: mockAuth }))
jest.mock('../../app/lib/location-search/service', () => ({
  searchLocations: (...args: unknown[]) => mockSearchLocations(...args),
  LocationSearchInputError: MockLocationSearchInputError,
}))

describe('GET /api/locations/search', () => {
  beforeEach(() => {
    jest.resetModules()
    mockAuth.mockReset()
    mockSearchLocations.mockReset()
    mockAuth.mockResolvedValue({ user: { email: 'owner@example.com' } })
    mockSearchLocations.mockImplementation(async (query: string) => {
      if (query.trim().length < 2) {
        throw new MockLocationSearchInputError(400, 'LOCATION_QUERY_TOO_SHORT')
      }

      return {
        query: query.trim(),
        results: [],
      }
    })
  })

  it('returns 200 with normalized results', async () => {
    mockSearchLocations.mockResolvedValue({
      query: 'par',
      results: [
        {
          kind: 'resolved',
          label: 'Paris, Ile-de-France, France',
          queryText: 'par',
          coordinates: { lat: 48.85, lng: 2.35 },
          place: { placeId: 'geo:2988507', name: 'Paris', countryCode: 'FR', featureType: 'locality' },
        },
      ],
    })

    const route = await import('../../app/api/locations/search/route')
    const response = await route.GET(new NextRequest('http://localhost/api/locations/search?query=par&limit=5'))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      query: 'par',
      results: [
        {
          kind: 'resolved',
          label: 'Paris, Ile-de-France, France',
          queryText: 'par',
          coordinates: { lat: 48.85, lng: 2.35 },
          place: { placeId: 'geo:2988507', name: 'Paris', countryCode: 'FR', featureType: 'locality' },
        },
      ],
    })
    expect(mockSearchLocations).toHaveBeenCalledWith('par', 5, 'owner@example.com')
  })

  it('returns 401 when session is missing', async () => {
    mockAuth.mockResolvedValue(null)
    const route = await import('../../app/api/locations/search/route')
    const response = await route.GET(new NextRequest('http://localhost/api/locations/search?query=par'))

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'UNAUTHORIZED' })
  })

  it('returns 400 LOCATION_QUERY_TOO_SHORT for invalid query', async () => {
    const route = await import('../../app/api/locations/search/route')
    const response = await route.GET(new NextRequest('http://localhost/api/locations/search?query=p'))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'LOCATION_QUERY_TOO_SHORT' })
  })

  it('returns 500 INTERNAL_ERROR when search throws unexpectedly', async () => {
    mockSearchLocations.mockRejectedValue(new Error('boom'))
    const route = await import('../../app/api/locations/search/route')
    const response = await route.GET(new NextRequest('http://localhost/api/locations/search?query=par'))

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'INTERNAL_ERROR' })
  })
})
