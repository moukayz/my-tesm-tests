import type { PlanSections, RouteDay } from '../itinerary'
import { applyAppendStay, applyMoveStay, applyPatchStay, deriveStays, regenerateDerivedDates } from './domain'
import { getItineraryStore } from './store'
import type { ItineraryRecord, ItinerarySummary, ItineraryWorkspace, ListItinerariesResponse, StayLocation } from './types'
import { normalizeStayLocation } from '../stayLocation'

export class ItineraryApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string
  ) {
    super(code)
    this.name = 'ItineraryApiError'
  }
}

function parseDateOrThrow(startDate: unknown): string {
  if (typeof startDate !== 'string') throw new ItineraryApiError(400, 'INVALID_START_DATE')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) throw new ItineraryApiError(400, 'INVALID_START_DATE')
  const dt = new Date(`${startDate}T00:00:00.000Z`)
  if (Number.isNaN(dt.getTime())) throw new ItineraryApiError(400, 'INVALID_START_DATE')
  const [y, m, d] = startDate.split('-').map(Number)
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() + 1 !== m || dt.getUTCDate() !== d) {
    throw new ItineraryApiError(400, 'INVALID_START_DATE')
  }
  return startDate
}

function parseNameOrThrow(name: unknown, fallbackStartDate: string): string {
  if (name === undefined || name === null) return `Itinerary ${fallbackStartDate}`
  if (typeof name !== 'string') throw new ItineraryApiError(400, 'INVALID_ITINERARY_NAME')
  const trimmed = name.trim()
  if (trimmed.length > 120) throw new ItineraryApiError(400, 'INVALID_ITINERARY_NAME')
  if (trimmed.length === 0) return `Itinerary ${fallbackStartDate}`
  return trimmed
}

function parseCityOrThrow(city: unknown): string {
  if (typeof city !== 'string') throw new ItineraryApiError(400, 'STAY_CITY_REQUIRED')
  const trimmed = city.trim()
  if (trimmed.length === 0 || trimmed.length > 80) throw new ItineraryApiError(400, 'STAY_CITY_REQUIRED')
  return trimmed
}

function parseOptionalCity(city: unknown): string | undefined {
  if (city === undefined) return undefined
  return parseCityOrThrow(city)
}

function parseNightsOrThrow(nights: unknown): number {
  if (typeof nights !== 'number' || !Number.isInteger(nights) || nights < 1) {
    throw new ItineraryApiError(400, 'STAY_NIGHTS_MIN')
  }
  return nights
}

function trimOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function parseLocationOrThrow(location: unknown): StayLocation | undefined {
  if (location === undefined) return undefined
  if (!location || typeof location !== 'object' || Array.isArray(location)) {
    throw new ItineraryApiError(400, 'STAY_LOCATION_INVALID')
  }

  const record = location as {
    kind?: unknown
    label?: unknown
    queryText?: unknown
    coordinates?: { lng?: unknown; lat?: unknown }
    place?: {
      placeId?: unknown
      name?: unknown
      locality?: unknown
      region?: unknown
      country?: unknown
      countryCode?: unknown
      featureType?: unknown
    }
  }

  const locationKind = record.kind
  if (locationKind !== 'custom' && locationKind !== 'resolved') {
    throw new ItineraryApiError(400, 'STAY_LOCATION_INVALID')
  }

  const label = trimOptionalString(record.label)
  const queryText = trimOptionalString(record.queryText)
  if (!label || !queryText || label.length > 80 || queryText.length > 80) {
    throw new ItineraryApiError(400, 'STAY_LOCATION_INVALID')
  }

  if (locationKind === 'custom') {
    return {
      kind: 'custom',
      label,
      queryText,
    }
  }

  const lng = Number(record.coordinates?.lng)
  const lat = Number(record.coordinates?.lat)
  const placeId = trimOptionalString(record.place?.placeId)
  const name = trimOptionalString(record.place?.name)
  if (!Number.isFinite(lng) || !Number.isFinite(lat) || !placeId || !name) {
    throw new ItineraryApiError(400, 'STAY_LOCATION_INVALID')
  }

  const countryCode = trimOptionalString(record.place?.countryCode)
  if (countryCode && !/^[A-Z]{2}$/i.test(countryCode)) {
    throw new ItineraryApiError(400, 'STAY_LOCATION_INVALID')
  }

  return {
    kind: 'resolved',
    label,
    queryText,
    coordinates: {
      lng,
      lat,
    },
    place: {
      placeId,
      name,
      locality: trimOptionalString(record.place?.locality),
      region: trimOptionalString(record.place?.region),
      country: trimOptionalString(record.place?.country),
      countryCode: countryCode?.toUpperCase(),
      featureType:
        record.place?.featureType === 'locality' ||
        record.place?.featureType === 'region' ||
        record.place?.featureType === 'country' ||
        record.place?.featureType === 'other'
          ? record.place.featureType
          : undefined,
    },
  }
}

