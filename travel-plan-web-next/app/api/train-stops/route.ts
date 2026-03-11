import { NextResponse } from 'next/server'
import { pgQuery } from '../../lib/pgdb'
import { findMatchingStation } from '../../lib/itinerary'
import { formatTime } from '../../lib/trainTimetable'
import logger from '../../lib/logger'

interface TimetableRow {
  station_name: string
  station_num: number
  arrival_planned_time: string | null
  departure_planned_time: string | null
  ride_date: string | null
}

interface TrainStopsResult {
  fromStation: string
  depTime: string
  toStation: string
  arrTime: string
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const train = searchParams.get('train')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  if (!train) return NextResponse.json({ error: 'train param required' }, { status: 400 })
  if (!from) return NextResponse.json({ error: 'from param required' }, { status: 400 })
  if (!to) return NextResponse.json({ error: 'to param required' }, { status: 400 })

  const t0 = Date.now()

  try {
    const rows = await pgQuery<TimetableRow>(
      `SELECT station_name, station_num,
        arrival_planned_time::TEXT AS arrival_planned_time,
        departure_planned_time::TEXT AS departure_planned_time,
        ride_date::TEXT AS ride_date
      FROM de_db_train_latest_stops
      WHERE train_name = $1
      ORDER BY station_num`,
      [train]
    )

    if (rows.length === 0) {
      logger.info({ train, from, to, ms: Date.now() - t0 }, '/api/train-stops no rows')
      return NextResponse.json(null)
    }

    // Find matching stations for departure and arrival cities
    const fromStation = findMatchingStation(rows as unknown as Array<{ station_name: string; [key: string]: unknown }>, from, 'from') as TimetableRow | null
    const toStation = findMatchingStation(rows as unknown as Array<{ station_name: string; [key: string]: unknown }>, to, 'to') as TimetableRow | null

    if (!fromStation || !toStation) {
      logger.info({ train, from, to, ms: Date.now() - t0 }, '/api/train-stops no station match')
      return NextResponse.json(null)
    }

    // Use departure time from 'from' station and arrival time from 'to' station
    const depTime = formatTime(fromStation.departure_planned_time)
    const arrTime = formatTime(toStation.arrival_planned_time)

    const result: TrainStopsResult = {
      fromStation: fromStation.station_name,
      depTime,
      toStation: toStation.station_name,
      arrTime,
    }

    logger.info({ train, fromStation: result.fromStation, toStation: result.toStation, ms: Date.now() - t0 }, '/api/train-stops')
    return NextResponse.json(result)
  } catch (e) {
    logger.error({ err: e, train, from, to, ms: Date.now() - t0 }, '/api/train-stops error')
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
