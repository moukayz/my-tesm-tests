export interface TimetableRow {
  station_name: string
  station_num: number
  arrival_planned_time: string | null
  departure_planned_time: string | null
  ride_date: string | null
}

export function formatTime(ts: string | null): string {
  if (!ts) return '—'
  const timeStr = ts.includes(' ') ? ts.split(' ')[1] : ts
  return timeStr.slice(0, 5)
}
