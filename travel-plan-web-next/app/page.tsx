import { auth } from '../auth'
import TravelPlan from '../components/TravelPlan'
import { deriveStays } from './lib/itinerary-store/domain'
import { getItineraryStore } from './lib/itinerary-store/store'
import logger from './lib/logger'
import type { ItinerarySummary, ItineraryWorkspace } from './lib/itinerary-store/types'

export const dynamic = 'force-dynamic'

interface HomePageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function readParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

function toWorkspace(record: {
  id: string
  name: string
  startDate: string
  status: 'draft'
  createdAt: string
  updatedAt: string
  days: ItineraryWorkspace['days']
}): ItineraryWorkspace {
  return {
    itinerary: {
      id: record.id,
      name: record.name,
      startDate: record.startDate,
      status: record.status,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    },
    stays: deriveStays(record.days),
    days: record.days,
  }
}

export default async function Home({ searchParams }: HomePageProps) {
  const params = (await searchParams) ?? {}
  const selectedItineraryId = readParam(params.itineraryId)
  const session = await auth()

  let initialItineraryWorkspace: ItineraryWorkspace | null = null
  let initialItinerarySummaries: ItinerarySummary[] = []
  let initialItineraryId: string | undefined
  let initialItineraryErrorCode: string | null = null

  const userEmail = session?.user?.email
  if (userEmail) {
    try {
      if (selectedItineraryId) {
        const store = getItineraryStore()
        const records = await store.listByOwner(userEmail)
        initialItinerarySummaries = records.map((record) => ({
          id: record.id,
          name: record.name,
          startDate: record.startDate,
          status: record.status,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        }))

        const record = await store.getById(selectedItineraryId)
        if (!record) {
          initialItineraryErrorCode = 'ITINERARY_NOT_FOUND'
        } else if (record.ownerEmail !== userEmail) {
          initialItineraryErrorCode = 'ITINERARY_FORBIDDEN'
        } else {
          initialItineraryWorkspace = toWorkspace(record)
          initialItineraryId = record.id
        }
      }
    } catch (error: unknown) {
      logger.error({ err: error, userEmail, selectedItineraryId }, 'Failed to bootstrap itinerary summaries/workspace')
      initialItineraryId = selectedItineraryId
    }
  }

  return (
    <main className="max-w-6xl mx-auto px-8 py-8">
      <TravelPlan
        isLoggedIn={!!session?.user}
        initialItineraryWorkspace={initialItineraryWorkspace}
        initialItinerarySummaries={initialItinerarySummaries}
        initialItineraryId={initialItineraryId}
        initialItineraryErrorCode={initialItineraryErrorCode}
      />
    </main>
  )
}
