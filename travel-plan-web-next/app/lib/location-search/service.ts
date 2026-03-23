import logger from '../logger'
import type { StayLocationResolved } from '../itinerary-store/types'
import { getLocationSearchConfig } from './config'
import { GeoNamesLocationProvider } from './providers/geonames'
import type { LocationProvider } from './providers/provider'
import { LocationProviderError, type LocationProviderResult, type LocationSearchResponse } from './types'

export class LocationSearchInputError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string
  ) {
    super(code)
    this.name = 'LocationSearchInputError'
  }
}

function buildLabel(result: LocationProviderResult): string {
  const parts = [result.name, result.region, result.country]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter((value): value is string => value.length > 0)

  const deduped: string[] = []
  for (const part of parts) {
    if (!deduped.some((existing) => existing.toLowerCase() === part.toLowerCase())) {
      deduped.push(part)
    }
  }

  return deduped.join(', ')
}

function toResolvedLocation(query: string, result: LocationProviderResult): StayLocationResolved {
  return {
    kind: 'resolved',
    label: buildLabel(result),
    queryText: query,
    coordinates: { lat: result.lat, lng: result.lng },
    place: {
      placeId: result.sourceId,
      name: result.name,
      locality: result.locality,
      region: result.region,
      country: result.country,
      countryCode: result.countryCode?.toUpperCase(),
      featureType: result.featureType,
    },
  }
}

function parseQueryOrThrow(query: string): string {
  const trimmed = query.trim()
  if (trimmed.length < 2) throw new LocationSearchInputError(400, 'LOCATION_QUERY_TOO_SHORT')
  if (trimmed.length > 80) throw new LocationSearchInputError(400, 'LOCATION_QUERY_TOO_LONG')
  return trimmed
}

function parseLimitOrThrow(limit: number | undefined): number {
  if (limit === undefined) return 5
  if (!Number.isInteger(limit) || limit < 1 || limit > 5) {
    throw new LocationSearchInputError(400, 'LOCATION_LIMIT_INVALID')
  }
  return limit
}

export class LocationSearchService {
  constructor(private readonly provider: LocationProvider) {}

  async search(queryInput: string, limitInput?: number): Promise<LocationSearchResponse> {
    const query = parseQueryOrThrow(queryInput)
    const limit = parseLimitOrThrow(limitInput)

    let providerResults: LocationProviderResult[]
    try {
      providerResults = await this.provider.search(query, limit)
      providerResults.sort((a, b) => a.name.length - b.name.length)
    } catch (error) {
      if (error instanceof LocationProviderError) {
        return {
          query,
          results: [],
          degraded: { code: error.code },
        }
      }
      throw error
    }

    const dedupe = new Set<string>()
    const resolved: StayLocationResolved[] = []
    for (const item of providerResults) {
      const mapped = toResolvedLocation(query, item)
      if (!mapped.label) continue
      const key = `${mapped.place.placeId}|${mapped.label}`
      if (dedupe.has(key)) continue
      dedupe.add(key)
      resolved.push(mapped)
      if (resolved.length >= limit) break
    }

    return { query, results: resolved }
  }
}

let singletonService: LocationSearchService | null = null

export function getLocationSearchService(): LocationSearchService {
  if (singletonService) return singletonService
  const config = getLocationSearchConfig()

  const provider = new GeoNamesLocationProvider({
    username: config.geonamesUsername,
    baseUrl: config.geonamesBaseUrl,
    timeoutMs: config.timeoutMs,
  })

  singletonService = new LocationSearchService(provider)
  return singletonService
}

export async function searchLocations(query: string, limit: number | undefined, userEmail?: string) {
  const startedAt = Date.now()
  const response = await getLocationSearchService().search(query, limit)
  logger.info(
    {
      route: '/api/locations/search',
      userEmail,
      queryLength: query.trim().length,
      resultCount: response.results.length,
      degradedCode: response.degraded?.code,
      latencyMs: Date.now() - startedAt,
    },
    'location search completed'
  )
  return response
}

export type { LocationProvider, LocationProviderResult }
export { LocationProviderError }
