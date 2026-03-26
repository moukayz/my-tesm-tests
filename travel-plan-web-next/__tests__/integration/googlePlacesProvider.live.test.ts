/**
 * @jest-environment node
 *
 * Live integration tests — hit the real Google Places API.
 * Skipped automatically when GOOGLE_MAP_API_KEY is not set.
 *
 * To run:
 *   GOOGLE_MAP_API_KEY=<key> npm test -- --testPathPatterns=googlePlacesProvider.live
 */
import { GooglePlacesLocationProvider } from '../../app/lib/location-search/providers/google-places'
import type { LocationProviderResult } from '../../app/lib/location-search/types'

const API_KEY = process.env.GOOGLE_MAP_API_KEY ?? ''

function expectValidResult(result: LocationProviderResult) {
  expect(result.sourceId).toMatch(/^google:/)
  expect(typeof result.name).toBe('string')
  expect(result.name.length).toBeGreaterThan(0)
  expect(Number.isFinite(result.lat)).toBe(true)
  expect(Number.isFinite(result.lng)).toBe(true)
  expect(['locality', 'region', 'country', 'continent', 'other']).toContain(result.featureType)
}

;(API_KEY ? describe : describe.skip)('GooglePlacesLocationProvider — live', () => {
  let provider: GooglePlacesLocationProvider

  beforeAll(() => {
    provider = new GooglePlacesLocationProvider({
      apiKey: API_KEY,
      baseUrl: 'https://places.googleapis.com',
      timeoutMs: 5000,
    })
  })

  it('returns results for a well-known city query', async () => {
    const results = await provider.search('Paris', 3)

    expect(results.length).toBeGreaterThan(0)
    results.forEach(expectValidResult)

    const top = results[0]
    expect(top.country).toBeTruthy()
    expect(top.lat).toBeGreaterThan(40)
    expect(top.lat).toBeLessThan(55)
    expect(top.lng).toBeGreaterThan(-5)
    expect(top.lng).toBeLessThan(10)
  })

  it('returns a country result for a country name query', async () => {
    const results = await provider.search('Germany', 3)

    expect(results.length).toBeGreaterThan(0)
    results.forEach(expectValidResult)

    const countryResult = results.find((r) => r.featureType === 'country')
    expect(countryResult).toBeDefined()
  })

  it('respects countryBias — top result matches the given country', async () => {
    const results = await provider.search('Paris', 3, undefined, 'FR')

    expect(results.length).toBeGreaterThan(0)
    results.forEach(expectValidResult)
    expect(results[0].countryCode?.toUpperCase()).toBe('FR')
  })

  it('respects countryRestrictions — all results are within the restricted countries', async () => {
    const results = await provider.search('Berlin', 3, undefined, undefined, ['DE'])

    expect(results.length).toBeGreaterThan(0)
    results.forEach(expectValidResult)

    for (const result of results) {
      if (result.countryCode) {
        expect(result.countryCode.toUpperCase()).toBe('DE')
      }
    }
  })

  it('result sourceIds are unique across results', async () => {
    const results = await provider.search('London', 5)

    expect(results.length).toBeGreaterThan(0)
    const ids = results.map((r) => r.sourceId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('returns empty or valid results for a nonsense query', async () => {
    const results = await provider.search('xzxzxzxzxzxz', 5)
    results.forEach(expectValidResult)
  })
})
