import { NextResponse } from 'next/server'
import { query, PARQUET } from '../../lib/db.js'

const CUTOFF = `(SELECT MAX(time) - INTERVAL 3 MONTHS FROM ${PARQUET})`

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const train = searchParams.get('train')
  const station = searchParams.get('station')
  if (!train || !station) return NextResponse.json({ error: 'train and station params required' }, { status: 400 })

  const trainEsc = train.replace(/'/g, "''")
  const stationEsc = station.replace(/'/g, "''")
  const where = `
    WHERE is_canceled = false
      AND train_name = '${trainEsc}'
      AND station_name = '${stationEsc}'
      AND time >= ${CUTOFF}
  `

  try {
    const [stats, trends] = await Promise.all([
      query(`
        SELECT
          COUNT(*) AS total_stops,
          ROUND(AVG(delay_in_min), 2) AS avg_delay,
          ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY delay_in_min), 1) AS p50,
          ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY delay_in_min), 1) AS p75,
          ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY delay_in_min), 1) AS p90,
          ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY delay_in_min), 1) AS p95,
          MAX(delay_in_min) AS max_delay
        FROM ${PARQUET}
        ${where}
      `),
      query(`
        SELECT
          CAST(DATE_TRUNC('day', time) AS VARCHAR) AS day,
          ROUND(AVG(delay_in_min), 2) AS avg_delay,
          COUNT(*) AS stops
        FROM ${PARQUET}
        ${where}
        GROUP BY DATE_TRUNC('day', time)
        ORDER BY day
      `),
    ])

    return NextResponse.json({ stats: stats[0] ?? null, trends })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
