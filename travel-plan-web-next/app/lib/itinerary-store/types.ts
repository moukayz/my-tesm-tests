import type { RouteDay } from '../itinerary'

export interface ItinerarySummary {
  id: string
  name: string
  startDate: string
  status: 'draft'
  createdAt: string
  updatedAt: string
}

export interface StarterRouteCard {
  name: 'Original seeded route'
  sourceBadge: 'Starter route'
  legacyTabKey: 'route'
  startDate: string
  dayCount: number
  stayCount: number
}

export interface StaySummary {
  stayIndex: number
  city: string
  nights: number
  startDayIndex: number
  endDayIndex: number
  isLastStay: boolean
}

export interface ItineraryWorkspace {
  itinerary: ItinerarySummary
  stays: StaySummary[]
  days: RouteDay[]
}

export interface CreateItineraryResponse {
  itinerary: ItinerarySummary
  workspaceUrl: string
}

export interface ListItinerariesResponse {
  items: ItinerarySummary[]
}

export interface ItineraryRecord extends ItinerarySummary {
  ownerEmail: string
  days: RouteDay[]
}

export interface CreateShellInput {
  ownerEmail: string
  name: string
  startDate: string
}

export interface ItineraryStore {
  createShell(input: CreateShellInput): Promise<ItineraryRecord>
  getById(itineraryId: string): Promise<ItineraryRecord | null>
  listByOwner(ownerEmail: string): Promise<ItineraryRecord[]>
  getLatestByOwner(ownerEmail: string): Promise<ItineraryRecord | null>
  replaceDays(itineraryId: string, expectedUpdatedAt: string, days: RouteDay[]): Promise<ItineraryRecord | null>
}
