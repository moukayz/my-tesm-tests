import type { LocationProvider } from './provider'
import { LocationProviderError, type LocationFeatureType, type LocationProviderResult } from '../types'

const FEATURE_TYPE_TO_CLASSES: Record<LocationFeatureType, string[]> = {
  locality: ['P'],
  region: ['A'],
  country: ['A'],
  continent: ['L'],
  other: ['T', 'S', 'H', 'L', 'R', 'U', 'V'],
}

function placeTypesToFeatureClasses(placeTypes: LocationFeatureType[]): string[] {
  const classes = new Set<string>()
  for (const t of placeTypes) {
    for (const cls of FEATURE_TYPE_TO_CLASSES[t]) {
      classes.add(cls)
    }
  }
  return [...classes]
}

interface GeoNamesResultRow {
  geonameId?: number
  name?: string
  toponymName?: string
  lat?: string
  lng?: string
  countryName?: string
  countryCode?: string
  adminName1?: string
  fcl?: string
  fcode?: string
}

interface GeoNamesResponse {
  geonames?: GeoNamesResultRow[]
  status?: {
    value?: number
    message?: string
  }
}

function mapGeoNamesStatusCode(statusCode: number, message: string): 'LOOKUP_RATE_LIMITED' | 'LOOKUP_UNAVAILABLE' {
  const rateLimitedCodes = new Set([18, 19, 20])
  if (rateLimitedCodes.has(statusCode)) {
    return 'LOOKUP_RATE_LIMITED'
  }

  const normalizedMessage = message.trim().toLowerCase()
  if (normalizedMessage.includes('limit') || normalizedMessage.includes('credit')) {
    return 'LOOKUP_RATE_LIMITED'
  }

  return 'LOOKUP_UNAVAILABLE'
}

function toTrimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

const ISLAND_FCODES = new Set(['ISL', 'ISLS', 'ISLET', 'ISLX', 'ISLF', 'ISLM', 'ISLT'])

function parseFeatureType(row: GeoNamesResultRow): LocationFeatureType {
  const fcl = toTrimmed(row.fcl).toUpperCase()
  const fcode = toTrimmed(row.fcode).toUpperCase()

  if (fcl === 'P') return 'locality'
  if (fcl === 'A') {
    if (fcode === 'PCLI' || fcode === 'PCL') return 'country'
    if (fcode.startsWith('ADM')) return 'region'
    return 'region'
  }
  if (fcl === 'L' && fcode === 'CONT') return 'continent'
  if (fcl === 'T' && ISLAND_FCODES.has(fcode)) return 'locality'
  return 'other'
}

function mapRow(row: GeoNamesResultRow): LocationProviderResult | null {
  const geonameId = row.geonameId
  const name = toTrimmed(row.name)
  const lat = Number(row.lat)
  const lng = Number(row.lng)

  if (typeof geonameId !== 'number' || !Number.isFinite(geonameId)) return null
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) return null

  return {
    sourceId: `geonames:${geonameId}`,
    name,
    locality: toTrimmed(row.toponymName) || undefined,
    region: toTrimmed(row.adminName1) || undefined,
    country: toTrimmed(row.countryName) || undefined,
    countryCode: toTrimmed(row.countryCode).toUpperCase() || undefined,
    featureType: parseFeatureType(row),
    lat,
    lng,
  }
}

export class GeoNamesLocationProvider implements LocationProvider {
  constructor(
    private readonly options: {
      username: string
      baseUrl: string
      timeoutMs: number
    }
  ) {}

  async search(query: string, limit: number, placeTypes?: LocationFeatureType[], countryBias?: string, countryRestrictions?: string[]): Promise<LocationProviderResult[]> {
    const username = this.options.username.trim()
    if (!username) {
      throw new LocationProviderError('LOOKUP_CONFIG_MISSING', 'GeoNames username missing')
    }

    const endpoint = new URL('/searchJSON', this.options.baseUrl)
    endpoint.searchParams.set('name_startsWith', query)
    endpoint.searchParams.set('maxRows', String(Math.min(Math.max(limit, 1), 5)))
    endpoint.searchParams.set('username', username)
    endpoint.searchParams.set('isNameRequired', 'true')
    endpoint.searchParams.set('orderby', 'relevance')
    endpoint.searchParams.set('lang', 'en')
    const featureClasses = placeTypes === undefined ? ['P', 'A', 'T'] : placeTypesToFeatureClasses(placeTypes)
    for (const cls of featureClasses) {
      endpoint.searchParams.append('featureClass', cls)
    }
    if (countryBias) {
      endpoint.searchParams.set('countryBias', countryBias)
    }
    if (countryRestrictions && countryRestrictions.length > 0) {
      for (const code of countryRestrictions) {
        endpoint.searchParams.append('country', code.toUpperCase())
      }
    }

    const abortController = new AbortController()
    const timeout = setTimeout(() => abortController.abort(), this.options.timeoutMs)

    let response: Response
    try {
      response = await fetch(endpoint.toString(), { signal: abortController.signal })
    } catch {
      throw new LocationProviderError('LOOKUP_UNAVAILABLE', 'GeoNames fetch failed')
    } finally {
      clearTimeout(timeout)
    }

    if (response.status === 429) {
      throw new LocationProviderError('LOOKUP_RATE_LIMITED', 'GeoNames rate limited')
    }

    if (!response.ok) {
      throw new LocationProviderError('LOOKUP_UNAVAILABLE', `GeoNames HTTP ${response.status}`)
    }

    let payload: GeoNamesResponse
    try {
      payload = (await response.json()) as GeoNamesResponse
    } catch {
      throw new LocationProviderError('LOOKUP_UNAVAILABLE', 'GeoNames payload parse failed')
    }

    const statusCode = payload.status?.value
    if (Number.isFinite(statusCode)) {
      const code = mapGeoNamesStatusCode(statusCode as number, toTrimmed(payload.status?.message))
      throw new LocationProviderError(code, `GeoNames status ${statusCode}`)
    }

    const rows = Array.isArray(payload.geonames) ? payload.geonames : []
    return rows.map(mapRow).filter((row): row is LocationProviderResult => row !== null)
  }
}
