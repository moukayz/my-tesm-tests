import { NextResponse } from 'next/server'
import { query, PARQUET, EURO_GTFS } from '../../lib/db'

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

  const trainEsc = train.replace(/'/g, "''")

  try {
    let rows: TimetableRow[]

    if (railway === 'french') {
      rows = await query<TimetableRow>(`
        WITH canonical_trip AS (
          SELECT t.trip_id
          FROM read_csv('${EURO_GTFS}/trips.txt', header=true, auto_detect=true) t
          JOIN read_csv('${EURO_GTFS}/stop_times.txt', header=true, auto_detect=true) st2 ON st2.trip_id = t.trip_id
          WHERE split_part(t.trip_id, ':', 1) = 'fr'
            AND t.trip_headsign::VARCHAR = '${trainEsc}'
          GROUP BY t.trip_id
          ORDER BY COUNT(*) DESC
          LIMIT 1
        )
        SELECT st.stop_sequence AS station_num, s.stop_name AS station_name,
               CAST(st.arrival_time AS VARCHAR) AS arrival_planned_time,
               CAST(st.departure_time AS VARCHAR) AS departure_planned_time,
               NULL AS ride_date
        FROM read_csv('${EURO_GTFS}/stop_times.txt', header=true, auto_detect=true, types={'arrival_time': 'VARCHAR', 'departure_time': 'VARCHAR'}) st
        JOIN canonical_trip ct ON st.trip_id = ct.trip_id
        JOIN read_csv('${EURO_GTFS}/stops.txt', header=true, auto_detect=true) s ON st.stop_id = s.stop_id
        ORDER BY st.stop_sequence
      `)
    } else if (railway === 'eurostar') {
      rows = await query<TimetableRow>(`
        WITH latest_trip AS (
          SELECT t.trip_id, cd.date AS ride_date
          FROM read_csv('${EURO_GTFS}/trips.txt', header=true, auto_detect=true) t
          JOIN read_csv('${EURO_GTFS}/calendar_dates.txt', header=true, auto_detect=true) cd ON t.service_id = cd.service_id
          WHERE split_part(t.trip_id, ':', 1) = 'eu'
            AND t.trip_headsign::VARCHAR = '${trainEsc}' AND cd.exception_type = 1
          ORDER BY cd.date DESC LIMIT 1
        )
        SELECT st.stop_sequence AS station_num, s.stop_name AS station_name,
               CAST(st.arrival_time AS VARCHAR) AS arrival_planned_time,
               CAST(st.departure_time AS VARCHAR) AS departure_planned_time,
               CAST(lt.ride_date AS VARCHAR) AS ride_date
        FROM read_csv('${EURO_GTFS}/stop_times.txt', header=true, auto_detect=true, types={'arrival_time': 'VARCHAR', 'departure_time': 'VARCHAR'}) st
        JOIN latest_trip lt ON st.trip_id = lt.trip_id
        JOIN read_csv('${EURO_GTFS}/stops.txt', header=true, auto_detect=true) s ON st.stop_id = s.stop_id
        ORDER BY st.stop_sequence
      `)
    } else {
      rows = await query<TimetableRow>(`
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
    }

    return NextResponse.json(rows)
  } catch (e) {
    const err = e as Error
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
