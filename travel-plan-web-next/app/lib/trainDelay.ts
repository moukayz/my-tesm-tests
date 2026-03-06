export interface DelayStats {
  total_stops: number
  avg_delay: number
  p50: number
  p75: number
  p90: number
  p95: number
  max_delay: number
}

export interface TrendPoint {
  day: string
  avg_delay: number
  stops: number
}

export interface TrainRow {
  train_name: string
  train_type: string
}

export interface StationRow {
  station_name: string
  station_num: number
}

export interface StatItem {
  label: string
  value: number | string
  unit: string
}

export function formatDay(day: string): string {
  if (!day) return ''
  const d = new Date(day)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export function buildStatItems(stats: DelayStats): StatItem[] {
  return [
    { label: 'Total Stops', value: stats.total_stops, unit: '' },
    { label: 'Avg Delay', value: stats.avg_delay, unit: ' min' },
    { label: 'Median (p50)', value: stats.p50, unit: ' min' },
    { label: 'p75', value: stats.p75, unit: ' min' },
    { label: 'p90', value: stats.p90, unit: ' min' },
    { label: 'p95', value: stats.p95, unit: ' min' },
    { label: 'Max Delay', value: stats.max_delay, unit: ' min' },
  ]
}
