import { NextResponse } from 'next/server'
import { pgQuery } from '../../lib/pgdb'
import logger from '../../lib/logger'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const train = searchParams.get('train')
  const station = searchParams.get('station')
  if (!train || !station)
    return NextResponse.json({ error: 'train and station params required' }, { status: 400 })

  const t0 = Date.now()

  try {
    const [stats, trends] = await Promise.all([
      pgQuery(
        `SELECT
          COUNT(*)::INTEGER AS total_stops,
          ROUND(AVG(delay_in_min)::numeric, 2)::FLOAT8 AS avg_delay,
          ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY delay_in_min)::numeric, 1)::FLOAT8 AS p50,
          ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY delay_in_min)::numeric, 1)::FLOAT8 AS p75,
          ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY delay_in_min)::numeric, 1)::FLOAT8 AS p90,
          ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY delay_in_min)::numeric, 1)::FLOAT8 AS p95,
          MAX(delay_in_min) AS max_delay
        FROM de_db_delay_events
        WHERE is_canceled = false
          AND train_name = $1
          AND station_name = $2
          AND event_time >= (SELECT MAX(event_time) - INTERVAL '3 months' FROM de_db_delay_events)`,
        [train, station]
      ),
      pgQuery(
        `SELECT
          CAST(DATE_TRUNC('day', event_time) AS VARCHAR) AS day,
          ROUND(AVG(delay_in_min)::numeric, 2)::FLOAT8 AS avg_delay,
          COUNT(*)::INTEGER AS stops
        FROM de_db_delay_events
        WHERE is_canceled = false
          AND train_name = $1
          AND station_name = $2
          AND event_time >= (SELECT MAX(event_time) - INTERVAL '3 months' FROM de_db_delay_events)
        GROUP BY DATE_TRUNC('day', event_time)
        ORDER BY day`,
        [train, station]
      ),
    ])

    logger.info({ train, station, trend_days: trends.length, ms: Date.now() - t0 }, '/api/delay-stats')
    return NextResponse.json({ stats: stats[0] ?? null, trends })
  } catch (e) {
    logger.error({ err: e, train, station, ms: Date.now() - t0 }, '/api/delay-stats error')
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
