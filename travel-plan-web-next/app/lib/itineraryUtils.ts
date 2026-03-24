import type { StayLocation } from './itinerary-store/types'

export function formatTripDate(dateStr: string): string {
  const parts = dateStr.split(/[\/\-]/).map(Number)
  if (parts.length !== 3 || parts.some(isNaN)) return dateStr
  const [year, month, day] = parts
  const d = new Date(year, month - 1, day)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function getCountryFromLocation(location?: StayLocation): string | undefined {
  if (!location) return undefined
  if (location.kind === 'resolved') return location.place.country ?? location.place.countryCode
  if (location.kind === 'mapbox') return location.place.country ?? location.place.countryCode
  if (location.kind === 'geonames') return location.place.countryName ?? location.place.countryCode
  return undefined
}
