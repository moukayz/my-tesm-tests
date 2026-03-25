import type { DayAttraction } from './itinerary'

export function parseAttractions(raw: unknown): DayAttraction[] | null {
  if (!Array.isArray(raw)) return null
  const result: DayAttraction[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null
    const { id, label, coordinates } = item as Record<string, unknown>
    if (typeof id !== 'string' || id.trim().length === 0 || id.trim().length > 80) return null
    if (typeof label !== 'string' || label.trim().length === 0 || label.trim().length > 120) return null
    const attraction: DayAttraction = { id: id.trim(), label: label.trim() }
    if (coordinates !== undefined) {
      if (!coordinates || typeof coordinates !== 'object' || Array.isArray(coordinates)) return null
      const { lat, lng } = coordinates as Record<string, unknown>
      const latNum = Number(lat)
      const lngNum = Number(lng)
      if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) return null
      attraction.coordinates = { lat: latNum, lng: lngNum }
    }
    const { images } = item as Record<string, unknown>
    if (images !== undefined) {
      if (!Array.isArray(images) || images.some((u) => typeof u !== 'string')) return null
      attraction.images = images as string[]
    }
    result.push(attraction)
  }
  return result
}
