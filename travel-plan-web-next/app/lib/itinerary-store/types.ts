import type { RouteDay } from '../itinerary'

export interface StayLocationCustom {
  kind: 'custom'
  label: string
  queryText: string
}

export interface ResolvedPlace {
  placeId: string
  name: string
  locality?: string
  region?: string
  country?: string
  countryCode?: string
  featureType?: 'locality' | 'region' | 'country' | 'continent' | 'other'
}

export interface StayLocationResolved {
  kind: 'resolved'
  label: string
  queryText: string
  coordinates: {
    lng: number
    lat: number
  }
  place: ResolvedPlace
}

export interface LegacyStayLocationMapbox {
  kind: 'mapbox'
  label: string
  queryText: string
  coordinates: {
    lng: number
    lat: number
  }
  place: {
    mapboxId: string
    fullName: string
    placeType: string[]
    locality?: string
    region?: string
    country?: string
    countryCode?: string
  }
}

export interface LegacyStayLocationGeoNames {
  kind: 'geonames'
  label: string
  queryText: string
  coordinates: {
    lng: number
    lat: number
  }
  place: {
    geonameId: number
    name: string
    toponymName?: string
    countryName?: string
    countryCode?: string
    adminName1?: string
    adminName2?: string
    featureClass?: string
    featureCode?: string
  }
}

export type StayLocation = StayLocationCustom | StayLocationResolved | LegacyStayLocationMapbox | LegacyStayLocationGeoNames

export type StayLocationInput = StayLocation | LegacyStayLocationMapbox | LegacyStayLocationGeoNames

export interface ItinerarySummary {
  id: string
  name: string
  startDate: string
  status: 'draft'
  createdAt: string
  updatedAt: string
}

export interface StaySummary {
  stayIndex: number
  city: string
  nights: number
  startDayIndex: number
  endDayIndex: number
  isLastStay: boolean
  location: StayLocation
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
