/**
 * @jest-environment node
 */
import { GooglePlacesLocationProvider } from '../../app/lib/location-search/providers/google-places'
import { LocationProviderError } from '../../app/lib/location-search/types'

const PROVIDER_OPTIONS = {
  apiKey: 'test-api-key',
  baseUrl: 'https://places.googleapis.com',
  timeoutMs: 1200,
}

function makeTextSearchResponse(placeRefs: Array<{ id: string; displayName?: { text: string } }>) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ places: placeRefs }),
  }
}

function makeDetailResponse(detail: object) {
  return {
    ok: true,
    status: 200,
    json: async () => detail,
  }
}

const PARIS_DETAIL = {
  id: 'ChIJ123',
  displayName: { text: 'Paris' },
  location: { latitude: 48.8566, longitude: 2.3522 },
  addressComponents: [
    { longText: 'Paris', shortText: 'Paris', types: ['locality', 'political'] },
    { longText: 'Île-de-France', shortText: 'IDF', types: ['administrative_area_level_1', 'political'] },
    { longText: 'France', shortText: 'FR', types: ['country', 'political'] },
  ],
  types: ['locality', 'political'],
}

describe('GooglePlacesLocationProvider', () => {
  beforeEach(() => {
    global.fetch = jest.fn()
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('maps valid Text Search + Place Details into LocationProviderResult and makes exactly 2 fetch calls', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(makeTextSearchResponse([{ id: 'ChIJ123', displayName: { text: 'Paris' } }]))
      .mockResolvedValueOnce(makeDetailResponse(PARIS_DETAIL))

    const provider = new GooglePlacesLocationProvider(PROVIDER_OPTIONS)
    const results = await provider.search('par', 5)

    expect(global.fetch).toHaveBeenCalledTimes(2)
    expect(results).toEqual([
      {
        sourceId: 'google:ChIJ123',
        name: 'Paris',
        locality: 'Paris',
        region: 'Île-de-France',
        country: 'France',
        countryCode: 'FR',
        featureType: 'locality',
        lat: 48.8566,
        lng: 2.3522,
      },
    ])
  })

  it('drops result when Place Details has missing location', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(makeTextSearchResponse([{ id: 'ChIJaaa' }, { id: 'ChIJbbb' }]))
      .mockResolvedValueOnce(makeDetailResponse({ id: 'ChIJaaa', displayName: { text: 'Good Place' }, location: { latitude: 48.8, longitude: 2.3 }, addressComponents: [], types: ['locality'] }))
      .mockResolvedValueOnce(makeDetailResponse({ id: 'ChIJbbb', displayName: { text: 'No Coords' }, addressComponents: [], types: ['locality'] }))

    const provider = new GooglePlacesLocationProvider(PROVIDER_OPTIONS)
    const results = await provider.search('par', 5)

    expect(results).toHaveLength(1)
    expect(results[0].sourceId).toBe('google:ChIJaaa')
  })

  it('drops result when Place Details has missing displayName', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(makeTextSearchResponse([{ id: 'ChIJ123' }]))
      .mockResolvedValueOnce(makeDetailResponse({ id: 'ChIJ123', location: { latitude: 48.8, longitude: 2.3 }, addressComponents: [], types: ['locality'] }))

    const provider = new GooglePlacesLocationProvider(PROVIDER_OPTIONS)
    const results = await provider.search('par', 5)

    expect(results).toHaveLength(0)
  })

  it('Text Search request has correct body fields, API key header, and minimal FieldMask', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(makeTextSearchResponse([]))

    const provider = new GooglePlacesLocationProvider(PROVIDER_OPTIONS)
    await provider.search('par', 5)

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://places.googleapis.com/v1/places:searchText')
    expect(init.method).toBe('POST')

    const body = JSON.parse(init.body as string)
    expect(body.textQuery).toBe('par')
    expect(body.maxResultCount).toBe(5)
    expect(body.languageCode).toBe('en')

    const headers = init.headers as Record<string, string>
    expect(headers['X-Goog-Api-Key']).toBe('test-api-key')
    expect(headers['X-Goog-FieldMask']).toBe('places.id,places.displayName')
  })

  it('Text Search includes regionCode when countryBias is provided', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(makeTextSearchResponse([]))

    const provider = new GooglePlacesLocationProvider(PROVIDER_OPTIONS)
    await provider.search('eiffel', 5, undefined, 'FR')

    const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string)
    expect(body.regionCode).toBe('FR')
  })

  it('Text Search omits regionCode when countryBias is not provided', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(makeTextSearchResponse([]))

    const provider = new GooglePlacesLocationProvider(PROVIDER_OPTIONS)
    await provider.search('par', 5)

    const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string)
    expect(body).not.toHaveProperty('regionCode')
  })

  it('Text Search includes includedRegionCodes when countryRestrictions is provided', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(makeTextSearchResponse([]))

    const provider = new GooglePlacesLocationProvider(PROVIDER_OPTIONS)
    await provider.search('par', 5, undefined, undefined, ['FR', 'DE'])

    const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string)
    expect(body.includedRegionCodes).toEqual(['FR', 'DE'])
  })

  it('Text Search omits includedRegionCodes when countryRestrictions is not provided', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(makeTextSearchResponse([]))

    const provider = new GooglePlacesLocationProvider(PROVIDER_OPTIONS)
    await provider.search('par', 5)

    const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string)
    expect(body).not.toHaveProperty('includedRegionCodes')
  })

  it('Place Details request uses correct URL and restricted FieldMask', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(makeTextSearchResponse([{ id: 'ChIJ123', displayName: { text: 'Paris' } }]))
      .mockResolvedValueOnce(makeDetailResponse(PARIS_DETAIL))

    const provider = new GooglePlacesLocationProvider(PROVIDER_OPTIONS)
    await provider.search('par', 5)

    const [detailUrl, detailInit] = (global.fetch as jest.Mock).mock.calls[1] as [string, RequestInit]
    expect(detailUrl).toBe('https://places.googleapis.com/v1/places/ChIJ123')

    const headers = detailInit.headers as Record<string, string>
    expect(headers['X-Goog-FieldMask']).toBe('id,displayName,location,addressComponents,types')
    expect(headers['X-Goog-Api-Key']).toBe('test-api-key')
  })

  it('maps types including locality to featureType locality', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(makeTextSearchResponse([{ id: 'ChIJ1' }]))
      .mockResolvedValueOnce(makeDetailResponse({ id: 'ChIJ1', displayName: { text: 'Paris' }, location: { latitude: 48.8, longitude: 2.3 }, addressComponents: [], types: ['locality', 'political'] }))

    const provider = new GooglePlacesLocationProvider(PROVIDER_OPTIONS)
    const results = await provider.search('par', 5)
    expect(results[0].featureType).toBe('locality')
  })

  it('maps types including administrative_area_level_1 to featureType region', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(makeTextSearchResponse([{ id: 'ChIJ1' }]))
      .mockResolvedValueOnce(makeDetailResponse({ id: 'ChIJ1', displayName: { text: 'Île-de-France' }, location: { latitude: 48.8, longitude: 2.3 }, addressComponents: [], types: ['administrative_area_level_1', 'political'] }))

    const provider = new GooglePlacesLocationProvider(PROVIDER_OPTIONS)
    const results = await provider.search('ile', 5)
    expect(results[0].featureType).toBe('region')
  })

  it('maps types including country to featureType country', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(makeTextSearchResponse([{ id: 'ChIJ1' }]))
      .mockResolvedValueOnce(makeDetailResponse({ id: 'ChIJ1', displayName: { text: 'France' }, location: { latitude: 46.0, longitude: 2.0 }, addressComponents: [], types: ['country', 'political'] }))

    const provider = new GooglePlacesLocationProvider(PROVIDER_OPTIONS)
    const results = await provider.search('france', 5)
    expect(results[0].featureType).toBe('country')
  })

  it('maps unrecognized types to featureType other', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(makeTextSearchResponse([{ id: 'ChIJ1' }]))
      .mockResolvedValueOnce(makeDetailResponse({ id: 'ChIJ1', displayName: { text: 'Rue de Rivoli' }, location: { latitude: 48.8, longitude: 2.3 }, addressComponents: [], types: ['route', 'street_address'] }))

    const provider = new GooglePlacesLocationProvider(PROVIDER_OPTIONS)
    const results = await provider.search('rue', 5)
    expect(results[0].featureType).toBe('other')
  })

  it('throws LOOKUP_CONFIG_MISSING when API key is empty and makes no fetch calls', async () => {
    const provider = new GooglePlacesLocationProvider({ ...PROVIDER_OPTIONS, apiKey: '' })
    await expect(provider.search('par', 5)).rejects.toEqual(
      expect.objectContaining<LocationProviderError>({ code: 'LOOKUP_CONFIG_MISSING' })
    )
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('maps HTTP 429 on Text Search to LOOKUP_RATE_LIMITED', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 429 })

    const provider = new GooglePlacesLocationProvider(PROVIDER_OPTIONS)
    await expect(provider.search('par', 5)).rejects.toEqual(
      expect.objectContaining<LocationProviderError>({ code: 'LOOKUP_RATE_LIMITED' })
    )
  })

  it('maps HTTP 500 on Text Search to LOOKUP_UNAVAILABLE', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 500 })

    const provider = new GooglePlacesLocationProvider(PROVIDER_OPTIONS)
    await expect(provider.search('par', 5)).rejects.toEqual(
      expect.objectContaining<LocationProviderError>({ code: 'LOOKUP_UNAVAILABLE' })
    )
  })

  it('maps network failure on Text Search to LOOKUP_UNAVAILABLE', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

    const provider = new GooglePlacesLocationProvider(PROVIDER_OPTIONS)
    await expect(provider.search('par', 5)).rejects.toEqual(
      expect.objectContaining<LocationProviderError>({ code: 'LOOKUP_UNAVAILABLE' })
    )
  })

  it('returns partial results when one parallel Place Detail call fails', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(makeTextSearchResponse([{ id: 'ChIJgood' }, { id: 'ChIJbad' }]))
      .mockResolvedValueOnce(makeDetailResponse({ id: 'ChIJgood', displayName: { text: 'Good Place' }, location: { latitude: 48.8, longitude: 2.3 }, addressComponents: [], types: ['locality'] }))
      .mockResolvedValueOnce({ ok: false, status: 500 })

    const provider = new GooglePlacesLocationProvider(PROVIDER_OPTIONS)
    const results = await provider.search('par', 5)

    expect(results).toHaveLength(1)
    expect(results[0].sourceId).toBe('google:ChIJgood')
  })

  it('returns empty array when Text Search returns empty places', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(makeTextSearchResponse([]))

    const provider = new GooglePlacesLocationProvider(PROVIDER_OPTIONS)
    const results = await provider.search('par', 5)

    expect(results).toEqual([])
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('returns empty array when Text Search response has no places key', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
    })

    const provider = new GooglePlacesLocationProvider(PROVIDER_OPTIONS)
    const results = await provider.search('par', 5)

    expect(results).toEqual([])
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })
})
