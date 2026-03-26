export interface LocationSearchConfig {
    provider: 'geonames' | 'google'
    geonamesUsername: string
    geonamesBaseUrl: string
    googleApiKey: string
    googleBaseUrl: string
    timeoutMs: number
}

function parseTimeoutMs(raw: string | undefined): number {
    if (!raw) return 1200
    const parsed = Number(raw)
    if (!Number.isFinite(parsed) || parsed <= 0) return 1200
    return Math.floor(parsed)
}

export function getLocationSearchConfig(): LocationSearchConfig {
    const providerRaw = process.env.LOCATION_SEARCH_PROVIDER?.trim().toLowerCase() ?? 'geonames'
    const provider: 'geonames' | 'google' = providerRaw === 'google' ? 'google' : 'geonames'

    return {
        provider,
        geonamesUsername: process.env.GEONAMES_USERNAME?.trim() ?? 'moukayz',
        geonamesBaseUrl: process.env.GEONAMES_BASE_URL?.trim() || 'http://api.geonames.org',
        googleApiKey: process.env.GOOGLE_MAP_API_KEY?.trim() ?? '',
        googleBaseUrl: process.env.GOOGLE_PLACES_BASE_URL?.trim() || 'https://places.googleapis.com',
        timeoutMs: parseTimeoutMs(process.env.LOCATION_SEARCH_TIMEOUT_MS),
    }
}
