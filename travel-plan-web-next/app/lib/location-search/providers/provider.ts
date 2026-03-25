import type { LocationFeatureType, LocationProviderResult } from '../types'

export interface LocationProvider {
  search(query: string, limit: number, placeTypes?: LocationFeatureType[], countryBias?: string, countryRestrictions?: string[]): Promise<LocationProviderResult[]>
}
