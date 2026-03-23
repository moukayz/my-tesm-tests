import type { LocationProviderResult } from '../types'

export interface LocationProvider {
  search(query: string, limit: number): Promise<LocationProviderResult[]>
}
