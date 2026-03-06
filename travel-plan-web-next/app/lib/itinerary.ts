export interface RouteDay {
  date: string
  weekDay: string
  dayNum: number
  overnight: string
  plan: string
  train: string[]
}

export interface ProcessedDay extends RouteDay {
  overnightRowSpan: number
}

export function getOvernightColor(location: string): string {
  if (location === '—') return '#f5f5f5'
  let hash = 0
  for (let i = 0; i < location.length; i++) {
    hash = location.charCodeAt(i) + ((hash << 5) - hash)
  }
  const h = Math.abs(hash) % 360
  return `hsl(${h}, 70%, 95%)`
}

export function processItinerary(data: RouteDay[]): ProcessedDay[] {
  const result: ProcessedDay[] = []
  let currentOvernight: string | null = null
  let overnightSpan = 0
  let overnightStartIndex = -1

  for (let i = 0; i < data.length; i++) {
    const item: ProcessedDay = { ...data[i], overnightRowSpan: 0 }
    if (item.overnight !== currentOvernight) {
      if (overnightStartIndex !== -1) {
        result[overnightStartIndex].overnightRowSpan = overnightSpan
      }
      currentOvernight = item.overnight
      overnightSpan = 1
      overnightStartIndex = i
      item.overnightRowSpan = 1
    } else {
      overnightSpan++
    }
    result.push(item)
  }
  if (overnightStartIndex !== -1) {
    result[overnightStartIndex].overnightRowSpan = overnightSpan
  }
  return result
}
