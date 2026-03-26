import type { LocationProvider } from './provider'
import { LocationProviderError, type LocationFeatureType, type LocationProviderResult } from '../types'

interface GooglePlaceRef {
  id?: string
  displayName?: { text?: string }
}

interface GoogleTextSearchResponse {
  places?: GooglePlaceRef[]
}

interface GoogleAddressComponent {
  longText?: string
  shortText?: string
  types?: string[]
}

interface GooglePlaceDetail {
  id?: string
  displayName?: { text?: string }
  location?: { latitude?: number; longitude?: number }
  addressComponents?: GoogleAddressComponent[]
  types?: string[]
}

function parseFeatureType(types: string[]): LocationFeatureType {
  if (types.some((t) => t === 'locality' || t === 'sublocality')) return 'locality'
  if (types.some((t) => t === 'administrative_area_level_1' || t === 'administrative_area_level_2')) return 'region'
  if (types.includes('country')) return 'country'
  return 'other'
}

function extractAddressFields(components: GoogleAddressComponent[]): {
  locality?: string
  region?: string
  country?: string
  countryCode?: string
} {
  let locality: string | undefined
  let region: string | undefined
  let country: string | undefined
  let countryCode: string | undefined

  for (const c of components) {
    const types = c.types ?? []
    if (types.includes('locality') && !locality) locality = c.longText || undefined
    if (types.includes('administrative_area_level_1') && !region) region = c.longText || undefined
    if (types.includes('country') && !country) {
      country = c.longText || undefined
      countryCode = c.shortText || undefined
    }
  }

  return { locality, region, country, countryCode }
}

function mapDetail(detail: GooglePlaceDetail): LocationProviderResult | null {
  const id = detail.id
  const name = detail.displayName?.text?.trim()
  const lat = detail.location?.latitude
  const lng = detail.location?.longitude

  if (!id || !name || !Number.isFinite(lat) || !Number.isFinite(lng)) return null

  const address = extractAddressFields(detail.addressComponents ?? [])
  const featureType = parseFeatureType(detail.types ?? [])

  return {
    sourceId: `google:${id}`,
    name,
    featureType,
    lat: lat as number,
    lng: lng as number,
    ...address,
  }
}

export class GooglePlacesLocationProvider implements LocationProvider {
  constructor(
    private readonly options: {
      apiKey: string
      baseUrl: string
      timeoutMs: number
    }
  ) {}

  async search(
    query: string,
    limit: number,
    _placeTypes?: LocationFeatureType[],
    countryBias?: string,
    countryRestrictions?: string[]
  ): Promise<LocationProviderResult[]> {
    const apiKey = this.options.apiKey.trim()
    if (!apiKey) {
      throw new LocationProviderError('LOOKUP_CONFIG_MISSING', 'Google Places API key missing')
    }

    const body: Record<string, unknown> = {
      textQuery: query,
      maxResultCount: Math.min(Math.max(limit, 1), 20),
      languageCode: 'en',
    }
    if (countryBias) body.regionCode = countryBias
    if (countryRestrictions && countryRestrictions.length > 0) body.includedRegionCodes = countryRestrictions

    const abortController = new AbortController()
    const timeout = setTimeout(() => abortController.abort(), this.options.timeoutMs)

    let textSearchResponse: Response
    try {
      textSearchResponse = await fetch(`${this.options.baseUrl}/v1/places:searchText`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'places.id,places.displayName',
        },
        body: JSON.stringify(body),
        signal: abortController.signal,
      })
    } catch {
      clearTimeout(timeout)
      throw new LocationProviderError('LOOKUP_UNAVAILABLE', 'Google Places Text Search fetch failed')
    } finally {
      clearTimeout(timeout)
    }

    if (textSearchResponse.status === 429) {
      throw new LocationProviderError('LOOKUP_RATE_LIMITED', 'Google Places rate limited')
    }
    if (!textSearchResponse.ok) {
      throw new LocationProviderError('LOOKUP_UNAVAILABLE', `Google Places Text Search HTTP ${textSearchResponse.status}`)
    }

    let payload: GoogleTextSearchResponse
    try {
      payload = (await textSearchResponse.json()) as GoogleTextSearchResponse
    } catch {
      throw new LocationProviderError('LOOKUP_UNAVAILABLE', 'Google Places Text Search payload parse failed')
    }

    const placeRefs = Array.isArray(payload.places) ? payload.places : []
    if (placeRefs.length === 0) return []

    const settled = await Promise.allSettled(
      placeRefs.map((ref) => this.fetchPlaceDetail(ref.id ?? '', apiKey))
    )

    const results: LocationProviderResult[] = []
    for (const outcome of settled) {
      if (outcome.status !== 'fulfilled') continue
      const mapped = mapDetail(outcome.value)
      if (mapped) results.push(mapped)
    }

    return results
  }

  private async fetchPlaceDetail(placeId: string, apiKey: string): Promise<GooglePlaceDetail> {
    const abortController = new AbortController()
    const timeout = setTimeout(() => abortController.abort(), this.options.timeoutMs)

    let response: Response
    try {
      response = await fetch(`${this.options.baseUrl}/v1/places/${placeId}`, {
        headers: {
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'id,displayName,location,addressComponents,types',
        },
        signal: abortController.signal,
      })
    } catch {
      clearTimeout(timeout)
      throw new LocationProviderError('LOOKUP_UNAVAILABLE', `Google Places Detail fetch failed for ${placeId}`)
    } finally {
      clearTimeout(timeout)
    }

    if (!response.ok) {
      throw new LocationProviderError('LOOKUP_UNAVAILABLE', `Google Places Detail HTTP ${response.status} for ${placeId}`)
    }

    try {
      return (await response.json()) as GooglePlaceDetail
    } catch {
      throw new LocationProviderError('LOOKUP_UNAVAILABLE', `Google Places Detail parse failed for ${placeId}`)
    }
  }
}
