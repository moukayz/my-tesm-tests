import type { PlanSections } from '../itinerary'
import { applyAppendStay, applyPatchStay, deriveStays, regenerateDerivedDates } from './domain'
import { getItineraryStore } from './store'
import type { ItineraryRecord, ItinerarySummary, ItineraryWorkspace, ListItinerariesResponse } from './types'

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

function parseNightsOrThrow(nights: unknown): number {
  if (typeof nights !== 'number' || !Number.isInteger(nights) || nights < 1) {
    throw new ItineraryApiError(400, 'STAY_NIGHTS_MIN')
  }
  return nights
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
  return {
    itinerary: toSummary(record),
    stays: deriveStays(record.days),
    days: record.days,
  }
}

async function requireOwnedItinerary(itineraryId: string, ownerEmail: string): Promise<ItineraryRecord> {
  const store = getItineraryStore()
  const record = await store.getById(itineraryId)
  if (!record) throw new ItineraryApiError(404, 'ITINERARY_NOT_FOUND')
  if (record.ownerEmail !== ownerEmail) throw new ItineraryApiError(403, 'ITINERARY_FORBIDDEN')
  return record
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
  payload: { city?: unknown; nights?: unknown }
): Promise<ItineraryWorkspace> {
  const city = parseCityOrThrow(payload.city)
  const nights = parseNightsOrThrow(payload.nights)
  const record = await requireOwnedItinerary(itineraryId, ownerEmail)

  const nextDays = regenerateDerivedDates(record.startDate, applyAppendStay(record.days, city, nights))
  const store = getItineraryStore()
  const saved = await store.replaceDays(record.id, record.updatedAt, nextDays)
  if (!saved) throw new ItineraryApiError(409, 'WORKSPACE_STALE')
  return toWorkspace(saved)
}

export async function patchStay(
  itineraryId: string,
  stayIndex: number,
  ownerEmail: string,
  payload: { city?: unknown; nights?: unknown }
): Promise<ItineraryWorkspace> {
  if (!Number.isInteger(stayIndex) || stayIndex < 0) throw new ItineraryApiError(404, 'STAY_INDEX_INVALID')

  const hasCity = payload.city !== undefined
  const hasNights = payload.nights !== undefined
  if (!hasCity && !hasNights) throw new ItineraryApiError(400, 'STAY_MUTATION_INVALID')

  const patch: { city?: string; nights?: number } = {}
  if (hasCity) patch.city = parseCityOrThrow(payload.city)
  if (hasNights) patch.nights = parseNightsOrThrow(payload.nights)

  const record = await requireOwnedItinerary(itineraryId, ownerEmail)

  let mutatedDays
  try {
    mutatedDays = applyPatchStay(record.days, stayIndex, patch)
  } catch (error) {
    const code = error instanceof Error ? error.message : 'STAY_MUTATION_INVALID'
    if (code === 'STAY_INDEX_INVALID') throw new ItineraryApiError(404, code)
    if (code === 'STAY_TRAILING_DAYS_LOCKED') throw new ItineraryApiError(409, code)
    if (code === 'STAY_CITY_REQUIRED' || code === 'STAY_NIGHTS_MIN' || code === 'STAY_MUTATION_INVALID') {
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
