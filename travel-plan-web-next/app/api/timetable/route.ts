import { NextResponse } from 'next/server'
import { query, PARQUET } from '../../lib/db'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const train = searchParams.get('train')
  if (!train)
    return NextResponse.json({ error: 'train param required' }, { status: 400 })

  const trainEsc = train.replace(/'/g, "''")

  try {
    const rows = await query<{
      station_name: string
      station_num: number
      arrival_planned_time: string | null
      departure_planned_time: string | null
      ride_date: string | null
    }>(`
      WITH latest_ride AS (
        SELECT train_line_ride_id, MAX(time) AS latest_time
        FROM ${PARQUET}
        WHERE train_name = '${trainEsc}' AND train_line_ride_id != ''
        GROUP BY train_line_ride_id
        ORDER BY MAX(time) DESC
        LIMIT 1
      ),
      latest_occurrence AS (
        SELECT
          p.station_name,
          p.train_line_station_num AS station_num,
          CAST(p.arrival_planned_time AS VARCHAR) AS arrival_planned_time,
          CAST(p.departure_planned_time AS VARCHAR) AS departure_planned_time,
          CAST(DATE_TRUNC('day', lr.latest_time) AS VARCHAR) AS ride_date,
          ROW_NUMBER() OVER (PARTITION BY p.train_line_station_num ORDER BY p.time DESC) AS rn
        FROM ${PARQUET} p
        JOIN latest_ride lr ON p.train_line_ride_id = lr.train_line_ride_id
        WHERE p.train_name = '${trainEsc}'
      )
      SELECT station_name, station_num, arrival_planned_time, departure_planned_time, ride_date
      FROM latest_occurrence
      WHERE rn = 1
      ORDER BY station_num
    `)
    return NextResponse.json(rows)
  } catch (e) {
    const err = e as Error
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
