import type { StayLocationResolved } from '../itinerary-store/types'

interface SearchLocationSuggestionsOptions {
  signal?: AbortSignal
  limit?: number
  placeTypes?: string[]
  countryBias?: string
}

interface LocationSearchResponse {
  query?: unknown
  results?: unknown
  degraded?: {
    code?: unknown
  }
}

interface SearchLocationSuggestionsResult {
  results: StayLocationResolved[]
  degradedCode?: string
}

function toTrimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function toResolvedLocation(queryText: string, value: unknown): StayLocationResolved | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null

  const row = value as Record<string, unknown>
  if (row.kind !== 'resolved') return null

  const label = toTrimmed(row.label)
  const coordinates = row.coordinates
  const place = row.place

  if (!coordinates || typeof coordinates !== 'object' || Array.isArray(coordinates)) return null
  if (!place || typeof place !== 'object' || Array.isArray(place)) return null

  const coords = coordinates as Record<string, unknown>
  const placeRecord = place as Record<string, unknown>

  const lng = Number(coords.lng)
  const lat = Number(coords.lat)
  const placeId = toTrimmed(placeRecord.placeId)
  const name = toTrimmed(placeRecord.name)

  if (label.length === 0 || !Number.isFinite(lng) || !Number.isFinite(lat) || placeId.length === 0 || name.length === 0) {
    return null
  }

  return {
    kind: 'resolved',
    label,
    queryText,
    coordinates: { lng, lat },
    place: {
      placeId,
      name,
      locality: toTrimmed(placeRecord.locality) || undefined,
      region: toTrimmed(placeRecord.region) || undefined,
      country: toTrimmed(placeRecord.country) || undefined,
      countryCode: toTrimmed(placeRecord.countryCode).toUpperCase() || undefined,
      featureType:
        placeRecord.featureType === 'locality' ||
        placeRecord.featureType === 'region' ||
        placeRecord.featureType === 'country' ||
        placeRecord.featureType === 'other'
          ? placeRecord.featureType
          : undefined,
    },
  }
}

function getErrorCode(body: unknown, fallback: string): string {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return fallback
  const code = (body as { error?: unknown }).error
  return typeof code === 'string' && code.trim().length > 0 ? code : fallback
}

export async function searchLocationSuggestions(
  queryText: string,
  options: SearchLocationSuggestionsOptions = {}
): Promise<SearchLocationSuggestionsResult> {
  const trimmed = queryText.trim()
  if (trimmed.length < 2) {
    return { results: [] }
  }

  const limit = Math.max(1, Math.min(options.limit ?? 5, 5))
  const params = new URLSearchParams({ query: trimmed, limit: String(limit) })
  if (options.placeTypes !== undefined) {
    params.set('placeTypes', options.placeTypes.join(','))
  }
  if (options.countryBias) {
    params.set('countryBias', options.countryBias)
  }
  const response = await fetch(`/api/locations/search?${params.toString()}`, {
    method: 'GET',
    signal: options.signal,
  })

  if (!response.ok) {
    let body: unknown
    try {
      body = await response.json()
    } catch {
      throw new Error('LOCATION_LOOKUP_UNAVAILABLE')
    }
    throw new Error(getErrorCode(body, 'LOCATION_LOOKUP_UNAVAILABLE'))
  }

  const payload = (await response.json()) as LocationSearchResponse
  const results = Array.isArray(payload.results)
    ? payload.results.map((item) => toResolvedLocation(trimmed, item)).filter((item): item is StayLocationResolved => item !== null)
    : []

  return {
    results: results.slice(0, limit),
    degradedCode: typeof payload.degraded?.code === 'string' ? payload.degraded.code : undefined,
  }
}
