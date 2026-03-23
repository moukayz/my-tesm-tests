'use client'

import { useEffect, useState, type ReactNode } from 'react'
import type { ItinerarySummary } from '../app/lib/itinerary-store/types'

export interface StarterRouteCard {
  legacyTabKey: 'route'
  name: string
  startDate: string
  dayCount: number
  stayCount: number
}

interface ItineraryCardsViewProps {
  itineraries: ItinerarySummary[]
  starterRouteCard: StarterRouteCard | null
  onOpenStarterRoute: (legacyTabKey: 'route') => void
  onOpenItinerary: (itineraryId: string) => void
  onCreateItinerary: () => void
  onCopyStarterRoute?: () => void
}

const MAX_VISIBLE_ITINERARIES = 12
const ITINERARY_LIST_RENDER_DELAY_MS = 400

function formatDate(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString()
}

function CardSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3" aria-live="polite">
      <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

export default function ItineraryCardsView({
  itineraries,
  starterRouteCard,
  onOpenStarterRoute,
  onOpenItinerary,
  onCreateItinerary,
  onCopyStarterRoute,
}: ItineraryCardsViewProps) {
  const [renderItineraryList, setRenderItineraryList] = useState(false)
  const visibleItineraries = itineraries.slice(0, MAX_VISIBLE_ITINERARIES)

  useEffect(() => {
    const timerId = window.setTimeout(
      () => setRenderItineraryList(true),
      ITINERARY_LIST_RENDER_DELAY_MS
    )
    return () => window.clearTimeout(timerId)
  }, [])

  if (!starterRouteCard && itineraries.length === 0) {
    return (
      <section className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center" aria-live="polite">
        <h2 className="text-xl font-semibold text-gray-900">No itineraries yet</h2>
        <p className="mt-2 text-sm text-gray-600">Create your first itinerary. Saved itineraries will appear here.</p>
        <button
          type="button"
          onClick={onCreateItinerary}
          className="mt-5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          New itinerary
        </button>
      </section>
    )
  }

  return (
    <div data-testid="itinerary-cards-rail" className="w-full space-y-8">
      {starterRouteCard && (
        <CardSection title="Starter route">
          <div
            className="w-full rounded-2xl border border-gray-200 bg-white p-6 text-left transition hover:border-blue-300 hover:shadow-md"
            data-testid="itinerary-card-starter-route"
          >
            <button
              type="button"
              onClick={() => onOpenStarterRoute(starterRouteCard.legacyTabKey)}
              className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label={`Open itinerary ${starterRouteCard.name}`}
            >
              <p className="text-xl font-semibold text-gray-900">{starterRouteCard.name}</p>
              <p className="mt-2 text-sm text-gray-600">Start date: {starterRouteCard.startDate}</p>
              <p className="mt-3 text-sm text-gray-500">
                {starterRouteCard.dayCount} days · {starterRouteCard.stayCount} stays
              </p>
            </button>
            {onCopyStarterRoute && (
              <div className="mt-4 border-t border-gray-100 pt-3">
                <button
                  type="button"
                  onClick={onCopyStarterRoute}
                  className="text-sm font-medium text-blue-600 hover:text-blue-800"
                >
                  Copy to my itineraries
                </button>
              </div>
            )}
          </div>
        </CardSection>
      )}

      {renderItineraryList && visibleItineraries.length > 0 && (
        <CardSection title="Your itineraries">
          {visibleItineraries.map((itinerary) => (
            <button
              key={itinerary.id}
              type="button"
              onClick={() => onOpenItinerary(itinerary.id)}
              className="w-full rounded-2xl border border-gray-200 bg-white p-6 text-left transition hover:border-blue-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label={`Open itinerary ${itinerary.name}`}
              data-testid={`itinerary-card-${itinerary.id}`}
            >
              <p className="text-xl font-semibold text-gray-900">{itinerary.name}</p>
              <p className="mt-2 text-sm text-gray-600">Start date: {itinerary.startDate}</p>
              <p className="mt-3 text-xs text-gray-500">Updated {formatDate(itinerary.updatedAt)}</p>
            </button>
          ))}
          {itineraries.length > MAX_VISIBLE_ITINERARIES && (
            <p className="text-sm text-gray-500" data-testid="itinerary-cards-limit-note">
              Showing latest {MAX_VISIBLE_ITINERARIES} itineraries.
            </p>
          )}
        </CardSection>
      )}
    </div>
  )
}
