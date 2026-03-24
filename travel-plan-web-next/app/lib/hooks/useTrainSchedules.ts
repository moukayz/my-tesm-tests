import { useState, useEffect } from 'react'
import { normalizeTrainId, getRailwayFromTrainId, findMatchingStation, type RouteDay } from '../itinerary'
import { formatTime, type TimetableRow } from '../trainTimetable'

export interface TrainStopsResult {
  fromStation: string
  depTime: string
  toStation: string
  arrTime: string
}

export function buildScheduleKey(trainId: string, start?: string, end?: string) {
  return `${trainId}|${start ?? ''}|${end ?? ''}`
}

export function useTrainSchedules(days: RouteDay[]) {
  const [trainSchedules, setTrainSchedules] = useState<Record<string, TrainStopsResult | null>>({})
  const [schedulesLoading, setSchedulesLoading] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller

    const fetchSchedules = async () => {
      setSchedulesLoading(true)
      const schedules: Record<string, TrainStopsResult | null> = {}

      for (const day of days) {
        for (const trainEntry of day.train) {
          if (signal.aborted) break
          if (!('start' in trainEntry) || !trainEntry.start || !trainEntry.end) continue

          const trainId = normalizeTrainId(trainEntry.train_id)
          const key = buildScheduleKey(trainId, trainEntry.start as string, trainEntry.end as string)
          if (key in schedules) continue

          try {
            const railway = getRailwayFromTrainId(trainEntry.train_id)
            const url = `/api/timetable?train=${encodeURIComponent(trainId)}${railway ? `&railway=${railway}` : ''}`
            const res = await fetch(url, { signal })
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
          } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') return
            schedules[key] = null
          }
        }
      }

      if (!signal.aborted) {
        setTrainSchedules(schedules)
        setSchedulesLoading(false)
      }
    }

    fetchSchedules()

    return () => {
      controller.abort()
    }
  }, [days])

  return { trainSchedules, schedulesLoading }
}
