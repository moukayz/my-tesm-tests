import type { RouteDay } from './itinerary'
import { deriveStays } from './itinerary-store/domain'
import type { ItinerarySummary, StarterRouteCard } from './itinerary-store/types'

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

function normalizeRouteDate(date: string | undefined): string {
  if (!date) return ''

  const parts = date.split('/')
  if (parts.length !== 3) return date

  const [yearPart, monthPart, dayPart] = parts
  const year = Number(yearPart)
  const month = Number(monthPart)
  const day = Number(dayPart)
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return date
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return date
  }

  return `${year}-${pad2(month)}-${pad2(day)}`
}

export function buildStarterRouteCard(routeDays: RouteDay[]): StarterRouteCard {
  const firstDay = routeDays[0]

  return {
    name: 'Original seeded route',
    sourceBadge: 'Starter route',
    legacyTabKey: 'route',
    startDate: normalizeRouteDate(firstDay?.date),
    dayCount: routeDays.length,
    stayCount: deriveStays(routeDays).length,
  }
}

export function buildItineraryCardsPayload(input: {
  routeDays: RouteDay[]
  itinerarySummaries: ItinerarySummary[]
}): {
  starterRouteCard: StarterRouteCard
  itinerarySummaries: ItinerarySummary[]
} {
  return {
    starterRouteCard: buildStarterRouteCard(input.routeDays),
    itinerarySummaries: input.itinerarySummaries,
  }
}
