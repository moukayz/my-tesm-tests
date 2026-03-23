'use client'

import { ArrowLeft } from 'lucide-react'
import type { ItinerarySummary, ItineraryWorkspace as ItineraryWorkspaceType } from '../app/lib/itinerary-store/types'
import type { RouteDay } from '../app/lib/itinerary'
import ItineraryTab from './ItineraryTab'
import ItineraryWorkspace from './ItineraryWorkspace'

interface ItineraryDetailShellProps {
  selectedItineraryId?: string
  selectedLegacyTabKey?: 'route'
  selectedSummary?: ItinerarySummary
  initialRouteData?: RouteDay[]
  initialWorkspace?: ItineraryWorkspaceType | null
  initialErrorCode?: string | null
  onBackToCards: () => void
  onDirtyStateChange?: (isDirty: boolean) => void
}

export default function ItineraryDetailShell({
  selectedItineraryId,
  selectedLegacyTabKey,
  initialRouteData,
  initialWorkspace,
  initialErrorCode,
  onBackToCards,
  onDirtyStateChange,
}: ItineraryDetailShellProps) {
  return (
    <div data-testid="itinerary-detail-shell" className="w-full space-y-4">
      <div className="flex items-center">
        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          onClick={onBackToCards}
          aria-label="Back to all itineraries"
          title="Back to all itineraries"
        >
          <ArrowLeft size={16} aria-hidden="true" />
        </button>
      </div>

      {selectedLegacyTabKey === 'route' ? (
        <ItineraryTab initialData={initialRouteData ?? []} tabKey="route" onDirtyStateChange={onDirtyStateChange} />
      ) : (
        <ItineraryWorkspace
          selectedItineraryId={selectedItineraryId}
          initialWorkspace={initialWorkspace}
          initialErrorCode={initialErrorCode}
          onDirtyStateChange={onDirtyStateChange}
          onBackToCards={onBackToCards}
        />
      )}
    </div>
  )
}
