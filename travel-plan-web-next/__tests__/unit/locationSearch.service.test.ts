import {
  LocationProviderError,
  LocationSearchService,
  type LocationProvider,
  type LocationProviderResult,
} from '../../app/lib/location-search/service'

describe('LocationSearchService', () => {
  function providerWithResults(results: LocationProviderResult[]): LocationProvider {
    return {
      async search() {
        return results
      },
    }
  }

  it('forwards countryBias to the provider', async () => {
    const mockSearch = jest.fn().mockResolvedValue([])
    const provider: LocationProvider = { search: mockSearch }
    const service = new LocationSearchService(provider)

    await service.search('eiffel', 5, undefined, 'FR')

    expect(mockSearch).toHaveBeenCalledWith('eiffel', 5, undefined, 'FR', undefined)
  })

  it('forwards countryRestrictions to the provider', async () => {
    const mockSearch = jest.fn().mockResolvedValue([])
    const provider: LocationProvider = { search: mockSearch }
    const service = new LocationSearchService(provider)

    await service.search('par', 5, undefined, undefined, ['FR', 'DE'])

    expect(mockSearch).toHaveBeenCalledWith('par', 5, undefined, undefined, ['FR', 'DE'])
  })

  it('forwards both countryBias and countryRestrictions to the provider', async () => {
    const mockSearch = jest.fn().mockResolvedValue([])
    const provider: LocationProvider = { search: mockSearch }
    const service = new LocationSearchService(provider)

    await service.search('par', 5, ['locality'], 'FR', ['FR', 'BE'])

    expect(mockSearch).toHaveBeenCalledWith('par', 5, ['locality'], 'FR', ['FR', 'BE'])
  })

  it('normalizes labels, dedupes, and applies limit', async () => {
    const service = new LocationSearchService(
      providerWithResults([
        {
          sourceId: 'geo:1',
          name: 'Paris',
          locality: 'Paris',
          region: 'Ile-de-France',
          country: 'France',
          countryCode: 'fr',
          featureType: 'locality',
          lat: 48.85,
          lng: 2.35,
        },
        {
          sourceId: 'geo:1',
          name: 'Paris',
          locality: 'Paris',
          region: 'Ile-de-France',
          country: 'France',
          countryCode: 'fr',
          featureType: 'locality',
          lat: 48.85,
          lng: 2.35,
        },
        {
          sourceId: 'geo:2',
          name: 'Paris',
          country: 'United States',
          countryCode: 'us',
          featureType: 'locality',
          lat: 33.66,
          lng: -95.55,
        },
      ])
    )

    const response = await service.search('  par  ', 1)
    expect(response.query).toBe('par')
    expect(response.degraded).toBeUndefined()
    expect(response.results).toHaveLength(1)
    expect(response.results[0]).toEqual({
      kind: 'resolved',
      label: 'Paris, Ile-de-France, France',
      queryText: 'par',
      coordinates: { lat: 48.85, lng: 2.35 },
      place: {
        placeId: 'geo:1',
        name: 'Paris',
        locality: 'Paris',
        region: 'Ile-de-France',
        country: 'France',
        countryCode: 'FR',
        featureType: 'locality',
      },
    })
  })

  it('returns degraded LOOKUP_RATE_LIMITED on rate-limited provider', async () => {
    const provider: LocationProvider = {
      async search() {
        throw new LocationProviderError('LOOKUP_RATE_LIMITED', 'rate limited')
      },
    }

    const service = new LocationSearchService(provider)
    const response = await service.search('par', 5)
    expect(response.results).toEqual([])
    expect(response.degraded).toEqual({ code: 'LOOKUP_RATE_LIMITED' })
  })

  it('sorts results by name length ascending so shorter prefix matches rank first', async () => {
    const service = new LocationSearchService(
      providerWithResults([
        { sourceId: 'geo:paris', name: 'Paris', country: 'France', featureType: 'locality', lat: 48.85, lng: 2.35 },
        { sourceId: 'geo:par', name: 'Par', country: 'France', featureType: 'locality', lat: 48.0, lng: 2.0 },
        { sourceId: 'geo:parma', name: 'Parma', country: 'Italy', featureType: 'locality', lat: 44.8, lng: 10.33 },
      ])
    )

    const response = await service.search('par', 5)
    expect(response.results.map((r) => r.place.name)).toEqual(['Par', 'Paris', 'Parma'])
  })

  it('returns degraded LOOKUP_CONFIG_MISSING when provider config is absent', async () => {
    const provider: LocationProvider = {
      async search() {
        throw new LocationProviderError('LOOKUP_CONFIG_MISSING', 'missing')
      },
    }

    const service = new LocationSearchService(provider)
    const response = await service.search('par', 5)
    expect(response.results).toEqual([])
    expect(response.degraded).toEqual({ code: 'LOOKUP_CONFIG_MISSING' })
  })
})
