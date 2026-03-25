import type { StayLocation } from './itinerary-store/types'

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

export interface DayAttraction {
  id: string
  label: string
  coordinates?: { lat: number; lng: number }
  images?: string[]
}

export interface RouteDay {
  date: string
  weekDay: string
  dayNum: number
  overnight: string
  location?: StayLocation
  plan: PlanSections
  note?: string
  train: TrainRoute[]
  attractions?: DayAttraction[]
}

export interface ProcessedDay extends RouteDay {
  overnightRowSpan: number
}


// FNV-1a 32-bit — better bit distribution than djb2
export function hashString(s: string): number {
  let hash = 2166136261 // FNV offset basis
  for (let i = 0; i < s.length; i++) {
    hash ^= s.charCodeAt(i)
    hash = Math.imul(hash, 16777619) // FNV prime
    hash >>>= 0 // keep unsigned 32-bit
  }
  return hash
}

// Golden angle (137.508°) multiplication spreads hues maximally around the circle
function hashToHue(s: string): number {
  return Math.floor((hashString(s) * 137.508) % 360)
}

export function getOvernightColor(location: string): string {
  if (location === '—') return '#f5f5f5'
  return `hsl(${hashToHue(location)}, 70%, 95%)`
}

export function getCountryColor(country: string): string {
  if (!country || country === '—') return '#f5f5f5'
  return `hsl(${hashToHue(country)}, 70%, 95%)`
}

export function getCityColor(city: string, country: string): string {
  if (country === '—') return '#f5f5f5'
  if (!country) {
    return `hsl(${hashToHue(city)}, 70%, 95%)`
  }
  const h = hashToHue(country)
  const cityHash = hashString(city)
  const s = 25 + (cityHash % 51)           // 25–75%
  const l = 83 + ((cityHash >>> 8) % 11)   // 83–93%
  return `hsl(${h}, ${s}%, ${l}%)`
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
