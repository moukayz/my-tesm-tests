import { NextRequest, NextResponse } from 'next/server'
import { pgQuery } from '../../lib/pgdb'
import logger from '../../lib/logger'

const TRAIN_QUERY_MAX_ATTEMPTS = 3
const TRAIN_QUERY_RETRY_BASE_DELAY_MS = 300
const TRAINS_CACHE_TTL_MS = 60_000

type TrainRow = {
  train_name: string
  train_type: string
  railway: 'german' | 'french' | 'eurostar'
}

type TrainsCacheEntry = {
  expiresAt: number
  rows: TrainRow[]
}

let combinedTrainsCache: TrainsCacheEntry | null = null
let germanTrainsCache: TrainsCacheEntry | null = null

function isCacheFresh(entry: TrainsCacheEntry | null): entry is TrainsCacheEntry {
  return Boolean(entry && entry.expiresAt > Date.now())
}

function cloneRows(rows: TrainRow[]): TrainRow[] {
  return rows.map((row) => ({ ...row }))
}

function writeCache(cacheType: 'combined' | 'german', rows: TrainRow[]): void {
  const entry: TrainsCacheEntry = {
    expiresAt: Date.now() + TRAINS_CACHE_TTL_MS,
    rows: cloneRows(rows),
  }

  if (cacheType === 'combined') {
    combinedTrainsCache = entry
  } else {
    germanTrainsCache = entry
  }
}

export function __resetTrainsCacheForTests(): void {
  combinedTrainsCache = null
  germanTrainsCache = null
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function queryWithRetry<T>(source: string, sql: string): Promise<T[]> {
  let lastError: unknown

  for (let attempt = 1; attempt <= TRAIN_QUERY_MAX_ATTEMPTS; attempt++) {
    try {
      return await pgQuery<T>(sql)
    } catch (error) {
      lastError = error

      if (attempt < TRAIN_QUERY_MAX_ATTEMPTS) {
        const retryDelayMs = TRAIN_QUERY_RETRY_BASE_DELAY_MS * attempt
        logger.warn(
          { source, attempt, retryDelayMs, err: error },
          '/api/trains query failed; retrying'
        )
        await sleep(retryDelayMs)
        continue
      }
    }
  }

  throw lastError
}

const GERMAN_TRAINS_SQL = `
  SELECT DISTINCT train_name, split_part(train_name, ' ', 1) AS train_type
  FROM de_db_train_latest_stops
  ORDER BY train_name
`

const FRENCH_TRAINS_SQL = `
  SELECT DISTINCT trip_headsign AS train_name, 'SNCF' AS train_type
  FROM gtfs_trips
  WHERE split_part(trip_id, ':', 1) = 'fr'
    AND trip_headsign IS NOT NULL AND trip_headsign != ''
  ORDER BY train_name
`

const EUROSTAR_TRAINS_SQL = `
  SELECT DISTINCT trip_headsign AS train_name, 'Eurostar' AS train_type
  FROM gtfs_trips
  WHERE split_part(trip_id, ':', 1) = 'eu'
    AND trip_headsign IS NOT NULL AND trip_headsign != ''
  ORDER BY train_name
`

export async function GET(request: NextRequest) {
  const railway = request.nextUrl.searchParams.get('railway')
  const t0 = Date.now()

  try {
    if (railway === 'german') {
      if (isCacheFresh(germanTrainsCache)) {
        logger.info({ railway: 'german', rows: germanTrainsCache.rows.length, ms: Date.now() - t0, cacheHit: true }, '/api/trains')
        return NextResponse.json(cloneRows(germanTrainsCache.rows))
      }

      const result = await queryWithRetry<{ train_name: string; train_type: string }>(
        'german',
        GERMAN_TRAINS_SQL
      )
      const rows = result.map((r) => ({ ...r, railway: 'german' as const }))
      writeCache('german', rows)
      logger.info({ railway: 'german', rows: rows.length, ms: Date.now() - t0, cacheHit: false }, '/api/trains')
      return NextResponse.json(rows)
    }

    if (isCacheFresh(combinedTrainsCache)) {
      logger.info({ rows: combinedTrainsCache.rows.length, ms: Date.now() - t0, cacheHit: true }, '/api/trains')
      return NextResponse.json(cloneRows(combinedTrainsCache.rows))
    }

    const [germanResult, frenchResult, eurostarResult] = await Promise.allSettled([
      queryWithRetry<{ train_name: string; train_type: string }>('german', GERMAN_TRAINS_SQL),
      queryWithRetry<{ train_name: string; train_type: string }>('french', FRENCH_TRAINS_SQL),
      queryWithRetry<{ train_name: string; train_type: string }>('eurostar', EUROSTAR_TRAINS_SQL),
    ])

    if (germanResult.status === 'rejected')
      logger.error({ err: germanResult.reason }, '/api/trains german query failed')
    if (frenchResult.status === 'rejected')
      logger.error({ err: frenchResult.reason }, '/api/trains french query failed')
    if (eurostarResult.status === 'rejected')
      logger.error({ err: eurostarResult.reason }, '/api/trains eurostar query failed')

    const germanRows = germanResult.status === 'fulfilled' ? germanResult.value : []
    const frenchRows = frenchResult.status === 'fulfilled' ? frenchResult.value : []
    const eurostarRows = eurostarResult.status === 'fulfilled' ? eurostarResult.value : []

    const seen = new Set<string>()
    const combined = [
      ...frenchRows.map((r) => ({ ...r, railway: 'french' as const })),
      ...eurostarRows.map((r) => ({ ...r, railway: 'eurostar' as const })),
      ...germanRows.map((r) => ({ ...r, railway: 'german' as const })),
    ]
      .sort((a, b) => a.train_name.localeCompare(b.train_name))
      .filter((r) => {
        if (seen.has(r.train_name)) return false
        seen.add(r.train_name)
        return true
      })

    if (
      germanResult.status === 'fulfilled' &&
      frenchResult.status === 'fulfilled' &&
      eurostarResult.status === 'fulfilled' &&
      combined.length > 0
    ) {
      writeCache('combined', combined)
    }

    logger.info({ rows: combined.length, ms: Date.now() - t0, cacheHit: false }, '/api/trains')
    return NextResponse.json(combined)
  } catch (e) {
    logger.error({ err: e, railway, ms: Date.now() - t0 }, '/api/trains error')
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
