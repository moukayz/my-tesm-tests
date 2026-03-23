export interface LocationSearchConfig {
    provider: 'geonames'
    geonamesUsername: string
    geonamesBaseUrl: string
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
    const provider: 'geonames' = providerRaw === 'geonames' ? 'geonames' : 'geonames'

    return {
        provider,
        geonamesUsername: process.env.GEONAMES_USERNAME?.trim() ?? 'moukayz',
        geonamesBaseUrl: process.env.GEONAMES_BASE_URL?.trim() || 'http://api.geonames.org',
        timeoutMs: parseTimeoutMs(process.env.LOCATION_SEARCH_TIMEOUT_MS),
    }
}
