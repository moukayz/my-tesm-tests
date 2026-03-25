import type { StayLocationResolved } from '../itinerary-store/types'

export type LocationFeatureType = 'locality' | 'region' | 'country' | 'continent' | 'other'

export interface LocationProviderResult {
  sourceId: string
  name: string
  locality?: string
  region?: string
  country?: string
  countryCode?: string
  featureType: LocationFeatureType
  lat: number
  lng: number
}

export type LocationSearchDegradedCode = 'LOOKUP_CONFIG_MISSING' | 'LOOKUP_UNAVAILABLE' | 'LOOKUP_RATE_LIMITED'

export interface LocationSearchResponse {
  query: string
  results: StayLocationResolved[]
  degraded?: {
    code: LocationSearchDegradedCode
  }
}

export class LocationProviderError extends Error {
  constructor(
    public readonly code: LocationSearchDegradedCode,
    message: string
  ) {
    super(message)
    this.name = 'LocationProviderError'
  }
}
