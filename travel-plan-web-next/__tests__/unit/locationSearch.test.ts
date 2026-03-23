import { searchLocationSuggestions } from '../../app/lib/locations/search'

describe('searchLocationSuggestions', () => {
  beforeEach(() => {
    global.fetch = jest.fn()
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('returns empty results for short queries without calling backend', async () => {
    const response = await searchLocationSuggestions('a')

    expect(response).toEqual({ results: [] })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('calls backend search API and returns normalized resolved locations', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        query: 'Pa',
        results: [
          {
            kind: 'resolved',
            label: 'Paris',
            queryText: 'Pa',
            coordinates: { lng: 2.3522, lat: 48.8566 },
            place: {
              placeId: 'place-paris',
              name: 'Paris',
              locality: 'Paris',
              region: 'Ile-de-France',
              country: 'France',
              countryCode: 'FR',
            },
          },
        ],
      }),
    })

    const response = await searchLocationSuggestions(' Pa ')

    expect(global.fetch).toHaveBeenCalledWith('/api/locations/search?query=Pa&limit=5', expect.any(Object))
    expect(response).toEqual({
      results: [
        {
          kind: 'resolved',
          label: 'Paris',
          queryText: 'Pa',
          coordinates: { lng: 2.3522, lat: 48.8566 },
          place: {
            placeId: 'place-paris',
            name: 'Paris',
            locality: 'Paris',
            region: 'Ile-de-France',
            country: 'France',
            countryCode: 'FR',
          },
        },
      ],
    })
  })

  it('throws a lookup error when backend returns non-ok response', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ error: 'LOCATION_LOOKUP_UNAVAILABLE' }),
    })

    await expect(searchLocationSuggestions('Paris')).rejects.toThrow('LOCATION_LOOKUP_UNAVAILABLE')
  })
})
