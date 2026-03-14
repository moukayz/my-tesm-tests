export interface TrainRoute {
  train_id: string
  start?: string
  end?: string
}

export interface PlanSections {
  morning: string
  afternoon: string
  evening: string
}

export interface RouteDay {
  date: string
  weekDay: string
  dayNum: number
  overnight: string
  plan: PlanSections
  train: TrainRoute[]
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

export function normalizeTrainId(trainId: string): string {
  const trimmed = trainId.trim()
  const match = trimmed.match(/^([A-Za-z]{2,4})(\d+)$/)
  if (!match) return trimmed
  return `${match[1].toUpperCase()} ${match[2]}`
}

export function getRailwayFromTrainId(trainId: string): string {
  const normalised = normalizeTrainId(trainId)
  if (normalised.startsWith('TGV')) return 'french'
  if (normalised.startsWith('EST')) return 'eurostar'
  return ''
}

// Map city names to their possible station name variations
const CITY_ALIASES: Record<string, string[]> = {
  cologne: ['köln', 'koeln', 'cologne'],
  munich: ['münchen', 'munich'],
  augsburg: ['augsburg'],
  bolzano: ['bozen', 'bolzano'],
  lyon: ['lyon'],
  paris: ['paris'],
  rome: ['rome', 'roma'],
  florence: ['florence', 'firenze'],
  pisa: ['pisa'],
}

export function findMatchingStation(
  stations: Array<{ station_name: string; [key: string]: unknown }>,
  cityName: string,
  side: 'from' | 'to'
): (typeof stations)[number] | null {
  const normalizedCity = cityName.toLowerCase().trim()
  const aliases = CITY_ALIASES[normalizedCity] || [normalizedCity]

  // Find all stations that match any of the city aliases
  const matches = stations.filter((station) => {
    const stationName = station.station_name.toLowerCase()
    return aliases.some((alias) => stationName.includes(alias))
  })

  if (matches.length === 0) return null

  // For 'from', prefer the first match; for 'to', prefer the last match
  return side === 'from' ? matches[0] : matches[matches.length - 1]
}
