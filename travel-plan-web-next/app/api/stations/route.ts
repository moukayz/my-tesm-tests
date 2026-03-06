import { NextResponse } from 'next/server'
import { query, PARQUET } from '../../lib/db'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const train = searchParams.get('train')
  if (!train) return NextResponse.json({ error: 'train param required' }, { status: 400 })

  try {
    const rows = await query(`
      SELECT station_name, MIN(train_line_station_num) AS station_num
      FROM ${PARQUET}
      WHERE train_name = '${train.replace(/'/g, "''")}'
      GROUP BY station_name
      ORDER BY station_num
    `)
    return NextResponse.json(rows)
  } catch (e) {
    const err = e as Error
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
