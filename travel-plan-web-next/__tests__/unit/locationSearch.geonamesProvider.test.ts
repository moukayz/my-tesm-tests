/**
 * @jest-environment node
 */
import { GeoNamesLocationProvider } from '../../app/lib/location-search/providers/geonames'
import { LocationProviderError } from '../../app/lib/location-search/types'

describe('GeoNamesLocationProvider', () => {
  beforeEach(() => {
    global.fetch = jest.fn()
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('maps valid GeoNames rows and drops malformed rows', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        geonames: [
          {
            geonameId: 2988507,
            name: 'Paris',
            toponymName: 'Paris',
            lat: '48.85341',
            lng: '2.3488',
            countryName: 'France',
            countryCode: 'FR',
            adminName1: 'Ile-de-France',
            fcl: 'P',
            fcode: 'PPLC',
          },
          {
            geonameId: 123,
            name: 'Bad city',
            lat: 'not-a-number',
            lng: '2.3',
          },
        ],
      }),
    })

    const provider = new GeoNamesLocationProvider({
      username: 'demo-user',
      baseUrl: 'https://api.geonames.org',
      timeoutMs: 1200,
    })

    const results = await provider.search('par', 5)
    expect(results).toEqual([
      {
        sourceId: 'geonames:2988507',
        name: 'Paris',
        locality: 'Paris',
        region: 'Ile-de-France',
        country: 'France',
        countryCode: 'FR',
        featureType: 'locality',
        lat: 48.85341,
        lng: 2.3488,
      },
    ])
  })

  it('caps maxRows to five for outbound requests and includes featureClass P, A, T', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ geonames: [] }),
    })

    const provider = new GeoNamesLocationProvider({
      username: 'demo-user',
      baseUrl: 'https://api.geonames.org',
      timeoutMs: 1200,
    })

    await provider.search('par', 10)
    const requestedUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string
    const request = new URL(requestedUrl)

    expect(request.pathname).toBe('/searchJSON')
    expect(request.searchParams.get('maxRows')).toBe('5')
    expect(request.searchParams.get('name_startsWith')).toBe('par')
    expect(request.searchParams.get('username')).toBe('demo-user')
    expect(request.searchParams.getAll('featureClass')).toEqual(expect.arrayContaining(['P', 'A', 'T']))
  })

  it('includes countryBias param in outbound request when provided', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ geonames: [] }),
    })

    const provider = new GeoNamesLocationProvider({
      username: 'demo-user',
      baseUrl: 'https://api.geonames.org',
      timeoutMs: 1200,
    })

    await provider.search('eiffel', 5, undefined, 'FR')
    const requestedUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string
    const request = new URL(requestedUrl)

    expect(request.searchParams.get('countryBias')).toBe('FR')
  })

  it('omits countryBias param when not provided', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ geonames: [] }),
    })

    const provider = new GeoNamesLocationProvider({
      username: 'demo-user',
      baseUrl: 'https://api.geonames.org',
      timeoutMs: 1200,
    })

    await provider.search('par', 5)
    const requestedUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string
    const request = new URL(requestedUrl)

    expect(request.searchParams.has('countryBias')).toBe(false)
  })

  it('maps island feature codes (T/ISL) to featureType locality', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        geonames: [
          {
            geonameId: 3370903,
            name: 'Île Sainte-Hélène',
            toponymName: 'Île Sainte-Hélène',
            lat: '-15.9333',
            lng: '-5.7',
            countryName: 'Saint Helena',
            countryCode: 'SH',
            adminName1: '',
            fcl: 'T',
            fcode: 'ISL',
          },
          {
            geonameId: 9999001,
            name: 'Some Mountain',
            toponymName: 'Some Mountain',
            lat: '45.0',
            lng: '7.0',
            countryName: 'Italy',
            countryCode: 'IT',
            adminName1: '',
            fcl: 'T',
            fcode: 'MT',
          },
        ],
      }),
    })

    const provider = new GeoNamesLocationProvider({
      username: 'demo-user',
      baseUrl: 'https://api.geonames.org',
      timeoutMs: 1200,
    })

    const results = await provider.search('île', 5)
    const island = results.find((r) => r.sourceId === 'geonames:3370903')
    const mountain = results.find((r) => r.sourceId === 'geonames:9999001')

    expect(island?.featureType).toBe('locality')
    expect(mountain?.featureType).toBe('other')
  })

  it('maps HTTP 429 to LOOKUP_RATE_LIMITED', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 429,
    })

    const provider = new GeoNamesLocationProvider({
      username: 'demo-user',
      baseUrl: 'https://api.geonames.org',
      timeoutMs: 1200,
    })

    await expect(provider.search('par', 5)).rejects.toEqual(
      expect.objectContaining<LocationProviderError>({ code: 'LOOKUP_RATE_LIMITED' })
    )
  })

  it('maps GeoNames rate-limit status payload to LOOKUP_RATE_LIMITED', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: {
          value: 18,
          message: 'the daily limit of 30000 credits for demo-user has been exceeded',
        },
      }),
    })

    const provider = new GeoNamesLocationProvider({
      username: 'demo-user',
      baseUrl: 'https://api.geonames.org',
      timeoutMs: 1200,
    })

    await expect(provider.search('par', 5)).rejects.toEqual(
      expect.objectContaining<LocationProviderError>({ code: 'LOOKUP_RATE_LIMITED' })
    )
  })
})
