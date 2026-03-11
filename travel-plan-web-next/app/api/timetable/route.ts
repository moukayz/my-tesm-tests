import { NextResponse } from 'next/server'
import { pgQuery } from '../../lib/pgdb'
import logger from '../../lib/logger'

type TimetableRow = {
  station_name: string
  station_num: number
  arrival_planned_time: string | null
  departure_planned_time: string | null
  ride_date: string | null
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const train = searchParams.get('train')
  if (!train)
    return NextResponse.json({ error: 'train param required' }, { status: 400 })

  const railway = searchParams.get('railway') ?? ''
  if (railway && !['german', 'french', 'eurostar'].includes(railway))
    return NextResponse.json({ error: `Unknown railway: ${railway}` }, { status: 400 })

  const t0 = Date.now()

  try {
    let rows: TimetableRow[]

    if (railway === 'french') {
      rows = await pgQuery<TimetableRow>(
        `WITH canonical_trip AS (
          SELECT t.trip_id
          FROM gtfs_trips t
          JOIN gtfs_stop_times st ON st.trip_id = t.trip_id
          WHERE split_part(t.trip_id, ':', 1) = 'fr'
            AND t.trip_headsign = $1
          GROUP BY t.trip_id
          ORDER BY COUNT(*) DESC
          LIMIT 1
        )
        SELECT DISTINCT ON (CAST(st.stop_sequence AS INTEGER))
               CAST(st.stop_sequence AS INTEGER) AS station_num,
               s.stop_name AS station_name,
               st.arrival_time AS arrival_planned_time,
               st.departure_time AS departure_planned_time,
               NULL AS ride_date
        FROM gtfs_stop_times st
        JOIN canonical_trip ct ON st.trip_id = ct.trip_id
        JOIN gtfs_stops s ON st.stop_id = s.stop_id
        ORDER BY CAST(st.stop_sequence AS INTEGER)`,
        [train]
      )
    } else if (railway === 'eurostar') {
      rows = await pgQuery<TimetableRow>(
        `WITH latest_trip AS (
          SELECT t.trip_id, cd.date AS ride_date
          FROM gtfs_trips t
          JOIN gtfs_calendar_dates cd ON t.service_id = cd.service_id
          WHERE split_part(t.trip_id, ':', 1) = 'eu'
            AND t.trip_headsign = $1
            AND cd.exception_type = '1'
          ORDER BY cd.date DESC
          LIMIT 1
        )
        SELECT DISTINCT ON (CAST(st.stop_sequence AS INTEGER))
               CAST(st.stop_sequence AS INTEGER) AS station_num,
               s.stop_name AS station_name,
               st.arrival_time AS arrival_planned_time,
               st.departure_time AS departure_planned_time,
               lt.ride_date::TEXT AS ride_date
        FROM gtfs_stop_times st
        JOIN latest_trip lt ON st.trip_id = lt.trip_id
        JOIN gtfs_stops s ON st.stop_id = s.stop_id
        ORDER BY CAST(st.stop_sequence AS INTEGER)`,
        [train]
      )
    } else {
      rows = await pgQuery<TimetableRow>(
        `SELECT station_name, station_num,
          arrival_planned_time::TEXT AS arrival_planned_time,
          departure_planned_time::TEXT AS departure_planned_time,
          ride_date::TEXT AS ride_date
        FROM de_db_train_latest_stops
        WHERE train_name = $1
        ORDER BY station_num`,
        [train]
      )
    }

    logger.info({ train, railway: railway || 'german', rows: rows.length, ms: Date.now() - t0 }, '/api/timetable')
    return NextResponse.json(rows)
  } catch (e) {
    logger.error({ err: e, train, railway: railway || 'german', ms: Date.now() - t0 }, '/api/timetable error')
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
