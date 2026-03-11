import { NextResponse } from 'next/server'
import { query, DELAY_PARQUET } from '../../lib/db'
import logger from '../../lib/logger'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const train = searchParams.get('train')
  if (!train) return NextResponse.json({ error: 'train param required' }, { status: 400 })

  const t0 = Date.now()

  try {
    const rows = await query(`
      SELECT station_name, MIN(train_line_station_num) AS station_num
      FROM ${DELAY_PARQUET}
      WHERE train_name = '${train.replace(/'/g, "''")}'
      GROUP BY station_name
      ORDER BY station_num
    `)
    logger.info({ train, rows: rows.length, ms: Date.now() - t0 }, '/api/stations')
    return NextResponse.json(rows)
  } catch (e) {
    logger.error({ err: e, train, ms: Date.now() - t0 }, '/api/stations error')
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