function parseLocationLabel(location: unknown): string | undefined {
  if (!location || typeof location !== 'object' || Array.isArray(location)) return undefined
  const rawLabel = (location as { label?: unknown }).label
  if (typeof rawLabel !== 'string') return undefined
  const trimmed = rawLabel.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function parseStayMutationInputOrThrow(payload: {
  city?: unknown
  nights?: unknown
  location?: unknown
}): { city: string; nights: number; location: StayLocation } {
  const parsedCity = parseOptionalCity(payload.city)
  const fallbackCityFromLocation = parseLocationLabel(payload.location)
  if (parsedCity && fallbackCityFromLocation && parsedCity !== fallbackCityFromLocation) {
    throw new ItineraryApiError(400, 'STAY_LOCATION_LABEL_MISMATCH')
  }
  const parsedLocation = parseLocationOrThrow(payload.location)
  const nights = parseNightsOrThrow(payload.nights)

  if (!parsedCity && !parsedLocation) {
    throw new ItineraryApiError(400, 'STAY_CITY_REQUIRED')
  }

  if (parsedCity && parsedLocation && parsedCity !== parsedLocation.label.trim()) {
    throw new ItineraryApiError(400, 'STAY_LOCATION_LABEL_MISMATCH')
  }

  const city = parsedCity ?? parsedLocation!.label.trim()
  const location = parsedLocation ?? normalizeStayLocation(city)
  return { city, nights, location }
}

function toSummary(record: ItineraryRecord): ItinerarySummary {
  return {
    id: record.id,
    name: record.name,
    startDate: record.startDate,
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}

function toWorkspace(record: ItineraryRecord): ItineraryWorkspace {
  const normalizedDays = record.days.map((day) => ({
    ...day,
    location: normalizeStayLocation(day.overnight, day.location),
  }))
  return {
    itinerary: toSummary(record),
    stays: deriveStays(normalizedDays),
    days: normalizedDays,
  }
}

async function requireOwnedItinerary(itineraryId: string, ownerEmail: string): Promise<ItineraryRecord> {
  const store = getItineraryStore()
  const record = await store.getById(itineraryId)
  if (!record) throw new ItineraryApiError(404, 'ITINERARY_NOT_FOUND')
  if (record.ownerEmail !== ownerEmail) throw new ItineraryApiError(403, 'ITINERARY_FORBIDDEN')
  return record
}

export async function seedItinerary(
  ownerEmail: string,
  days: RouteDay[],
  name: string,
  startDate: string
): Promise<{ itinerary: ItinerarySummary; workspaceUrl: string }> {
  const store = getItineraryStore()
  const created = await store.createShell({ ownerEmail, name, startDate })
  const saved = await store.replaceDays(created.id, created.updatedAt, days)
  if (!saved) throw new ItineraryApiError(500, 'INTERNAL_ERROR')
  return {
    itinerary: toSummary(saved),
    workspaceUrl: `/?tab=itinerary&itineraryId=${saved.id}`,
  }
}

export async function createItineraryShell(ownerEmail: string, payload: { name?: unknown; startDate?: unknown }) {
  const startDate = parseDateOrThrow(payload.startDate)
  const name = parseNameOrThrow(payload.name, startDate)

  const store = getItineraryStore()
  const created = await store.createShell({
    ownerEmail,
    name,
    startDate,
  })

  return {
    itinerary: toSummary(created),
    workspaceUrl: `/?tab=itinerary&itineraryId=${created.id}`,
  }
}

export async function getWorkspace(itineraryId: string, ownerEmail: string): Promise<ItineraryWorkspace> {
  const record = await requireOwnedItinerary(itineraryId, ownerEmail)
  return toWorkspace(record)
}

export async function listItineraries(ownerEmail: string): Promise<ListItinerariesResponse> {
  const store = getItineraryStore()
  const records = await store.listByOwner(ownerEmail)
  return {
    items: records.map(toSummary),
  }
}

export async function appendStay(
  itineraryId: string,
  ownerEmail: string,
  payload: { city?: unknown; nights?: unknown; location?: unknown }
): Promise<ItineraryWorkspace> {
  const { city, nights, location } = parseStayMutationInputOrThrow(payload)
  const record = await requireOwnedItinerary(itineraryId, ownerEmail)

  const nextDays = regenerateDerivedDates(record.startDate, applyAppendStay(record.days, city, nights, location))
  const store = getItineraryStore()
  const saved = await store.replaceDays(record.id, record.updatedAt, nextDays)
  if (!saved) throw new ItineraryApiError(409, 'WORKSPACE_STALE')
  return toWorkspace(saved)
}

export async function patchStay(
  itineraryId: string,
  stayIndex: number,
  ownerEmail: string,
  payload: { city?: unknown; nights?: unknown; location?: unknown }
): Promise<ItineraryWorkspace> {
  if (!Number.isInteger(stayIndex) || stayIndex < 0) throw new ItineraryApiError(404, 'STAY_INDEX_INVALID')

  const hasCity = payload.city !== undefined
  const hasNights = payload.nights !== undefined
  const hasLocation = payload.location !== undefined
  if (!hasCity && !hasNights && !hasLocation) throw new ItineraryApiError(400, 'STAY_MUTATION_INVALID')

  const patch: { city?: string; nights?: number; location?: StayLocation } = {}
  if (hasCity) patch.city = parseCityOrThrow(payload.city)
  if (hasNights) patch.nights = parseNightsOrThrow(payload.nights)
  if (hasLocation) {
    const fallbackCityFromLocation = parseLocationLabel(payload.location)
    if (patch.city && fallbackCityFromLocation && patch.city !== fallbackCityFromLocation) {
      throw new ItineraryApiError(400, 'STAY_LOCATION_LABEL_MISMATCH')
    }
    patch.location = parseLocationOrThrow(payload.location)
    if (patch.location && patch.city && patch.city !== patch.location.label.trim()) {
      throw new ItineraryApiError(400, 'STAY_LOCATION_LABEL_MISMATCH')
    }

    if (!patch.city && patch.location) {
      patch.city = patch.location.label
    }
  }

  const record = await requireOwnedItinerary(itineraryId, ownerEmail)

  let mutatedDays
  try {
    mutatedDays = applyPatchStay(record.days, stayIndex, patch)
  } catch (error) {
    const code = error instanceof Error ? error.message : 'STAY_MUTATION_INVALID'
    if (code === 'STAY_INDEX_INVALID') throw new ItineraryApiError(404, code)
    if (code === 'STAY_TRAILING_DAYS_LOCKED') throw new ItineraryApiError(409, code)
    if (
      code === 'STAY_CITY_REQUIRED' ||
      code === 'STAY_NIGHTS_MIN' ||
      code === 'STAY_MUTATION_INVALID' ||
      code === 'STAY_LOCATION_INVALID' ||
      code === 'STAY_LOCATION_LABEL_MISMATCH'
    ) {
      throw new ItineraryApiError(400, code)
    }
    throw new ItineraryApiError(500, 'INTERNAL_ERROR')
  }

  const regenerated = regenerateDerivedDates(record.startDate, mutatedDays)
  const store = getItineraryStore()
  const saved = await store.replaceDays(record.id, record.updatedAt, regenerated)
  if (!saved) throw new ItineraryApiError(409, 'WORKSPACE_STALE')
  return toWorkspace(saved)
}

export async function moveStay(
  itineraryId: string,
  stayIndex: number,
  ownerEmail: string,
  direction: 'up' | 'down'
): Promise<ItineraryWorkspace> {
  if (!Number.isInteger(stayIndex) || stayIndex < 0) throw new ItineraryApiError(404, 'STAY_INDEX_INVALID')
  if (direction !== 'up' && direction !== 'down') throw new ItineraryApiError(400, 'STAY_MOVE_DIRECTION_INVALID')

  const record = await requireOwnedItinerary(itineraryId, ownerEmail)
  let mutatedDays
  try {
    mutatedDays = applyMoveStay(record.days, stayIndex, direction)
  } catch (error) {
    const code = error instanceof Error ? error.message : 'STAY_MUTATION_INVALID'
    if (code === 'STAY_INDEX_INVALID') throw new ItineraryApiError(404, code)
    if (code === 'STAY_SWAP_BOUNDARY') throw new ItineraryApiError(400, code)
    throw new ItineraryApiError(500, 'INTERNAL_ERROR')
  }

  const regenerated = regenerateDerivedDates(record.startDate, mutatedDays)
  const store = getItineraryStore()
  const saved = await store.replaceDays(record.id, record.updatedAt, regenerated)
  if (!saved) throw new ItineraryApiError(409, 'WORKSPACE_STALE')
  return toWorkspace(saved)
}

export async function patchDayPlan(
  itineraryId: string,
  dayIndex: number,
  ownerEmail: string,
  payload: { plan?: unknown }
) {
  if (!Number.isInteger(dayIndex) || dayIndex < 0) throw new ItineraryApiError(400, 'INVALID_DAY_INDEX')
  const record = await requireOwnedItinerary(itineraryId, ownerEmail)
  if (dayIndex >= record.days.length) throw new ItineraryApiError(400, 'INVALID_DAY_INDEX')

  const plan = payload.plan as PlanSections
  if (
    !plan ||
    typeof plan.morning !== 'string' ||
    typeof plan.afternoon !== 'string' ||
    typeof plan.evening !== 'string'
  ) {
    throw new ItineraryApiError(400, 'INVALID_PLAN')
  }

  const nextDays = record.days.map((day, index) => {
    if (index !== dayIndex) return day
    return { ...day, plan: { ...plan } }
  })

  const store = getItineraryStore()
  const saved = await store.replaceDays(record.id, record.updatedAt, nextDays)
  if (!saved) throw new ItineraryApiError(409, 'WORKSPACE_STALE')
  return saved.days[dayIndex]
}
