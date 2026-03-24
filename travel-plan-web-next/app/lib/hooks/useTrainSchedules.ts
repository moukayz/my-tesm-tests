import { useState, useEffect } from 'react'
import { normalizeTrainId, getRailwayFromTrainId, findMatchingStation, type RouteDay } from '../itinerary'
import { formatTime } from '../trainTimetable'

export interface TrainStopsResult {
  fromStation: string
  depTime: string
  toStation: string
  arrTime: string
}

interface TimetableRow {
  station_name: string
  station_num: number
  arrival_planned_time: string | null
  departure_planned_time: string | null
  ride_date: string | null
}

export function buildScheduleKey(trainId: string, start?: string, end?: string) {
  return `${trainId}|${start ?? ''}|${end ?? ''}`
}

export function useTrainSchedules(days: RouteDay[]) {
  const [trainSchedules, setTrainSchedules] = useState<Record<string, TrainStopsResult | null>>({})
  const [schedulesLoading, setSchedulesLoading] = useState(false)

  useEffect(() => {
    const fetchSchedules = async () => {
      setSchedulesLoading(true)
      const schedules: Record<string, TrainStopsResult | null> = {}

      for (const day of days) {
        for (const trainEntry of day.train) {
          if (!('start' in trainEntry) || !trainEntry.start || !trainEntry.end) continue

          const trainId = normalizeTrainId(trainEntry.train_id)
          const key = buildScheduleKey(trainId, trainEntry.start as string, trainEntry.end as string)
          if (key in schedules) continue

          try {
            const railway = getRailwayFromTrainId(trainEntry.train_id)
            const url = `/api/timetable?train=${encodeURIComponent(trainId)}${railway ? `&railway=${railway}` : ''}`
            const res = await fetch(url)
            const rows = (await res.json()) as TimetableRow[]
            if (!rows || rows.length === 0) { schedules[key] = null; continue }

            const fromStation = findMatchingStation(
              rows as unknown as Array<{ station_name: string; [key: string]: unknown }>,
              trainEntry.start as string, 'from'
            ) as TimetableRow | null
            const toStation = findMatchingStation(
              rows as unknown as Array<{ station_name: string; [key: string]: unknown }>,
              trainEntry.end as string, 'to'
            ) as TimetableRow | null

            if (!fromStation || !toStation) { schedules[key] = null; continue }

            schedules[key] = {
              fromStation: fromStation.station_name,
              depTime: formatTime(fromStation.departure_planned_time),
              toStation: toStation.station_name,
              arrTime: formatTime(toStation.arrival_planned_time),
            }
          } catch {
            schedules[key] = null
          }
        }
      }

      setTrainSchedules(schedules)
      setSchedulesLoading(false)
    }

    fetchSchedules()
  }, [days])

  return { trainSchedules, schedulesLoading }
}
