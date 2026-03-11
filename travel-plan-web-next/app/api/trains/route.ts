import { NextRequest, NextResponse } from 'next/server'
import { query, STOPS_PARQUET } from '../../lib/db'
import { pgQuery } from '../../lib/pgdb'
import logger from '../../lib/logger'

export async function GET(request: NextRequest) {
  const railway = request.nextUrl.searchParams.get('railway')
  const t0 = Date.now()

  try {
    if (railway === 'german') {
      const result = await query<{ train_name: string; train_type: string }>(`
        SELECT DISTINCT train_name, split_part(train_name, ' ', 1) AS train_type
        FROM ${STOPS_PARQUET}
        ORDER BY train_name
      `)
      logger.info({ railway: 'german', rows: result.length, ms: Date.now() - t0 }, '/api/trains')
      return NextResponse.json(result.map((r) => ({ ...r, railway: 'german' as const })))
    }

    const [germanResult, frenchResult, eurostarResult] = await Promise.allSettled([
      query<{ train_name: string; train_type: string }>(`
        SELECT DISTINCT train_name, split_part(train_name, ' ', 1) AS train_type
        FROM ${STOPS_PARQUET}
        ORDER BY train_name
      `),
      pgQuery<{ train_name: string; train_type: string }>(`
        SELECT DISTINCT trip_headsign AS train_name, 'SNCF' AS train_type
        FROM gtfs_trips
        WHERE split_part(trip_id, ':', 1) = 'fr'
          AND trip_headsign IS NOT NULL AND trip_headsign != ''
        ORDER BY train_name
      `),
      pgQuery<{ train_name: string; train_type: string }>(`
        SELECT DISTINCT trip_headsign AS train_name, 'Eurostar' AS train_type
        FROM gtfs_trips
        WHERE split_part(trip_id, ':', 1) = 'eu'
          AND trip_headsign IS NOT NULL AND trip_headsign != ''
        ORDER BY train_name
      `),
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

    logger.info({ rows: combined.length, ms: Date.now() - t0 }, '/api/trains')
    return NextResponse.json(combined)
  } catch (e) {
    logger.error({ err: e, railway, ms: Date.now() - t0 }, '/api/trains error')
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
