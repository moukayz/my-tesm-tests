export interface TimetableRow {
  station_name: string
  station_num: number
  arrival_planned_time: string | null
  departure_planned_time: string | null
  ride_date: string | null
}

export function formatTime(ts: string | null): string {
  if (!ts) return '—'
  // ts is like "2026-02-09 07:14:00"
  const parts = ts.split(' ')
  if (parts.length < 2) return ts
  return parts[1].slice(0, 5)
}
